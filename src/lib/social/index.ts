/**
 * Social-buzz orchestrator. Fetches free social posts, then scores them with an
 * AI model for a richer summary, falling back gracefully. Precedence:
 *
 *   Gemini (free tier)  →  Claude (premium override)  →  rule-based (always works)
 *
 * Gemini is preferred because its free tier makes the summary $0/month; Claude
 * runs only if Gemini is unavailable/fails but an ANTHROPIC_API_KEY is set.
 * Always returns a SocialBuzz; never throws on a source failure.
 */

import { fetchStockTwits } from "./sources";
import { scoreRuleBased } from "./sentiment";
import { analyzeWithClaude, claudeAvailable } from "./claude";
import { analyzeWithGemini, geminiAvailable } from "./gemini";
import type { AiSocialResult } from "./aiShared";
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

  // AI summary, preferring the free model. Each tier falls through to the next
  // on failure, so a bad key or API hiccup never breaks the page.
  const aiTiers: Array<{
    name: "gemini" | "claude";
    available: boolean;
    run: () => Promise<AiSocialResult>;
  }> = [
    { name: "gemini", available: geminiAvailable(), run: () => analyzeWithGemini(ticker, posts) },
    { name: "claude", available: claudeAvailable(), run: () => analyzeWithClaude(ticker, posts) },
  ];

  for (const tier of aiTiers) {
    if (!tier.available) continue;
    try {
      const ai = await tier.run();
      return {
        ticker: ticker.toUpperCase(),
        postCount: posts.length,
        breakdown,
        score: ai.score,
        buzzLevel: ai.buzzLevel,
        summary: ai.summary,
        analyzedBy: tier.name,
        samplePosts: sample,
        notes,
      };
    } catch (err) {
      notes.push(`${tier.name} analysis failed: ${(err as Error).message}`);
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
