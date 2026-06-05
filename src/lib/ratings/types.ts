/** Types for the multi-horizon ratings engine. */

import type { DcfResult, FinancialSnapshot } from "@/lib/dcf/types";
import type { MomentumSignals } from "@/lib/analysis/momentum";
import type { OptionsSentiment } from "@/lib/analysis/options";
import type { SocialBuzz } from "@/lib/social/types";

export type Horizon = "6d" | "30d" | "1y";

export type RatingLabel =
  | "Strong Buy"
  | "Buy"
  | "Hold"
  | "Sell"
  | "Strong Sell";

/** A rating for a single time horizon. */
export interface HorizonRating {
  horizon: Horizon;
  /** Composite score in [-1, 1] driving the label. */
  score: number;
  label: RatingLabel;
  /** 0..1 confidence (lower when signals disagree or data is thin). */
  confidence: number;
  /** The weighted contributions, for transparency. */
  contributions: {
    value: number;
    momentum: number;
    options: number;
    social: number;
  };
  /** Short plain-English rationale. */
  rationale: string;
}

/** An asymmetric options-bet idea (directional, defined-risk framing). */
export interface AsymmetricBet {
  /** Whether a compelling asymmetric setup was found. */
  hasIdea: boolean;
  direction: "bullish" | "bearish" | "none";
  /** e.g. "long call", "long put", "call debit spread". */
  structure: string;
  /** Rough conviction in [0,1]. */
  conviction: number;
  /** Why this setup — references vol regime & directional signals. */
  thesis: string;
  /** Risk caveat shown to the user. */
  caveat: string;
}

/** The full analysis bundle returned to the UI. */
export interface StockRating {
  ticker: string;
  name: string;
  ratings: Record<Horizon, HorizonRating>;
  asymmetricBet: AsymmetricBet;
  /** The inputs, echoed so the UI can show detail panels. */
  inputs: {
    dcf: DcfResult;
    /** Raw fundamentals — lets the client re-run the DCF live when assumptions change. */
    snapshot: FinancialSnapshot;
    momentum: MomentumSignals;
    options: OptionsSentiment;
    social: SocialBuzz;
  };
  /** When this rating was produced (unix ms). */
  generatedAt: number;
}
