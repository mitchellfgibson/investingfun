/**
 * Saved-stocks persistence — public API used by the API routes.
 *
 * Picks the right backend automatically:
 *   - Vercel KV (Upstash) when KV env vars are present (i.e. on the deployed
 *     site with a KV database attached) — survives serverless restarts.
 *   - Local JSON file store otherwise (local dev / self-hosting).
 *
 * The store is chosen behind this module so callers never change. Each saved
 * entry holds the full StockRating snapshot AT SAVE TIME, so revisiting a saved
 * stock doesn't re-spend API quota.
 */

import type { StockRating } from "@/lib/ratings/types";
import { FileStore } from "./fileStore";
import { KvStore, kvConfigured } from "./kvStore";
import type { SavedStock, SavedStockStore, SavedStockSummary } from "./types";

let store: SavedStockStore | null = null;

function getStore(): SavedStockStore {
  if (!store) store = kvConfigured() ? new KvStore() : new FileStore();
  return store;
}

/** True when running against the cloud KV store (vs. the local file store). */
export function usingKv(): boolean {
  return kvConfigured();
}

export function saveStock(rating: StockRating): Promise<SavedStock> {
  return getStore().save(rating);
}
export function getSavedStock(ticker: string): Promise<SavedStock | null> {
  return getStore().get(ticker);
}
export function deleteStock(ticker: string): Promise<boolean> {
  return getStore().delete(ticker);
}
export function listSavedStocks(): Promise<SavedStockSummary[]> {
  return getStore().list();
}

export type { SavedStock, SavedStockSummary } from "./types";
