/** Shared types for the social-buzz subsystem. */

/** A normalized social post from any source. */
export interface SocialPost {
  source: "stocktwits" | "news" | "other";
  text: string;
  /** Author-declared sentiment if the source provides one. */
  declaredSentiment?: "bullish" | "bearish";
  createdAt: number;
  url?: string;
}

export interface SocialBuzz {
  ticker: string;
  /** How many posts we analyzed. */
  postCount: number;
  /** Bullish/bearish/neutral counts (from declared tags + inference). */
  breakdown: { bullish: number; bearish: number; neutral: number };
  /** Net sentiment in [-1, 1]. Positive = bullish buzz. */
  score: number;
  /** "quiet" | "normal" | "loud" — rough volume of chatter. */
  buzzLevel: "quiet" | "normal" | "loud";
  /** A short narrative summary. From Claude if available, else rule-based. */
  summary: string;
  /** Which engine produced the summary/score. */
  analyzedBy: "claude" | "rule-based";
  /** A few representative posts for display. */
  samplePosts: SocialPost[];
  notes: string[];
}
