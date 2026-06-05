import { getIndexQuotes } from "@/lib/indices";
import { quoteOfTheDay } from "@/lib/quotes";
import { isUsingRealData } from "@/lib/providers";
import { IndexStrip } from "@/components/IndexStrip";
import { TickerSearch } from "@/components/TickerSearch";
import { SavedStocks } from "@/components/SavedStocks";
import type { Quote } from "@/lib/providers/types";

export const revalidate = 60;

export default async function HomePage() {
  let quotes: Quote[] = [];
  try {
    quotes = await getIndexQuotes();
  } catch {
    quotes = [];
  }
  const quote = quoteOfTheDay();

  return (
    <main className="stack" style={{ gap: 28 }}>
      <IndexStrip quotes={quotes} />

      <header style={{ textAlign: "center", padding: "28px 0 8px" }}>
        <h1>
          investing<span className="accent">fun</span>
        </h1>
        <p className="dim" style={{ maxWidth: 560, margin: "10px auto 0" }}>
          Buffett-style DCF, price momentum, options posture, and social buzz —
          fused into buy ratings across 6-day, 30-day, and 1-year horizons.
        </p>
      </header>

      <div style={{ maxWidth: 620, margin: "0 auto", width: "100%" }}>
        <TickerSearch />
        {!isUsingRealData() && (
          <p className="amber" style={{ fontSize: "0.8rem", textAlign: "center", marginTop: 10 }}>
            ⚠ Running on sample data — set FMP_API_KEY in .env.local for live data.
          </p>
        )}
      </div>

      <blockquote
        style={{
          textAlign: "center",
          fontStyle: "italic",
          color: "var(--text-dim)",
          maxWidth: 640,
          margin: "12px auto",
          borderLeft: "none",
        }}
      >
        “{quote}”
        <footer className="faint" style={{ marginTop: 8, fontStyle: "normal", fontSize: "0.8rem" }}>
          — Søren Kierkegaard
        </footer>
      </blockquote>

      <section className="card">
        <h2>Saved analyses</h2>
        <SavedStocks />
      </section>
    </main>
  );
}
