/**
 * Ratings engine — combines the four signal sources into buy ratings for three
 * time horizons plus an asymmetric options-bet idea.
 *
 * Core idea: the SAME four normalized signals are weighted DIFFERENTLY per
 * horizon, reflecting what actually drives returns over that window:
 *
 *   - 6 days  : dominated by momentum, options posture, and social buzz.
 *               Intrinsic value barely matters over a week.
 *   - 30 days : a blend; momentum still leads but value starts to matter.
 *   - 1 year  : dominated by intrinsic value (DCF upside); momentum/buzz fade.
 *
 * Every signal is pre-normalized to [-1, 1] (positive = bullish) so the
 * weighting is a simple, inspectable dot product.
 */

import type { DcfResult, FinancialSnapshot } from "@/lib/dcf/types";
import type { MomentumSignals } from "@/lib/analysis/momentum";
import type { OptionsSentiment } from "@/lib/analysis/options";
import type { SocialBuzz } from "@/lib/social/types";
import type {
  AsymmetricBet,
  Horizon,
  HorizonRating,
  RatingLabel,
  StockRating,
} from "./types";

/** Per-horizon weights for [value, momentum, options, social]. Each row sums to 1. */
const WEIGHTS: Record<Horizon, { value: number; momentum: number; options: number; social: number }> = {
  "6d": { value: 0.05, momentum: 0.45, options: 0.2, social: 0.3 },
  "30d": { value: 0.25, momentum: 0.4, options: 0.15, social: 0.2 },
  "1y": { value: 0.65, momentum: 0.2, options: 0.05, social: 0.1 },
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * Map DCF upside/downside into a [-1, 1] value signal. ±40% upside saturates;
 * we bias slightly toward caution (undervaluation needs to be real to score high).
 */
function valueSignal(dcf: DcfResult): number {
  // Negative or zero owner earnings makes the DCF unreliable — neutralize it.
  if (dcf.baseOwnerEarnings <= 0) return 0;
  return clamp(dcf.upsideDownside / 0.4, -1, 1);
}

function labelFromScore(score: number): RatingLabel {
  if (score >= 0.5) return "Strong Buy";
  if (score >= 0.15) return "Buy";
  if (score > -0.15) return "Hold";
  if (score > -0.5) return "Sell";
  return "Strong Sell";
}

/**
 * Confidence falls when the signals disagree (high spread) or when underlying
 * data is thin (few price bars / few social posts / DCF unreliable).
 */
function computeConfidence(
  signals: number[],
  dcf: DcfResult,
  momentum: MomentumSignals,
  social: SocialBuzz
): number {
  const mean = signals.reduce((s, x) => s + x, 0) / signals.length;
  const variance = signals.reduce((s, x) => s + (x - mean) ** 2, 0) / signals.length;
  const agreement = 1 - clamp(Math.sqrt(variance), 0, 1); // 1 = all agree

  let dataQuality = 1;
  if (dcf.baseOwnerEarnings <= 0) dataQuality -= 0.25;
  if (momentum.notes.some((n) => n.includes("unreliable"))) dataQuality -= 0.25;
  if (social.postCount < 8) dataQuality -= 0.15;
  dataQuality = clamp(dataQuality, 0.2, 1);

  return clamp(0.5 * agreement + 0.5 * dataQuality, 0, 1);
}

function rateHorizon(
  horizon: Horizon,
  signals: { value: number; momentum: number; options: number; social: number },
  confidence: number
): HorizonRating {
  const w = WEIGHTS[horizon];
  const contributions = {
    value: w.value * signals.value,
    momentum: w.momentum * signals.momentum,
    options: w.options * signals.options,
    social: w.social * signals.social,
  };
  const score = clamp(
    contributions.value + contributions.momentum + contributions.options + contributions.social,
    -1,
    1
  );
  const label = labelFromScore(score);

  // Rationale: name the single biggest driver (by absolute contribution).
  const drivers: Array<[string, number]> = [
    ["intrinsic value", contributions.value],
    ["price momentum", contributions.momentum],
    ["options posture", contributions.options],
    ["social buzz", contributions.social],
  ];
  drivers.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [topName, topVal] = drivers[0];
  const dir = topVal >= 0 ? "supportive" : "a drag";
  const horizonLabel = horizon === "6d" ? "6-day" : horizon === "30d" ? "30-day" : "1-year";
  const rationale = `${horizonLabel}: ${label}. Biggest factor is ${topName} (${dir}). Confidence ${Math.round(
    confidence * 100
  )}%.`;

  return { horizon, score, label, confidence, contributions, rationale };
}

/** Derive an asymmetric options-bet idea from vol regime + directional conviction. */
function buildAsymmetricBet(
  options: OptionsSentiment,
  momentum: MomentumSignals,
  value: number
): AsymmetricBet {
  // Directional conviction blends short-term momentum with the value signal.
  const directional = clamp(0.6 * momentum.score + 0.4 * value, -1, 1);
  const conviction = Math.abs(directional);

  const caveat =
    "Options are high-risk and can expire worthless. This is a derived idea from price/volatility only (no live options chain), not advice. Size small.";

  // Need a real directional lean to suggest anything.
  if (conviction < 0.25) {
    return {
      hasIdea: false,
      direction: "none",
      structure: "none",
      conviction,
      thesis: "No clear directional edge right now — signals are mixed, so no asymmetric setup stands out.",
      caveat,
    };
  }

  const direction = directional > 0 ? "bullish" : "bearish";
  const lowVol = options.volRegime === "low" || options.volRegime === "normal";

  // Low/normal IV → buying premium is cheaper, favor a long single option.
  // Elevated/high IV → premium is rich, favor a debit SPREAD to cut cost/theta.
  let structure: string;
  if (direction === "bullish") {
    structure = lowVol ? "long call (buy premium while IV is cheap)" : "call debit spread (defined risk, IV is rich)";
  } else {
    structure = lowVol ? "long put (buy premium while IV is cheap)" : "put debit spread (defined risk, IV is rich)";
  }

  const thesis =
    `${direction === "bullish" ? "Bullish" : "Bearish"} lean (conviction ${(conviction * 100).toFixed(0)}%) from ` +
    `${momentum.score >= 0 ? "positive" : "negative"} momentum and ${value >= 0 ? "undervaluation" : "overvaluation"} on the DCF, ` +
    `in a ${options.volRegime}-volatility regime${options.unusualActivity ? " with surging volume" : ""}.`;

  return { hasIdea: true, direction, structure, conviction, thesis, caveat };
}

export interface RatingInputs {
  dcf: DcfResult;
  snapshot: FinancialSnapshot;
  momentum: MomentumSignals;
  options: OptionsSentiment;
  social: SocialBuzz;
}

/** Produce the full multi-horizon rating bundle. */
export function rateStock(inputs: RatingInputs): StockRating {
  const { dcf, snapshot, momentum, options, social } = inputs;
  const signals = {
    value: valueSignal(dcf),
    momentum: momentum.score,
    options: options.score,
    social: social.score,
  };
  const confidence = computeConfidence(
    [signals.value, signals.momentum, signals.options, signals.social],
    dcf,
    momentum,
    social
  );

  const ratings: Record<Horizon, HorizonRating> = {
    "6d": rateHorizon("6d", signals, confidence),
    "30d": rateHorizon("30d", signals, confidence),
    "1y": rateHorizon("1y", signals, confidence),
  };

  return {
    ticker: dcf.ticker,
    name: dcf.name,
    ratings,
    asymmetricBet: buildAsymmetricBet(options, momentum, signals.value),
    inputs: { dcf, snapshot, momentum, options, social },
    generatedAt: Date.now(),
  };
}
