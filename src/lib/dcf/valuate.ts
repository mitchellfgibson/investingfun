/**
 * Orchestration: fetch a ticker's financials via the provider layer, then run
 * the DCF engine. This is the single entry point the API routes / UI will call.
 */

import { getProvider } from "@/lib/providers";
import { runDcf } from "./engine";
import type { DcfAssumptions, DcfResult } from "./types";

export interface ValuationOptions {
  /** Assumption overrides from the user's UI knobs. */
  assumptions?: Partial<DcfAssumptions>;
}

/** Fetch fundamentals for `ticker` and return a full DCF valuation. */
export async function valuateTicker(
  ticker: string,
  opts: ValuationOptions = {}
): Promise<DcfResult> {
  const provider = getProvider();
  const snapshot = await provider.getFinancialSnapshot(ticker);
  return runDcf(snapshot, opts.assumptions);
}
