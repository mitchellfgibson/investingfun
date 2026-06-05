/**
 * Free social-data sources. Currently StockTwits (no key, returns messages with
 * author-declared Bullish/Bearish tags). Reddit now requires OAuth and FMP news
 * is paid-tier, so they're omitted; both can be added here later behind the same
 * SocialPost shape without changing downstream code.
 */

import type { SocialPost } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

interface StFetchResult {
  posts: SocialPost[];
  ok: boolean;
  error?: string;
}

/** Fetch recent StockTwits messages for a ticker and normalize them. */
export async function fetchStockTwits(ticker: string): Promise<StFetchResult> {
  const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(
    ticker.toUpperCase()
  )}.json`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 600 }, // 10-min cache; chatter doesn't change second-to-second
    });
    if (!res.ok) {
      return { posts: [], ok: false, error: `StockTwits HTTP ${res.status}` };
    }
    const data = (await res.json()) as StResponse;
    const posts: SocialPost[] = (data.messages ?? []).map((m) => ({
      source: "stocktwits",
      text: m.body ?? "",
      declaredSentiment: mapSentiment(m.entities?.sentiment?.basic),
      createdAt: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
      url: m.id ? `https://stocktwits.com/message/${m.id}` : undefined,
    }));
    return { posts, ok: true };
  } catch (err) {
    return { posts: [], ok: false, error: (err as Error).message };
  }
}

function mapSentiment(basic?: string): "bullish" | "bearish" | undefined {
  if (basic === "Bullish") return "bullish";
  if (basic === "Bearish") return "bearish";
  return undefined;
}

interface StResponse {
  messages?: Array<{
    id?: number;
    body?: string;
    created_at?: string;
    entities?: { sentiment?: { basic?: string } | null };
  }>;
}
