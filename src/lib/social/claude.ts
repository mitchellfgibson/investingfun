/**
 * Optional Claude-powered analysis of social posts. Only runs if
 * ANTHROPIC_API_KEY is set; otherwise callers use the rule-based path.
 *
 * Uses the cheapest capable model (Haiku) and prompt-caches the static system
 * prompt to keep cost minimal — important given the project's ~$10/mo budget.
 * Talks to the API via fetch (no SDK dependency).
 */

import type { SocialPost } from "./types";

const MODEL = "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `You are a markets-sentiment analyst. You read short social posts about a single stock ticker and judge the crowd's net sentiment.

Rules:
- Output ONLY a JSON object, no prose, no markdown fences.
- Schema: {"score": number in [-1,1], "buzzLevel": "quiet"|"normal"|"loud", "summary": string (<=240 chars, neutral & factual, no financial advice)}.
- score: -1 = strongly bearish crowd, 0 = mixed/neutral, +1 = strongly bullish crowd.
- buzzLevel: judge from the volume & intensity of chatter, not just sentiment.
- summary: describe what the crowd is saying and any notable themes (earnings, technicals, hype). Never tell the user to buy or sell.`;

export function claudeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface ClaudeSocialResult {
  score: number;
  buzzLevel: "quiet" | "normal" | "loud";
  summary: string;
}

/** Analyze posts with Claude. Throws if no key or on API/parse failure. */
export async function analyzeWithClaude(
  ticker: string,
  posts: SocialPost[]
): Promise<ClaudeSocialResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // Keep the prompt small (cost): cap and trim posts.
  const lines = posts
    .slice(0, 40)
    .map((p, i) => {
      const tag = p.declaredSentiment ? `[${p.declaredSentiment}] ` : "";
      return `${i + 1}. ${tag}${p.text.replace(/\s+/g, " ").slice(0, 200)}`;
    })
    .join("\n");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // Cache the static system prompt across calls to cut cost.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Ticker: ${ticker}\nRecent social posts:\n${lines}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  const parsed = JSON.parse(extractJson(text)) as ClaudeSocialResult;

  // Clamp/validate.
  return {
    score: Math.max(-1, Math.min(1, Number(parsed.score) || 0)),
    buzzLevel: ["quiet", "normal", "loud"].includes(parsed.buzzLevel)
      ? parsed.buzzLevel
      : "normal",
    summary: String(parsed.summary ?? "").slice(0, 280),
  };
}

/** Pull the first {...} block out of a model response, tolerating stray text. */
function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object in Claude response");
  }
  return text.slice(start, end + 1);
}
