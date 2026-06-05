/**
 * Financial Modeling Prep (FMP) data provider — uses the modern `/stable/`
 * endpoints (the legacy `/api/v3` endpoints were retired for keys created after
 * 2025-08-31). Free tier: ~250 requests/day with a free API key.
 *
 * Stable endpoints take the symbol as a `?symbol=` query param (not a path
 * segment) and return arrays. Field names verified against live AAPL data.
 *
 * Requires env var FMP_API_KEY. Base URL overridable via FMP_BASE_URL.
 */

import type { FinancialSnapshot } from "@/lib/dcf/types";
import {
  MarketDataProvider,
  PriceBar,
  ProviderRequestError,
  Quote,
  HistoryRange,
} from "./types";

const DEFAULT_BASE = "https://financialmodelingprep.com/stable";

/** Pick the first present, finite number from a list of candidate values. */
function num(...candidates: unknown[]): number {
  for (const c of candidates) {
    const n = typeof c === "string" ? Number(c) : (c as number);
    if (typeof n === "number" && Number.isFinite(n)) return n;
  }
  return 0;
}

export class FmpProvider implements MarketDataProvider {
  readonly name = "FMP";
  private readonly apiKey: string;
  private readonly base: string;

  constructor(apiKey = process.env.FMP_API_KEY, base = process.env.FMP_BASE_URL) {
    if (!apiKey) {
      throw new ProviderRequestError(
        "FMP",
        "Missing FMP_API_KEY. Add it to .env.local (get a free key at financialmodelingprep.com)."
      );
    }
    this.apiKey = apiKey;
    this.base = base || DEFAULT_BASE;
  }

