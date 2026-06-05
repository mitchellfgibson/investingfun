/**
 * Market-data provider abstraction.
 *
 * The whole app talks to data through this interface, NOT to any specific
 * vendor. That lets us start on free tiers and swap/upgrade providers (or mix
 * them — e.g. Yahoo for live prices, FMP for fundamentals) without touching
 * the DCF engine, the rating logic, or the UI.
 *
 * Implementations live alongside this file (fmp.ts, yahoo.ts, mock.ts).
 */

import type { FinancialSnapshot } from "@/lib/dcf/types";

/** A single OHLCV price bar. */
export interface PriceBar {
  /** Unix ms timestamp of the bar. */
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** A lightweight live quote for tickers and index widgets. */
export interface Quote {
  symbol: string;
  name: string;
  price: number;
  /** Absolute change vs previous close. */
  change: number;
  /** Percent change vs previous close, as a decimal (0.012 = +1.2%). */
  changePercent: number;
  currency: string;
  /** Unix ms of the quote. */
  asOf: number;
}

export type HistoryRange = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";

/**
 * The contract every data provider implements. Not every provider supports
 * every method — unsupported methods should throw ProviderUnsupportedError so
 * a composite provider can fall back to another source.
 */
export interface MarketDataProvider {
  /** Human-readable provider name, for logging/diagnostics. */
  readonly name: string;

  /** Fetch the financial snapshot the DCF engine needs. */
  getFinancialSnapshot(ticker: string): Promise<FinancialSnapshot>;

  /** Fetch a single live quote. */
  getQuote(symbol: string): Promise<Quote>;

  /** Fetch many quotes at once (e.g. for the index strip). */
  getQuotes(symbols: string[]): Promise<Quote[]>;

  /** Fetch historical daily price bars for momentum/volume analysis. */
  getPriceHistory(ticker: string, range: HistoryRange): Promise<PriceBar[]>;
}

/** Thrown when a provider can't fulfil a method, so callers can fall back. */
export class ProviderUnsupportedError extends Error {
  constructor(providerName: string, method: string) {
    super(`Provider "${providerName}" does not support ${method}()`);
    this.name = "ProviderUnsupportedError";
  }
}

/** Thrown for upstream/API failures (network, bad key, rate limit, etc.). */
export class ProviderRequestError extends Error {
  constructor(
    public readonly providerName: string,
    message: string,
    public readonly status?: number
  ) {
    super(`[${providerName}] ${message}`);
    this.name = "ProviderRequestError";
  }
}
