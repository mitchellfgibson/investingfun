/**
 * Social-buzz orchestrator. Fetches free social posts, then scores them with
 * Claude if a key is present (richer summary), otherwise the free rule-based
 * scorer. Always returns a SocialBuzz; never throws on a source failure.
 */

import { fetchStockTwits } from "./sources";
import { scoreRuleBased } from "./sentiment";
import { analyzeWithClaude, claudeAvailable } from "./claude";
import type { SocialBuzz, SocialPost } from "./types";

function buzzLevelFromCount(n: number): SocialBuzz["buzzLevel"] {
  if (n < 8) return "quiet";
  if (n < 25) return "normal";
  return "loud";
}

export async function getSocialBuzz(ticker: string): Promise<SocialBuzz> {
  const notes: string[] = [];
  const st = await fetchStockTwits(ticker);
  if (!st.ok) notes.push(`StockTwits unavailable: ${st.error ?? "unknown error"}`);

  const posts: SocialPost[] = st.posts;
  const sample = posts.slice(0, 6);

  // Rule-based breakdown is always computed (cheap, also used for display).
  const rule = scoreRuleBased(posts);
  const breakdown = { bullish: rule.bullish, bearish: rule.bearish, neutral: rule.neutral };

  if (posts.length === 0) {
    return {
      ticker: ticker.toUpperCase(),
      postCount: 0,
      breakdown,
      score: 0,
      buzzLevel: "quiet",
      summary: "No recent social chatter found for this ticker.",
      analyzedBy: "rule-based",
      samplePosts: [],
      notes,
    };
  }

  const buzzLevel = buzzLevelFromCount(posts.length);

  // Try Claude for a richer score+summary; fall back to rule-based on any issue.
  if (claudeAvailable()) {
    try {
      const c = await analyzeWithClaude(ticker, posts);
      return {
        ticker: ticker.toUpperCase(),
        postCount: posts.length,
        breakdown,
        score: c.score,
        buzzLevel: c.buzzLevel,
        summary: c.summary,
        analyzedBy: "claude",
        samplePosts: sample,
        notes,
      };
    } catch (err) {
      notes.push(`Claude analysis failed, used rule-based instead: ${(err as Error).message}`);
    }
  }

  // Rule-based summary.
  const tilt =
    rule.score > 0.15 ? "leaning bullish" : rule.score < -0.15 ? "leaning bearish" : "mixed";
  const summary = `${posts.length} recent posts, ${tilt}: ${breakdown.bullish} bullish / ${breakdown.bearish} bearish / ${breakdown.neutral} neutral.`;

  return {
    ticker: ticker.toUpperCase(),
    postCount: posts.length,
    breakdown,
    score: rule.score,
    buzzLevel,
    summary,
    analyzedBy: "rule-based",
    samplePosts: sample,
    notes,
  };
}

export type { SocialBuzz, SocialPost } from "./types";
