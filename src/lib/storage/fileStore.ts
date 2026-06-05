/**
 * File-based saved-stock store (one JSON file per stock under /data).
 * Used for local development / self-hosting. NOT suitable for serverless hosts
 * (Vercel) where the filesystem is ephemeral — the KV store covers that.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { StockRating } from "@/lib/ratings/types";
import {
  SavedStock,
  SavedStockStore,
  SavedStockSummary,
  normalizeTicker,
  toSummary,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function fileFor(ticker: string): string {
  return path.join(DATA_DIR, `${normalizeTicker(ticker)}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export class FileStore implements SavedStockStore {
  async save(rating: StockRating): Promise<SavedStock> {
    await ensureDir();
    const entry: SavedStock = {
      ticker: normalizeTicker(rating.ticker),
      name: rating.name,
      savedAt: Date.now(),
      rating,
    };
    await fs.writeFile(fileFor(entry.ticker), JSON.stringify(entry, null, 2), "utf8");
    return entry;
  }

  async get(ticker: string): Promise<SavedStock | null> {
    try {
      const raw = await fs.readFile(fileFor(ticker), "utf8");
      return JSON.parse(raw) as SavedStock;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(ticker: string): Promise<boolean> {
    try {
      await fs.unlink(fileFor(ticker));
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw err;
    }
  }

  async list(): Promise<SavedStockSummary[]> {
    await ensureDir();
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const entries = await Promise.all(
      jsonFiles.map(async (f) => {
        try {
          const raw = await fs.readFile(path.join(DATA_DIR, f), "utf8");
          return toSummary(JSON.parse(raw) as SavedStock);
        } catch {
          return null; // skip corrupt/partial files rather than failing the list
        }
      })
    );

    return entries
      .filter((e): e is SavedStockSummary => e !== null)
      .sort((a, b) => b.savedAt - a.savedAt);
  }
}
