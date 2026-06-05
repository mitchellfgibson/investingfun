"use client";

import { useEffect, useState } from "react";

/** Save + Export-to-Sheets actions for a ticker. */
export function ActionBar({ ticker }: { ticker: string }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sheetsConfigured, setSheetsConfigured] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sheets")
      .then((r) => r.json())
      .then((d) => setSheetsConfigured(Boolean(d.configured)))
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function exportSheet() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Export failed");
      setSheetUrl(data.url);
      window.open(data.url, "_blank");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="primary" onClick={save} disabled={saving || saved}>
          {saved ? "✓ Saved" : saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={exportSheet}
          disabled={exporting || !sheetsConfigured}
          title={sheetsConfigured ? "Create a live Google Sheet DCF" : "Configure Google Sheets first (see GOOGLE_SHEETS_SETUP.md)"}
        >
          {exporting ? "Exporting…" : "Export DCF to Google Sheets"}
        </button>
        {sheetUrl && (
          <a href={sheetUrl} target="_blank" rel="noreferrer">
            <button>Open sheet ↗</button>
          </a>
        )}
      </div>
      {!sheetsConfigured && (
        <span className="faint" style={{ fontSize: "0.75rem" }}>
          Google Sheets export is dormant — see GOOGLE_SHEETS_SETUP.md to enable.
        </span>
      )}
      {error && <span className="red" style={{ fontSize: "0.8rem" }}>{error}</span>}
    </div>
  );
}
