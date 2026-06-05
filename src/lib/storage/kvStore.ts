/**
 * Vercel KV (Upstash Redis) saved-stock store — for the deployed/serverless
 * site, where the filesystem is ephemeral and a file store would silently lose
 * data.
 *
 * Layout:
 *   stock:<TICKER>   -> the full SavedStock JSON
 *   stocks:index     -> a Redis SET of saved tickers (for listing)
 *
 * Active only when KV env vars are present (KV_REST_API_URL + KV_REST_API_TOKEN),
 * which Vercel injects when you attach a KV/Upstash database. The @vercel/kv
 * client reads those env vars automatically.
 */

import { kv } from "@vercel/kv";
import type { StockRating } from "@/lib/ratings/types";
import {
  SavedStock,
  SavedStockStore,
  SavedStockSummary,
  normalizeTicker,
  toSummary,
} from "./types";

const INDEX_KEY = "stocks:index";
const keyFor = (ticker: string) => `stock:${normalizeTicker(ticker)}`;

export function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export class KvStore implements SavedStockStore {
  async save(rating: StockRating): Promise<SavedStock> {
    const ticker = normalizeTicker(rating.ticker);
    const entry: SavedStock = { ticker, name: rating.name, savedAt: Date.now(), rating };
    // Store the full entry and register the ticker in the index set.
    await Promise.all([kv.set(keyFor(ticker), entry), kv.sadd(INDEX_KEY, ticker)]);
    return entry;
  }

  async get(ticker: string): Promise<SavedStock | null> {
    // @vercel/kv auto-deserializes JSON values.
    return (await kv.get<SavedStock>(keyFor(ticker))) ?? null;
  }

  async delete(ticker: string): Promise<boolean> {
    const t = normalizeTicker(ticker);
    const removed = await kv.del(keyFor(t));
    await kv.srem(INDEX_KEY, t);
    return removed > 0;
  }

  async list(): Promise<SavedStockSummary[]> {
    const tickers = await kv.smembers<string[]>(INDEX_KEY);
    if (!tickers || tickers.length === 0) return [];
    const entries = await Promise.all(tickers.map((t) => this.get(t)));
    return entries
      .filter((e): e is SavedStock => e !== null)
      .map(toSummary)
      .sort((a, b) => b.savedAt - a.savedAt);
  }
}
