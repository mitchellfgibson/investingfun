/**
 * Gemini-powered analysis of social posts. Only runs if GEMINI_API_KEY is set.
 *
 * Gemini has a genuinely free tier, so this is the DEFAULT AI path (preferred
 * over Claude) — it makes the social-buzz summary $0/month. We use
 * gemini-2.0-flash and force structured JSON via responseSchema, which is more
 * reliable than prompt-only JSON. Talks to the REST API via fetch (no SDK).
 */

import type { SocialPost } from "./types";
import {
  AiSocialResult,
  SOCIAL_SYSTEM_PROMPT,
  extractJson,
  formatPostsForPrompt,
  normalizeResult,
} from "./aiShared";

const MODEL = "gemini-2.0-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export function geminiAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Analyze posts with Gemini. Throws if no key or on API/parse failure. */
export async function analyzeWithGemini(
  ticker: string,
  posts: SocialPost[]
): Promise<AiSocialResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Pass the key via header rather than the URL query string so it doesn't
      // leak into logs/error messages.
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SOCIAL_SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: formatPostsForPrompt(ticker, posts) }] }],
      generationConfig: {
        // Force structured JSON output matching our result schema.
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            score: { type: "number" },
            buzzLevel: { type: "string", enum: ["quiet", "normal", "loud"] },
            summary: { type: "string" },
          },
          required: ["score", "buzzLevel", "summary"],
        },
        maxOutputTokens: 400,
        temperature: 0.3,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Empty Gemini response");
  return normalizeResult(JSON.parse(extractJson(text)));
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}
