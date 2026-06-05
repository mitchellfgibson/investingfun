/**
 * Saved-stocks persistence — a simple file-based JSON store.
 *
 * Rationale: this is a personal, zero-cost tool. A file store (one JSON file
 * per saved stock under /data) needs no database, no hosting cost, and no
 * setup. It's intentionally behind a small interface so it can be swapped for
 * SQLite / Postgres / a KV store later without changing callers.
 *
 * Each saved entry stores the full StockRating snapshot AT SAVE TIME so the
 * user can revisit an analysis without re-spending API quota. A `savedAt`
 * timestamp makes it clear the data is a snapshot, not live.
 *
 * NOTE: file persistence is for local/self-hosted use. On serverless hosts
 * (e.g. Vercel) the filesystem is ephemeral — see README for swapping in a KV
 * store when deploying there.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { RatingLabel, StockRating } from "@/lib/ratings/types";

const DATA_DIR = path.join(process.cwd(), "data");

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

function fileFor(ticker: string): string {
  // Sanitize to a safe filename: uppercase alphanumerics + dot/dash only.
  const safe = ticker.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  return path.join(DATA_DIR, `${safe}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/** Save (or overwrite) a stock's analysis snapshot. */
export async function saveStock(rating: StockRating): Promise<SavedStock> {
  await ensureDir();
  const entry: SavedStock = {
    ticker: rating.ticker.toUpperCase(),
    name: rating.name,
    savedAt: Date.now(),
    rating,
  };
  await fs.writeFile(fileFor(entry.ticker), JSON.stringify(entry, null, 2), "utf8");
  return entry;
}

/** Load a single saved stock, or null if not saved. */
export async function getSavedStock(ticker: string): Promise<SavedStock | null> {
  try {
    const raw = await fs.readFile(fileFor(ticker), "utf8");
    return JSON.parse(raw) as SavedStock;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** Delete a saved stock. Returns true if something was deleted. */
export async function deleteStock(ticker: string): Promise<boolean> {
  try {
    await fs.unlink(fileFor(ticker));
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

/** List all saved stocks as lightweight summaries, newest-saved first. */
export async function listSavedStocks(): Promise<SavedStockSummary[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const entries = await Promise.all(
    jsonFiles.map(async (f) => {
      try {
        const raw = await fs.readFile(path.join(DATA_DIR, f), "utf8");
        const s = JSON.parse(raw) as SavedStock;
        return {
          ticker: s.ticker,
          name: s.name,
          savedAt: s.savedAt,
          ratings: {
            "6d": { label: s.rating.ratings["6d"].label, score: s.rating.ratings["6d"].score },
            "30d": { label: s.rating.ratings["30d"].label, score: s.rating.ratings["30d"].score },
            "1y": { label: s.rating.ratings["1y"].label, score: s.rating.ratings["1y"].score },
          },
        } satisfies SavedStockSummary;
      } catch {
        return null; // skip corrupt/partial files rather than failing the list
      }
    })
  );

  return entries
    .filter((e): e is SavedStockSummary => e !== null)
    .sort((a, b) => b.savedAt - a.savedAt);
}
