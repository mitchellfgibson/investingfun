/**
 * Shared pieces for AI-powered social-buzz analysis (Claude and Gemini both use
 * these), so the two analyzers stay consistent and only differ in transport.
 */

import type { SocialPost } from "./types";

/** The structured result every AI analyzer returns. */
export interface AiSocialResult {
  score: number;
  buzzLevel: "quiet" | "normal" | "loud";
  summary: string;
}

/** The analysis instructions, shared across models. */
export const SOCIAL_SYSTEM_PROMPT = `You are a markets-sentiment analyst. You read short social posts about a single stock ticker and judge the crowd's net sentiment.

Rules:
- Output ONLY a JSON object, no prose, no markdown fences.
- Schema: {"score": number in [-1,1], "buzzLevel": "quiet"|"normal"|"loud", "summary": string (<=240 chars, neutral & factual, no financial advice)}.
- score: -1 = strongly bearish crowd, 0 = mixed/neutral, +1 = strongly bullish crowd.
- buzzLevel: judge from the volume & intensity of chatter, not just sentiment.
- summary: describe what the crowd is saying and any notable themes (earnings, technicals, hype). Never tell the user to buy or sell.`;

/** Render the posts into a compact, cost-bounded prompt body. */
export function formatPostsForPrompt(ticker: string, posts: SocialPost[]): string {
  const lines = posts
    .slice(0, 40)
    .map((p, i) => {
      const tag = p.declaredSentiment ? `[${p.declaredSentiment}] ` : "";
      return `${i + 1}. ${tag}${p.text.replace(/\s+/g, " ").slice(0, 200)}`;
    })
    .join("\n");
  return `Ticker: ${ticker}\nRecent social posts:\n${lines}`;
}

/** Pull the first {...} block out of a model response, tolerating stray text. */
export function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object in AI response");
  }
  return text.slice(start, end + 1);
}

/** Clamp/validate a raw parsed object into a safe AiSocialResult. */
export function normalizeResult(parsed: unknown): AiSocialResult {
  const p = (parsed ?? {}) as Record<string, unknown>;
  const buzz = p.buzzLevel;
  return {
    score: Math.max(-1, Math.min(1, Number(p.score) || 0)),
    buzzLevel:
      buzz === "quiet" || buzz === "normal" || buzz === "loud" ? buzz : "normal",
    summary: String(p.summary ?? "").slice(0, 280),
  };
}
