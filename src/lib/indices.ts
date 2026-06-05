/** Major market indices shown on the front page. */
import { getProvider } from "@/lib/providers";
import type { Quote } from "@/lib/providers/types";

/** Symbols FMP/most providers use for the big US indices. */
export const INDEX_SYMBOLS = ["^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX"] as const;

const FRIENDLY: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^DJI": "Dow Jones",
  "^IXIC": "Nasdaq",
  "^RUT": "Russell 2000",
  "^VIX": "VIX",
};

export async function getIndexQuotes(): Promise<Quote[]> {
  const provider = getProvider();
  const quotes = await provider.getQuotes([...INDEX_SYMBOLS]);
  return quotes.map((q) => ({ ...q, name: FRIENDLY[q.symbol] ?? q.name }));
}
