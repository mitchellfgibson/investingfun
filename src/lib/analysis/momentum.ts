/**
 * Momentum & volume analysis over a series of daily price bars.
 *
 * Pure functions, no I/O — they take PriceBar[] (oldest-first) and return
 * structured signals. These feed the ratings engine and are independently
 * testable. Indicators implemented:
 *   - trailing returns over standard windows
 *   - simple moving averages (SMA) + price-vs-SMA trend
 *   - RSI (Wilder's 14-day) for overbought/oversold
 *   - annualized volatility (for the options proxy)
 *   - volume surge (recent avg volume vs. longer baseline)
 *   - a composite momentum score in [-1, 1]
 */

import type { PriceBar } from "@/lib/providers/types";

export interface MomentumSignals {
  /** Most recent close. */
  lastClose: number;
  /** Trailing total returns (decimal) over N trading days. */
  returns: { d5: number; d20: number; d60: number; d120: number };
  /** Simple moving averages. */
  sma: { d20: number; d50: number; d200: number };
  /** Close relative to SMA50 / SMA200 (decimal; >0 = above). */
  trend: { vsSma50: number; vsSma200: number; goldenCross: boolean };
  /** Wilder's 14-day RSI (0..100). */
  rsi14: number;
  /** Annualized volatility from daily log returns (decimal). */
  annualizedVolatility: number;
  /** Recent 10-day avg volume / prior 50-day avg volume. >1 = surging. */
  volumeSurge: number;
  /**
   * Composite momentum score in [-1, 1]. Positive = bullish momentum.
   * A blend of medium-term return, trend position, and RSI distance from 50.
   */
  score: number;
  /** Human-readable notes (e.g. insufficient history). */
  notes: string[];
}

const TRADING_DAYS_PER_YEAR = 252;

/** Total return between the close `n` bars ago and the last close. */
function trailingReturn(bars: PriceBar[], n: number): number {
  if (bars.length <= n) return 0;
  const last = bars[bars.length - 1].close;
  const past = bars[bars.length - 1 - n].close;
  return past > 0 ? last / past - 1 : 0;
}

/** Simple moving average of the last `n` closes. */
function sma(bars: PriceBar[], n: number): number {
  if (bars.length === 0) return 0;
  const slice = bars.slice(-n);
  return slice.reduce((s, b) => s + b.close, 0) / slice.length;
}

/** Wilder's RSI over `period` (default 14). Returns 50 if not enough data. */
export function rsi(bars: PriceBar[], period = 14): number {
  if (bars.length <= period) return 50;
  let avgGain = 0;
  let avgLoss = 0;
  // Seed with the first `period` changes.
  for (let i = 1; i <= period; i++) {
    const change = bars[i].close - bars[i - 1].close;
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  // Wilder smoothing for the remainder.
  for (let i = period + 1; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Annualized volatility from daily log returns. */
export function annualizedVolatility(bars: PriceBar[]): number {
  if (bars.length < 2) return 0;
  const logReturns: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    const cur = bars[i].close;
    if (prev > 0 && cur > 0) logReturns.push(Math.log(cur / prev));
  }
  if (logReturns.length < 2) return 0;
  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const variance =
    logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/** Recent (10d) average volume divided by the prior 50d baseline. */
function volumeSurge(bars: PriceBar[]): number {
  if (bars.length < 60) return 1;
  const recent = bars.slice(-10);
  const baseline = bars.slice(-60, -10);
  const recentAvg = recent.reduce((s, b) => s + b.volume, 0) / recent.length;
  const baseAvg = baseline.reduce((s, b) => s + b.volume, 0) / baseline.length;
  return baseAvg > 0 ? recentAvg / baseAvg : 1;
}

/** Clamp a number into [lo, hi]. */
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function analyzeMomentum(bars: PriceBar[]): MomentumSignals {
  const notes: string[] = [];
  if (bars.length < 30) {
    notes.push(`Only ${bars.length} price bars available; momentum signals are unreliable.`);
  }

  const lastClose = bars.length ? bars[bars.length - 1].close : 0;
  const returns = {
    d5: trailingReturn(bars, 5),
    d20: trailingReturn(bars, 20),
    d60: trailingReturn(bars, 60),
    d120: trailingReturn(bars, 120),
  };
  const smaVals = { d20: sma(bars, 20), d50: sma(bars, 50), d200: sma(bars, 200) };
  const trend = {
    vsSma50: smaVals.d50 > 0 ? lastClose / smaVals.d50 - 1 : 0,
    vsSma200: smaVals.d200 > 0 ? lastClose / smaVals.d200 - 1 : 0,
    goldenCross: smaVals.d50 > smaVals.d200 && smaVals.d200 > 0,
  };
  const rsi14 = rsi(bars, 14);
  const vol = annualizedVolatility(bars);
  const surge = volumeSurge(bars);

  // Composite score: blend medium-term return, trend, and RSI tilt.
  // Each sub-signal is squashed into roughly [-1, 1] before weighting.
  const returnSignal = clamp(returns.d60 / 0.2, -1, 1); // ±20% over 60d saturates
  const trendSignal = clamp(trend.vsSma200 / 0.15, -1, 1); // ±15% vs SMA200 saturates
  const rsiSignal = clamp((rsi14 - 50) / 30, -1, 1); // RSI 20..80 maps to -1..1
  const score = clamp(
    0.45 * returnSignal + 0.35 * trendSignal + 0.2 * rsiSignal,
    -1,
    1
  );

  return {
    lastClose,
    returns,
    sma: smaVals,
    trend,
    rsi14,
    annualizedVolatility: vol,
    volumeSurge: surge,
    score,
    notes,
  };
}
