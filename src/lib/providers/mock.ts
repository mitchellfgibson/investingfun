/**
 * Mock data provider — deterministic sample data so the whole app (DCF, ratings,
 * UI) works end-to-end with no API key. Used as a fallback when no real provider
 * is configured, and handy for tests/offline development.
 *
 * The numbers are plausible (loosely Apple-shaped) but NOT real or current.
 */

import type { FinancialSnapshot } from "@/lib/dcf/types";
import { MarketDataProvider, PriceBar, Quote, HistoryRange } from "./types";

const SAMPLE: Record<string, FinancialSnapshot> = {
  AAPL: {
    ticker: "AAPL",
    name: "Apple Inc. (SAMPLE DATA)",
    currency: "USD",
    netIncome: 97_000_000_000,
    depreciationAmortization: 11_500_000_000,
    capex: 11_000_000_000,
    changeInWorkingCapital: 2_000_000_000,
    totalDebt: 108_000_000_000,
    cashAndEquivalents: 62_000_000_000,
    sharesOutstanding: 15_300_000_000,
    currentPrice: 195,
    roic: 0.45,
    operatingMargin: 0.3,
  },
  MSFT: {
    ticker: "MSFT",
    name: "Microsoft Corp. (SAMPLE DATA)",
    currency: "USD",
    netIncome: 88_000_000_000,
    depreciationAmortization: 22_000_000_000,
    capex: 44_000_000_000,
    changeInWorkingCapital: 3_000_000_000,
    totalDebt: 47_000_000_000,
    cashAndEquivalents: 75_000_000_000,
    sharesOutstanding: 7_430_000_000,
    currentPrice: 420,
    roic: 0.29,
    operatingMargin: 0.44,
  },
};

export class MockProvider implements MarketDataProvider {
  readonly name = "Mock";

  async getFinancialSnapshot(ticker: string): Promise<FinancialSnapshot> {
    const sym = ticker.toUpperCase();
    const found = SAMPLE[sym];
    if (found) return found;
    // Synthesize a generic profitable company for any other ticker.
    return {
      ticker: sym,
      name: `${sym} (SAMPLE DATA)`,
      currency: "USD",
      netIncome: 5_000_000_000,
      depreciationAmortization: 1_000_000_000,
      capex: 1_200_000_000,
      changeInWorkingCapital: 200_000_000,
      totalDebt: 8_000_000_000,
      cashAndEquivalents: 4_000_000_000,
      sharesOutstanding: 1_000_000_000,
      currentPrice: 50,
      roic: 0.15,
      operatingMargin: 0.2,
    };
  }

  async getQuote(symbol: string): Promise<Quote> {
    const snap = await this.getFinancialSnapshot(symbol);
    return {
      symbol: snap.ticker,
      name: snap.name,
      price: snap.currentPrice,
      change: snap.currentPrice * 0.005,
      changePercent: 0.005,
      currency: "USD",
      asOf: Date.now(),
    };
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    return Promise.all(symbols.map((s) => this.getQuote(s)));
  }

  async getPriceHistory(_ticker: string, range: HistoryRange): Promise<PriceBar[]> {
    const days = { "1mo": 31, "3mo": 93, "6mo": 186, "1y": 366, "2y": 732, "5y": 1830 }[range];
    const bars: PriceBar[] = [];
    let price = 100;
    const now = Date.now();
    for (let i = days; i >= 0; i--) {
      // Deterministic pseudo-random walk (seeded by index) for stable tests.
      const wiggle = Math.sin(i * 0.3) * 1.5 + Math.cos(i * 0.11) * 0.8;
      price = Math.max(1, price + wiggle);
      bars.push({
        date: now - i * 86_400_000,
        open: price - 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1_000_000 + Math.round(Math.abs(wiggle) * 200_000),
      });
    }
    return bars;
  }
}
