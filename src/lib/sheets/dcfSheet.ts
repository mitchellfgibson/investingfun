/**
 * Google Sheets DCF export.
 *
 * Builds a real Google Sheet for a stock's Buffett-style DCF, with LIVE
 * FORMULAS — assumptions are editable cells and the intrinsic value recomputes
 * in-sheet. This means the exported sheet is a working model, not a static
 * dump.
 *
 * DORMANT BY DEFAULT: this only works once Google credentials are configured.
 * We use a SERVICE ACCOUNT (simpler than OAuth for a personal tool — no consent
 * screen). Configure via env:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  = the full service-account JSON (stringified), OR
 *   GOOGLE_SERVICE_ACCOUNT_FILE  = path to the JSON key file
 *   GOOGLE_DRIVE_FOLDER_ID       = (optional) folder to create sheets in
 *   GOOGLE_SHARE_WITH_EMAIL      = (optional) your email, to auto-share the sheet
 *
 * See GOOGLE_SHEETS_SETUP.md for the ~10-minute setup.
 */

import { google } from "googleapis";
import type { DcfResult } from "@/lib/dcf/types";

export function googleSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_FILE
  );
}

/** Load service-account credentials from env (JSON string or file path). */
async function loadCredentials(): Promise<{ client_email: string; private_key: string }> {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) return JSON.parse(json);

  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (file) {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(file, "utf8"));
  }
  throw new Error(
    "Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE (see GOOGLE_SHEETS_SETUP.md)."
  );
}

