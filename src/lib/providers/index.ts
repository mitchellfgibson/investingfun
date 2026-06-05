/**
 * Provider registry. The rest of the app calls getProvider() and never
 * constructs a vendor directly. Selection is driven by env so we can swap
 * providers without code changes:
 *
 *   - If FMP_API_KEY is set        → FmpProvider (real data)
 *   - else                         → MockProvider (sample data, app still works)
 *
 * A future composite provider (e.g. Yahoo for live prices + FMP for
 * fundamentals) can slot in here behind the same getProvider() call.
 */

import { FmpProvider } from "./fmp";
import { MockProvider } from "./mock";
import type { MarketDataProvider } from "./types";

let cached: MarketDataProvider | null = null;

export function getProvider(): MarketDataProvider {
  if (cached) return cached;
  if (process.env.FMP_API_KEY) {
    cached = new FmpProvider();
  } else {
    cached = new MockProvider();
  }
  return cached;
}

/** True when we're serving real data (vs. the mock fallback). */
export function isUsingRealData(): boolean {
  return Boolean(process.env.FMP_API_KEY);
}

export * from "./types";
