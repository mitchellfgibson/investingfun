/** Shared types + the store interface for saved-stock persistence. */

import type { RatingLabel, StockRating } from "@/lib/ratings/types";

export interface SavedStock {
  ticker: string;
  name: string;
  savedAt: number;
  /** The full analysis snapshot captured when saved. */
  rating: StockRating;
}

/** A lightweight summary for list views (avoids loading every full snapshot). */
export interface SavedStockSummary {
  ticker: string;
  name: string;
  savedAt: number;
  ratings: {
    "6d": { label: RatingLabel; score: number };
    "30d": { label: RatingLabel; score: number };
    "1y": { label: RatingLabel; score: number };
  };
}

/**
 * The persistence contract. Implemented by both the local file store and the
 * Vercel KV store; callers (API routes) don't care which is active.
 */
export interface SavedStockStore {
  save(rating: StockRating): Promise<SavedStock>;
  get(ticker: string): Promise<SavedStock | null>;
  delete(ticker: string): Promise<boolean>;
  list(): Promise<SavedStockSummary[]>;
}

/** Normalize a ticker to a safe, consistent key. */
export function normalizeTicker(ticker: string): string {
  return ticker.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
}

/** Build a summary from a full saved entry. */
export function toSummary(s: SavedStock): SavedStockSummary {
  return {
    ticker: s.ticker,
    name: s.name,
    savedAt: s.savedAt,
    ratings: {
      "6d": { label: s.rating.ratings["6d"].label, score: s.rating.ratings["6d"].score },
      "30d": { label: s.rating.ratings["30d"].label, score: s.rating.ratings["30d"].score },
      "1y": { label: s.rating.ratings["1y"].label, score: s.rating.ratings["1y"].score },
    },
  };
}
