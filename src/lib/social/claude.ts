/**
 * Optional Claude-powered analysis of social posts. Only runs if
 * ANTHROPIC_API_KEY is set. In this app Claude is the PREMIUM override —
 * Gemini's free tier is preferred (see index.ts for the precedence).
 *
 * Uses the cheapest capable model (Haiku) and prompt-caches the static system
 * prompt to keep cost minimal. Talks to the API via fetch (no SDK dependency).
 */

import type { SocialPost } from "./types";
import {
  AiSocialResult,
  SOCIAL_SYSTEM_PROMPT,
  extractJson,
  formatPostsForPrompt,
  normalizeResult,
} from "./aiShared";

const MODEL = "claude-haiku-4-5-20251001";
const API_URL = "https://api.anthropic.com/v1/messages";

export function claudeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Analyze posts with Claude. Throws if no key or on API/parse failure. */
export async function analyzeWithClaude(
  ticker: string,
  posts: SocialPost[]
): Promise<AiSocialResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

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
          text: SOCIAL_SYSTEM_PROMPT,
          // Cache the static system prompt across calls to cut cost.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: formatPostsForPrompt(ticker, posts) }],
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
  return normalizeResult(JSON.parse(extractJson(text)));
}
