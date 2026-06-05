/**
 * Rule-based sentiment scoring over normalized SocialPosts. This is the FREE
 * default (no Claude). It uses author-declared Bullish/Bearish tags where
 * present, and a small finance-tuned keyword lexicon to infer sentiment for
 * untagged posts.
 */

import type { SocialPost } from "./types";

const BULLISH_WORDS = [
  "buy", "long", "calls", "moon", "rocket", "bullish", "breakout", "rip",
  "undervalued", "strong", "beat", "upgrade", "rally", "squeeze", "support",
  "accumulate", "dip buy", "all in", "to the moon", "green",
];
const BEARISH_WORDS = [
  "sell", "short", "puts", "crash", "dump", "bearish", "breakdown", "tank",
  "overvalued", "weak", "miss", "downgrade", "selloff", "resistance", "bagholder",
  "rug", "rugpull", "red", "overbought", "bubble", "avoid",
];

export interface RuleScore {
  bullish: number;
  bearish: number;
  neutral: number;
  /** Net sentiment in [-1, 1]. */
  score: number;
}

/** Classify a single post: prefer the declared tag, else keyword inference. */
function classify(post: SocialPost): "bullish" | "bearish" | "neutral" {
  if (post.declaredSentiment) return post.declaredSentiment;
  const text = post.text.toLowerCase();
  let bull = 0;
  let bear = 0;
  for (const w of BULLISH_WORDS) if (text.includes(w)) bull++;
  for (const w of BEARISH_WORDS) if (text.includes(w)) bear++;
  if (bull > bear) return "bullish";
  if (bear > bull) return "bearish";
  return "neutral";
}

export function scoreRuleBased(posts: SocialPost[]): RuleScore {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  for (const p of posts) {
    const c = classify(p);
    if (c === "bullish") bullish++;
    else if (c === "bearish") bearish++;
    else neutral++;
  }
  const directional = bullish + bearish;
  // Net score ignores neutrals in the numerator but the magnitude is damped by
  // the share of neutral chatter (low-conviction crowds get pulled toward 0).
  const raw = directional > 0 ? (bullish - bearish) / directional : 0;
  const convictionWeight = posts.length > 0 ? directional / posts.length : 0;
  const score = raw * convictionWeight;
  return { bullish, bearish, neutral, score };
}
