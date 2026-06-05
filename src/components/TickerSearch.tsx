"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Search box on the front page — navigates to /stock/TICKER on submit. */
export function TickerSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = value.trim().toUpperCase();
    if (/^[A-Z0-9.\-]{1,12}$/.test(t)) router.push(`/stock/${t}`);
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 10 }}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter a ticker — AAPL, MSFT, NVDA…"
        style={{ flex: 1, fontSize: "1.05rem", padding: "14px 18px" }}
        aria-label="Stock ticker"
      />
      <button type="submit" className="primary" style={{ padding: "0 24px" }}>
        Analyze
      </button>
    </form>
  );
}
