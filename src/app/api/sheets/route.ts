/**
 * POST /api/sheets — export a stock's DCF to a live Google Sheet.
 * Body: { ticker }. Returns the sheet URL, or a 503 if Google isn't configured.
 */
import { NextRequest, NextResponse } from "next/server";
import { valuateTicker } from "@/lib/dcf/valuate";
import { exportDcfToSheet, googleSheetsConfigured } from "@/lib/sheets/dcfSheet";

export const dynamic = "force-dynamic";

export async function GET() {
  // Lets the UI check whether to show/enable the export button.
  return NextResponse.json({ configured: googleSheetsConfigured() });
}

export async function POST(req: NextRequest) {
  if (!googleSheetsConfigured()) {
    return NextResponse.json(
      { error: "Google Sheets not configured. See GOOGLE_SHEETS_SETUP.md." },
      { status: 503 }
    );
  }
  let ticker: string | undefined;
  try {
    ({ ticker } = (await req.json()) as { ticker?: string });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!ticker || !/^[A-Za-z0-9.\-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ error: "Missing or invalid ticker" }, { status: 400 });
  }
  try {
    const dcf = await valuateTicker(ticker);
    const result = await exportDcfToSheet(dcf);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