  private url(path: string, params: Record<string, string | number> = {}): string {
    const u = new URL(`${this.base}${path}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    u.searchParams.set("apikey", this.apiKey);
    return u.toString();
  }

  private async fetchJson<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const res = await fetch(this.url(path, params), {
      // Cache fundamentals for an hour at the platform level (also conserves
      // the 250/day free quota); prices are short-lived but fine to cache briefly.
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      throw new ProviderRequestError("FMP", `GET ${path} failed`, res.status);
    }
    const data = (await res.json()) as T;
    if (data && typeof data === "object" && !Array.isArray(data) && "Error Message" in (data as object)) {
      throw new ProviderRequestError(
        "FMP",
        String((data as Record<string, unknown>)["Error Message"])
      );
    }
    return data;
  }

  async getFinancialSnapshot(ticker: string): Promise<FinancialSnapshot> {
    const symbol = ticker.toUpperCase();
    const [income, cashflow, balance, profileArr, metricsArr] = await Promise.all([
      this.fetchJson<FmpIncome[]>(`/income-statement`, { symbol, limit: 1 }),
      this.fetchJson<FmpCashflow[]>(`/cash-flow-statement`, { symbol, limit: 1 }),
      this.fetchJson<FmpBalance[]>(`/balance-sheet-statement`, { symbol, limit: 1 }),
      this.fetchJson<FmpProfile[]>(`/profile`, { symbol }),
      this.fetchJson<FmpKeyMetrics[]>(`/key-metrics-ttm`, { symbol }).catch(
        () => [] as FmpKeyMetrics[]
      ),
    ]);

    const inc = income[0];
    const cf = cashflow[0];
    const bs = balance[0];
    const profile = profileArr[0];
    const metrics = metricsArr[0];

    if (!inc || !cf || !bs || !profile) {
      throw new ProviderRequestError(
        "FMP",
        `Incomplete fundamentals for ${symbol} (common for ETFs, ADRs, or very new listings).`
      );
    }

    // FMP reports capex as a NEGATIVE number (cash outflow); engine wants it positive.
    const capex = Math.abs(num(cf.capitalExpenditure));
    // changeInWorkingCapital: FMP shows a *use* of cash as negative. Our engine
    // treats a working-capital increase (use of cash) as positive, so flip sign.
    const changeInWC = -num(cf.changeInWorkingCapital);

    const revenue = num(inc.revenue);
    const operatingMargin = revenue ? num(inc.operatingIncome) / revenue : undefined;

    return {
      ticker: symbol,
      name: profile.companyName || symbol,
      currency: profile.currency || inc.reportedCurrency || "USD",
      netIncome: num(inc.netIncome, inc.bottomLineNetIncome),
      depreciationAmortization: num(
        inc.depreciationAndAmortization,
        cf.depreciationAndAmortization
      ),
      capex,
      // maintenanceCapex left undefined → engine applies its default ratio.
      changeInWorkingCapital: changeInWC,
      totalDebt: num(bs.totalDebt, num(bs.shortTermDebt) + num(bs.longTermDebt)),
      cashAndEquivalents: num(bs.cashAndShortTermInvestments, bs.cashAndCashEquivalents),
      sharesOutstanding: num(inc.weightedAverageShsOutDil, inc.weightedAverageShsOut),
      currentPrice: num(profile.price),
      roic: metrics
        ? num(metrics.returnOnInvestedCapitalTTM, metrics.roicTTM) || undefined
        : undefined,
      operatingMargin,
    };
  }

  async getQuote(symbol: string): Promise<Quote> {
    const [q] = await this.fetchJson<FmpQuote[]>(`/quote`, { symbol: symbol.toUpperCase() });
    if (!q) throw new ProviderRequestError("FMP", `No quote for ${symbol}`);
    return this.mapQuote(q);
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    if (symbols.length === 0) return [];
    // The stable /quote endpoint is single-symbol; fan out in parallel.
    return Promise.all(symbols.map((s) => this.getQuote(s)));
  }

  private mapQuote(q: FmpQuote): Quote {
    const price = num(q.price);
    const change = num(q.change);
    const prev = price - change;
    return {
      symbol: q.symbol,
      name: q.name || q.symbol,
      price,
      change,
      changePercent: prev !== 0 ? change / prev : num(q.changePercentage) / 100,
      currency: "USD",
      asOf: Date.now(),
    };
  }

  async getPriceHistory(ticker: string, range: HistoryRange): Promise<PriceBar[]> {
    const { from, to } = rangeToDates(range);
    const rows = await this.fetchJson<FmpHistoricalRow[]>(
      `/historical-price-eod/full`,
      { symbol: ticker.toUpperCase(), from, to }
    );
    return (rows ?? [])
      .map((r) => ({
        date: new Date(r.date).getTime(),
        open: num(r.open),
        high: num(r.high),
        low: num(r.low),
        close: num(r.close),
        volume: num(r.volume),
      }))
      .sort((a, b) => a.date - b.date); // oldest-first
  }
}

function rangeToDates(range: HistoryRange): { from: string; to: string } {
  const days = { "1mo": 31, "3mo": 93, "6mo": 186, "1y": 366, "2y": 732, "5y": 1830 }[range];
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

// --- Minimal shapes for the FMP /stable fields we read (not exhaustive). ---
interface FmpIncome {
  revenue?: number;
  netIncome?: number;
  bottomLineNetIncome?: number;
  operatingIncome?: number;
  depreciationAndAmortization?: number;
  weightedAverageShsOut?: number;
  weightedAverageShsOutDil?: number;
  reportedCurrency?: string;
}
interface FmpCashflow {
  capitalExpenditure?: number;
  changeInWorkingCapital?: number;
  depreciationAndAmortization?: number;
}
interface FmpBalance {
  totalDebt?: number;
  shortTermDebt?: number;
  longTermDebt?: number;
  cashAndShortTermInvestments?: number;
  cashAndCashEquivalents?: number;
}
interface FmpProfile {
  companyName?: string;
  currency?: string;
  price?: number;
}
interface FmpKeyMetrics {
  returnOnInvestedCapitalTTM?: number;
  roicTTM?: number;
}
interface FmpQuote {
  symbol: string;
  name?: string;
  price?: number;
  change?: number;
  changePercentage?: number;
}
interface FmpHistoricalRow {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}
