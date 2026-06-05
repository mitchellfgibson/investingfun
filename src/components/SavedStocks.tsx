"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { pillClass } from "@/lib/format";

interface Summary {
  ticker: string;
  name: string;
  savedAt: number;
  ratings: Record<"6d" | "30d" | "1y", { label: string; score: number }>;
}

/** Saved-stocks list with delete. Self-fetches so the front page can stay a
 *  server component. */
export function SavedStocks() {
  const [stocks, setStocks] = useState<Summary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/saved", { cache: "no-store" });
    const data = await res.json();
    setStocks(data.stocks ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(ticker: string) {
    setBusy(ticker);
    await fetch(`/api/saved/${ticker}`, { method: "DELETE" });
    await load();
    setBusy(null);
  }

  if (stocks === null) {
    return (
      <div className="dim" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="spinner" /> Loading saved stocks…
      </div>
    );
  }
  if (stocks.length === 0) {
    return <p className="dim">No saved stocks yet. Analyze one and hit “Save”.</p>;
  }

  return (
    <div className="stack">
      {stocks.map((s) => (
        <div className="row card card-2" key={s.ticker} style={{ padding: "12px 16px" }}>
          <Link href={`/stock/${s.ticker}`} style={{ flex: 1 }}>
            <div className="row">
              <div>
                <strong className="mono">{s.ticker}</strong>{" "}
                <span className="dim" style={{ fontSize: "0.85rem" }}>
                  {s.name}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["6d", "30d", "1y"] as const).map((h) => (
                  <span key={h} className={pillClass(s.ratings[h].label)} title={`${h}: ${s.ratings[h].label}`}>
                    {h} {s.ratings[h].label}
                  </span>
                ))}
              </div>
            </div>
          </Link>
          <button
            className="danger"
            disabled={busy === s.ticker}
            onClick={() => remove(s.ticker)}
            style={{ padding: "6px 12px" }}
          >
            {busy === s.ticker ? "…" : "Delete"}
          </button>
        </div>
      ))}
    </div>
  );
}
