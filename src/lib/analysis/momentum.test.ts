import { describe, expect, it } from "vitest";
import { analyzeMomentum, rsi, annualizedVolatility } from "./momentum";
import type { PriceBar } from "@/lib/providers/types";

/** Build bars from a list of closes (oldest-first), with flat volume. */
function barsFromCloses(closes: number[], volumes?: number[]): PriceBar[] {
  const now = Date.now();
  return closes.map((c, i) => ({
    date: now - (closes.length - 1 - i) * 86_400_000,
    open: c,
    high: c,
    low: c,
    close: c,
    volume: volumes ? volumes[i] : 1_000_000,
  }));
}

describe("rsi", () => {
  it("returns 100 for a strictly rising series (no losses)", () => {
    const bars = barsFromCloses(Array.from({ length: 30 }, (_, i) => 100 + i));
    expect(rsi(bars, 14)).toBe(100);
  });

  it("returns a low value for a strictly falling series", () => {
    const bars = barsFromCloses(Array.from({ length: 30 }, (_, i) => 100 - i));
    expect(rsi(bars, 14)).toBeLessThan(5);
  });

  it("returns 50 with insufficient data", () => {
    expect(rsi(barsFromCloses([100, 101]), 14)).toBe(50);
  });
});

describe("annualizedVolatility", () => {
  it("is zero for a perfectly flat series", () => {
    expect(annualizedVolatility(barsFromCloses(Array(30).fill(100)))).toBe(0);
  });

  it("is positive for a volatile series", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + (i % 2 === 0 ? 5 : -5));
    expect(annualizedVolatility(barsFromCloses(closes))).toBeGreaterThan(0);
  });
});

describe("analyzeMomentum", () => {
  it("flags insufficient history", () => {
    const m = analyzeMomentum(barsFromCloses([100, 101, 102]));
    expect(m.notes.some((n) => n.includes("unreliable"))).toBe(true);
  });

  it("scores a strong uptrend positively with a golden cross", () => {
    const closes = Array.from({ length: 220 }, (_, i) => 100 + i); // steady climb
    const m = analyzeMomentum(barsFromCloses(closes));
    expect(m.score).toBeGreaterThan(0.3);
    expect(m.trend.goldenCross).toBe(true);
    expect(m.returns.d60).toBeGreaterThan(0);
  });

  it("scores a downtrend negatively", () => {
    const closes = Array.from({ length: 220 }, (_, i) => 300 - i); // steady decline
    const m = analyzeMomentum(barsFromCloses(closes));
    expect(m.score).toBeLessThan(-0.3);
    expect(m.trend.goldenCross).toBe(false);
  });

  it("detects a volume surge", () => {
    const closes = Array.from({ length: 70 }, () => 100);
    const volumes = closes.map((_, i) => (i >= 60 ? 5_000_000 : 1_000_000));
    const m = analyzeMomentum(barsFromCloses(closes, volumes));
    expect(m.volumeSurge).toBeGreaterThan(2);
  });

  it("keeps the composite score within [-1, 1]", () => {
    const closes = Array.from({ length: 220 }, (_, i) => 100 * 1.05 ** i); // explosive
    const m = analyzeMomentum(barsFromCloses(closes));
    expect(m.score).toBeLessThanOrEqual(1);
    expect(m.score).toBeGreaterThanOrEqual(-1);
  });
});
