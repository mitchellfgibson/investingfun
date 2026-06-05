/** CLI smoke test for the full analysis pipeline: npx tsx scripts/analyze.ts AAPL */
import { analyzeStock } from "../src/lib/ratings/analyze";
import { isUsingRealData } from "../src/lib/providers";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  console.log(`\nData: ${isUsingRealData() ? "FMP (real)" : "MOCK"}\n`);
  const r = await analyzeStock(ticker);

  console.log(`${r.name} (${r.ticker})`);
  console.log("=".repeat(56));
  const d = r.inputs.dcf;
  console.log(`DCF intrinsic: $${d.intrinsicValuePerShare.toFixed(2)} vs price $${d.currentPrice.toFixed(2)} (${(d.upsideDownside * 100).toFixed(0)}%)`);
  console.log(`Momentum score: ${r.inputs.momentum.score.toFixed(2)}  RSI ${r.inputs.momentum.rsi14.toFixed(0)}  vol ${(r.inputs.momentum.annualizedVolatility * 100).toFixed(0)}%`);
  console.log(`Options (proxy): ${r.inputs.options.skew}, ${r.inputs.options.volRegime} vol, score ${r.inputs.options.score.toFixed(2)}`);
  console.log(`Social: ${r.inputs.social.postCount} posts, score ${r.inputs.social.score.toFixed(2)} (${r.inputs.social.analyzedBy}) — ${r.inputs.social.summary}`);
  console.log("-".repeat(56));
  for (const h of ["6d", "30d", "1y"] as const) {
    const rt = r.ratings[h];
    console.log(`${h.padEnd(4)} → ${rt.label.padEnd(11)} (score ${rt.score.toFixed(2)}, conf ${(rt.confidence * 100).toFixed(0)}%)`);
  }
  console.log("-".repeat(56));
  const b = r.asymmetricBet;
  console.log(`Asymmetric bet: ${b.hasIdea ? `${b.structure} — ${b.thesis}` : "none (mixed signals)"}`);
  console.log();
}

main().catch((e) => { console.error("Failed:", e.message ?? e); process.exit(1); });