async function authClients() {
  const creds = await loadCredentials();
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
  await auth.authorize();
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

export interface SheetExportResult {
  spreadsheetId: string;
  /** Direct edit URL. */
  url: string;
  /** Embeddable URL (for an iframe in the app). */
  embedUrl: string;
}

/**
 * Create a Google Sheet with a live Buffett-style DCF for the given result.
 * Throws if not configured.
 */
export async function exportDcfToSheet(dcf: DcfResult): Promise<SheetExportResult> {
  const { sheets, drive } = await authClients();
  const a = dcf.assumptions;

  // 1) Create the spreadsheet.
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `DCF — ${dcf.name} (${dcf.ticker})` },
      sheets: [{ properties: { title: "DCF", gridProperties: { rowCount: 60, columnCount: 8 } } }],
    },
  });
  const spreadsheetId = created.data.spreadsheetId!;

  // 2) Build the grid. Assumptions live in named cells (B-column) and the
  //    projection/valuation reference them via FORMULAS, so editing an
  //    assumption recomputes everything live.
  //
  //    Layout:
  //      Row 1: title
  //      Rows 3-9: assumptions (editable)
  //      Row 11: projection header
  //      Rows 12..(12+years-1): year-by-year (formula-driven)
  //      Below: terminal value, EV, equity bridge, per-share, buy-below
  const years = a.stage1Years + a.stage2Years;
  const rows: (string | number)[][] = [];

  rows.push([`Buffett-style DCF — ${dcf.name} (${dcf.ticker})`]);
  rows.push([""]);
  rows.push(["ASSUMPTIONS (edit these)", ""]);
  rows.push(["Base owner earnings", a.baseOwnerEarnings]); // B4
  rows.push(["Stage-1 growth rate", a.stage1GrowthRate]); // B5
  rows.push(["Stage-1 years", a.stage1Years]); // B6
  rows.push(["Fade (stage-2) years", a.stage2Years]); // B7
  rows.push(["Terminal growth rate", a.terminalGrowthRate]); // B8
  rows.push(["Discount rate", a.discountRate]); // B9
  rows.push(["Margin of safety", a.marginOfSafety]); // B10
  rows.push(["Net debt", netDebt(dcf)]); // B11
  rows.push(["Shares outstanding", shares(dcf)]); // B12
  rows.push(["Current price", dcf.currentPrice]); // B13
  rows.push([""]);
  rows.push(["YEAR", "GROWTH", "OWNER EARNINGS", "DISCOUNT FACTOR", "PRESENT VALUE"]); // row 15 header

  const headerRow = 15;
  const firstProjRow = headerRow + 1; // 16
  for (let y = 1; y <= years; y++) {
    const r = firstProjRow + (y - 1);
    const prevOe = y === 1 ? "$B$4" : `C${r - 1}`;
    // Growth: stage 1 uses B5; stage 2 linearly fades B5 -> B8.
    const growthFormula =
      `=IF(${y}<=$B$6,$B$5,$B$5+($B$8-$B$5)*((${y}-$B$6)/$B$7))`;
    rows.push([
      y,
      growthFormula,
      `=${prevOe}*(1+B${r})`,
      `=1/((1+$B$9)^A${r})`,
      `=C${r}*D${r}`,
    ]);
  }
  const lastProjRow = firstProjRow + years - 1;

  rows.push([""]);
  const sumRow = lastProjRow + 2;
  rows.push(["PV of explicit period", `=SUM(E${firstProjRow}:E${lastProjRow})`]); // B(sumRow)
  rows.push(["Terminal value", `=C${lastProjRow}*(1+$B$8)/($B$9-$B$8)`]); // B(sumRow+1)
  rows.push(["PV of terminal value", `=B${sumRow + 1}*D${lastProjRow}`]); // B(sumRow+2)
  rows.push(["Enterprise value", `=B${sumRow}+B${sumRow + 2}`]); // B(sumRow+3)
  rows.push(["Equity value", `=B${sumRow + 3}-$B$11`]); // B(sumRow+4)
  rows.push(["Intrinsic value / share", `=B${sumRow + 4}/$B$12`]); // B(sumRow+5)
  rows.push(["Upside vs price", `=B${sumRow + 5}/$B$13-1`]); // B(sumRow+6)
  rows.push(["Buy below (after MoS)", `=B${sumRow + 5}*(1-$B$10)`]); // B(sumRow+7)

  // 3) Write all values/formulas in one batch.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "DCF!A1",
    valueInputOption: "USER_ENTERED", // interpret strings starting with "=" as formulas
    requestBody: { values: rows },
  });

  // 4) Light formatting: bold headers, percent/currency-ish number formats.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: formattingRequests(created.data.sheets![0].properties!.sheetId!) },
  });

  // 5) Optionally share with the user so it shows up in their Drive.
  const shareEmail = process.env.GOOGLE_SHARE_WITH_EMAIL;
  if (shareEmail) {
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { type: "user", role: "writer", emailAddress: shareEmail },
      sendNotificationEmail: false,
    });
  }
  // Optionally move into a specific folder.
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (folderId) {
    await drive.files.update({ fileId: spreadsheetId, addParents: folderId });
  }

  return {
    spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    embedUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/preview`,
  };
}

function netDebt(dcf: DcfResult): number {
  // Reconstruct net debt from EV/equity if possible, else 0.
  return dcf.enterpriseValue - dcf.equityValue;
}
function shares(dcf: DcfResult): number {
  return dcf.intrinsicValuePerShare > 0
    ? dcf.equityValue / dcf.intrinsicValuePerShare
    : 0;
}

/** Minimal cell formatting (bold titles, percent formats for rate cells). */
function formattingRequests(sheetId: number) {
  const bold = (startRow: number, endRow: number) => ({
    repeatCell: {
      range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: 0, endColumnIndex: 5 },
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: "userEnteredFormat.textFormat.bold",
    },
  });
  const percentCells = (rowStart: number, rowEnd: number) => ({
    repeatCell: {
      range: { sheetId, startRowIndex: rowStart, endRowIndex: rowEnd, startColumnIndex: 1, endColumnIndex: 2 },
      cell: { userEnteredFormat: { numberFormat: { type: "PERCENT", pattern: "0.0%" } } },
      fields: "userEnteredFormat.numberFormat",
    },
  });
  return [
    bold(0, 1), // title
    bold(2, 3), // ASSUMPTIONS header
    bold(14, 15), // projection header (row 15, 0-indexed 14)
    // Rate assumption cells: stage-1 growth (row5→idx4), terminal (row8→idx7),
    // discount (row9→idx8), MoS (row10→idx9). Format individually.
    percentCells(4, 5),
    percentCells(7, 10),
  ];
}
