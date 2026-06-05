/**
 * Options sentiment.
 *
 * IMPORTANT: real options-chain data (open interest, put/call ratio, implied
 * volatility skew) is NOT available on the free data tier we're using. Rather
 * than fabricate a put/call ratio, this module builds an HONEST PROXY for
 * options sentiment from data we *do* have:
 *
 *   - realized (historical) volatility  -> a stand-in for implied vol level
 *   - recent momentum & trend           -> directional skew the market likely prices
 *   - volume surge                      -> conviction / unusual activity flag
 *
 * Everything returned is explicitly marked `isProxy: true` and the rating
 * engine weights it lightly. When a real options provider is added behind the
 * MarketDataProvider interface, swap this for the real put/call + IV data.
 */

import type { MomentumSignals } from "./momentum";

export type VolRegime = "low" | "normal" | "elevated" | "high";
export type Skew = "bullish" | "neutral" | "bearish";

export interface OptionsSentiment {
  /** Always true for now — we have no real chain data. */
  isProxy: boolean;
  /** Realized annualized volatility used as the IV stand-in (decimal). */
  impliedVolProxy: number;
  /** Bucketed volatility regime. */
  volRegime: VolRegime;
  /** Directional posture the proxy infers from momentum/trend. */
  skew: Skew;
  /**
   * Synthetic "put/call" tilt in [-1, 1]. Negative = put-heavy (bearish),
   * positive = call-heavy (bullish). Derived, NOT measured.
   */
  putCallTilt: number;
  /** True when recent volume is surging (possible unusual activity). */
  unusualActivity: boolean;
  /** A sentiment score in [-1, 1] for the ratings engine. */
  score: number;
  /** Human-readable explanation lines. */
  notes: string[];
}

function bucketVol(vol: number): VolRegime {
  if (vol < 0.2) return "low";
  if (vol < 0.35) return "normal";
  if (vol < 0.55) return "elevated";
  return "high";
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * Build an options-sentiment proxy from momentum signals.
 * @param m momentum signals (provides volatility, trend, volume surge)
 */
export function analyzeOptionsSentiment(m: MomentumSignals): OptionsSentiment {
  const impliedVolProxy = m.annualizedVolatility;
  const volRegime = bucketVol(impliedVolProxy);

  // Directional tilt: combine medium-term return and trend-vs-SMA200.
  // Strong uptrend => call-heavy tilt; downtrend => put-heavy.
  const directional = clamp(
    0.6 * clamp(m.returns.d20 / 0.1, -1, 1) + 0.4 * clamp(m.trend.vsSma200 / 0.15, -1, 1),
    -1,
    1
  );
  const putCallTilt = directional;
  const skew: Skew =
    putCallTilt > 0.2 ? "bullish" : putCallTilt < -0.2 ? "bearish" : "neutral";

  const unusualActivity = m.volumeSurge > 1.75;

  // Overall options score: mostly the directional tilt, nudged by an
  // unusual-activity bump in the tilt's direction.
  let score = putCallTilt;
  if (unusualActivity) score += Math.sign(putCallTilt || 1) * 0.1;
  score = clamp(score, -1, 1);

  const notes: string[] = [
    "Options sentiment is a PROXY derived from price/volatility — no live options-chain data on the free tier.",
    `Volatility regime: ${volRegime} (~${(impliedVolProxy * 100).toFixed(0)}% annualized).`,
    `Inferred skew: ${skew}.`,
  ];
  if (unusualActivity) {
    notes.push(`Volume surging (${m.volumeSurge.toFixed(1)}× baseline) — possible unusual activity.`);
  }

  return {
    isProxy: true,
    impliedVolProxy,
    volRegime,
    skew,
    putCallTilt,
    unusualActivity,
    score,
    notes,
  };
}
