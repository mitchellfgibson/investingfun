/**
 * CLI smoke test for the DCF pipeline (provider -> engine).
 *
 *   npx tsx scripts/valuate.ts AAPL
 *
 * Uses the real FMP provider if FMP_API_KEY is set in the environment,
 * otherwise falls back to sample/mock data. Prints a readable valuation.
 */

import { valuateTicker } from "../src/lib/dcf/valuate";
import { isUsingRealData } from "../src/lib/providers";

const fmt = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: n > 1000 ? 0 : 2,
    notation: n > 1_000_000 ? "compact" : "standard",
  }).format(n);

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  console.log(
    `\nData source: ${isUsingRealData() ? "FMP (real)" : "MOCK (sample data — set FMP_API_KEY for real)"}\n`
  );

  const r = await valuateTicker(ticker);
  const c = r.currency;

  console.log(`${r.name} (${r.ticker})`);
  console.log("─".repeat(50));
  console.log(`Base owner earnings:   ${fmt(r.baseOwnerEarnings, c)}`);
  console.log(`Enterprise value:      ${fmt(r.enterpriseValue, c)}`);
  console.log(`Equity value:          ${fmt(r.equityValue, c)}`);
  console.log(`  PV explicit period:  ${fmt(r.pvOfExplicitPeriod, c)}`);
  console.log(`  PV terminal value:   ${fmt(r.pvOfTerminalValue, c)}  (${pct(r.terminalValueWeight)} of EV)`);
  console.log("─".repeat(50));
  console.log(`Intrinsic / share:     ${fmt(r.intrinsicValuePerShare, c)}`);
  console.log(`Current price:         ${fmt(r.currentPrice, c)}`);
  console.log(`Upside / (downside):   ${pct(r.upsideDownside)}`);
  console.log(`Buy below (${pct(r.assumptions.marginOfSafety)} MoS):   ${fmt(r.buyBelowPrice, c)}`);
  console.log("─".repeat(50));
  console.log("Assumptions:");
  console.log(`  Stage-1 growth:  ${pct(r.assumptions.stage1GrowthRate)} for ${r.assumptions.stage1Years}y`);
  console.log(`  Fade period:     ${r.assumptions.stage2Years}y -> terminal ${pct(r.assumptions.terminalGrowthRate)}`);
  console.log(`  Discount rate:   ${pct(r.assumptions.discountRate)}`);

  if (r.warnings.length) {
    console.log("\n⚠ Warnings:");
    for (const w of r.warnings) console.log(`  - ${w}`);
  }
  console.log();
}

main().catch((err) => {
  console.error("Valuation failed:", err.message ?? err);
  process.exit(1);
});
