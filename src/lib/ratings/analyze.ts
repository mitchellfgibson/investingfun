/**
 * Top-level analysis orchestrator. Given a ticker, fetches fundamentals + price
 * history + social buzz, runs the DCF / momentum / options / social modules,
 * and combines them into a full StockRating. This is THE entry point for the
 * "analyze a stock" API route.
 */

import { getProvider } from "@/lib/providers";
import { runDcf } from "@/lib/dcf/engine";
import type { DcfAssumptions } from "@/lib/dcf/types";
import { analyzeMomentum } from "@/lib/analysis/momentum";
import { analyzeOptionsSentiment } from "@/lib/analysis/options";
import { getSocialBuzz } from "@/lib/social";
import { rateStock } from "./engine";
import type { StockRating } from "./types";

export interface AnalyzeOptions {
  assumptions?: Partial<DcfAssumptions>;
}

export async function analyzeStock(
  ticker: string,
  opts: AnalyzeOptions = {}
): Promise<StockRating> {
  const provider = getProvider();

  // Fetch the independent data sources in parallel.
  const [snapshot, history, social] = await Promise.all([
    provider.getFinancialSnapshot(ticker),
    provider.getPriceHistory(ticker, "1y"),
    getSocialBuzz(ticker),
  ]);

  const dcf = runDcf(snapshot, opts.assumptions);
  const momentum = analyzeMomentum(history);
  const options = analyzeOptionsSentiment(momentum);

  return rateStock({ dcf, snapshot, momentum, options, social });
}
