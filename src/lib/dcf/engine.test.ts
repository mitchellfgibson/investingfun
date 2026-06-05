import { describe, expect, it } from "vitest";
import {
  computeOwnerEarnings,
  deriveDefaultAssumptions,
  runDcf,
  DEFAULT_MAINTENANCE_CAPEX_RATIO,
} from "./engine";
import type { DcfAssumptions, FinancialSnapshot } from "./types";

/** A simple, clean snapshot for deterministic math checks. */
function baseSnapshot(overrides: Partial<FinancialSnapshot> = {}): FinancialSnapshot {
  return {
    ticker: "TEST",
    name: "Test Co",
    currency: "USD",
    netIncome: 100,
    depreciationAmortization: 20,
    capex: 30,
    maintenanceCapex: 20, // explicit, so no defaulting
    changeInWorkingCapital: 0,
    totalDebt: 0,
    cashAndEquivalents: 0,
    sharesOutstanding: 100,
    currentPrice: 10,
    ...overrides,
  };
}

describe("computeOwnerEarnings", () => {
  it("uses NI + D&A - maintenance capex - ΔWC", () => {
    // 100 + 20 - 20 - 0 = 100
    expect(computeOwnerEarnings(baseSnapshot())).toBe(100);
  });

  it("subtracts change in working capital", () => {
    // 100 + 20 - 20 - 15 = 85
    expect(computeOwnerEarnings(baseSnapshot({ changeInWorkingCapital: 15 }))).toBe(85);
  });

  it("defaults maintenance capex to a fraction of total capex when absent", () => {
    const snap = baseSnapshot({ maintenanceCapex: undefined, capex: 50 });
    // maintenance = 50 * 0.7 = 35 → 100 + 20 - 35 - 0 = 85
    expect(computeOwnerEarnings(snap)).toBe(
      100 + 20 - 50 * DEFAULT_MAINTENANCE_CAPEX_RATIO - 0
    );
  });
});

describe("runDcf — analytic checks", () => {
  it("discounts a flat (zero-growth) stream correctly", () => {
    // With 0% growth in both stages and a clean balance sheet, the PV of the
    // explicit period is a finite geometric sum we can compute by hand.
    const snap = baseSnapshot(); // owner earnings = 100
    const a: Partial<DcfAssumptions> = {
      stage1GrowthRate: 0,
      stage1Years: 5,
      stage2Years: 0,
      terminalGrowthRate: 0,
      discountRate: 0.1,
      marginOfSafety: 0,
    };
    const r = runDcf(snap, a);

    // Each year owner earnings stays 100 (growth 0). PV = 100/1.1^t for t=1..5.
    const expectedExplicit = [1, 2, 3, 4, 5].reduce(
      (sum, t) => sum + 100 / Math.pow(1.1, t),
      0
    );
    expect(r.pvOfExplicitPeriod).toBeCloseTo(expectedExplicit, 6);

    // Terminal value with g=0: TV = OE_final * (1+0) / (0.1 - 0) = 100 / 0.1 = 1000,
    // discounted by 1/1.1^5.
    const expectedPvTv = 1000 / Math.pow(1.1, 5);
    expect(r.pvOfTerminalValue).toBeCloseTo(expectedPvTv, 6);

    expect(r.enterpriseValue).toBeCloseTo(expectedExplicit + expectedPvTv, 6);
  });

  it("net debt reduces equity value; net cash increases it", () => {
    const withDebt = runDcf(baseSnapshot({ totalDebt: 500, cashAndEquivalents: 0 }), {
      stage1GrowthRate: 0,
      stage2Years: 0,
    });
    const withCash = runDcf(baseSnapshot({ totalDebt: 0, cashAndEquivalents: 500 }), {
      stage1GrowthRate: 0,
      stage2Years: 0,
    });
    // Cash version should have exactly 1000 more equity value (500 + 500 swing).
    expect(withCash.equityValue - withDebt.equityValue).toBeCloseTo(1000, 6);
  });

  it("computes per-share value = equityValue / shares", () => {
    const r = runDcf(baseSnapshot({ sharesOutstanding: 50 }), {
      stage1GrowthRate: 0,
      stage2Years: 0,
    });
    expect(r.intrinsicValuePerShare).toBeCloseTo(r.equityValue / 50, 6);
  });

  it("applies margin of safety to the buy-below price", () => {
    const r = runDcf(baseSnapshot(), { marginOfSafety: 0.3 });
    expect(r.buyBelowPrice).toBeCloseTo(r.intrinsicValuePerShare * 0.7, 6);
  });

  it("computes upside/downside vs current price", () => {
    const r = runDcf(baseSnapshot({ currentPrice: 10 }), {
      stage1GrowthRate: 0,
      stage2Years: 0,
    });
    const expected = (r.intrinsicValuePerShare - 10) / 10;
    expect(r.upsideDownside).toBeCloseTo(expected, 6);
  });

  it("higher discount rate lowers intrinsic value (monotonicity)", () => {
    const low = runDcf(baseSnapshot(), { discountRate: 0.08 });
    const high = runDcf(baseSnapshot(), { discountRate: 0.12 });
    expect(high.intrinsicValuePerShare).toBeLessThan(low.intrinsicValuePerShare);
  });

  it("higher growth raises intrinsic value (monotonicity)", () => {
    const slow = runDcf(baseSnapshot(), { stage1GrowthRate: 0.05 });
    const fast = runDcf(baseSnapshot(), { stage1GrowthRate: 0.12 });
    expect(fast.intrinsicValuePerShare).toBeGreaterThan(slow.intrinsicValuePerShare);
  });
});

describe("runDcf — guardrails & warnings", () => {
  it("clamps terminal growth >= discount rate and warns", () => {
    const r = runDcf(baseSnapshot(), {
      terminalGrowthRate: 0.12,
      discountRate: 0.1,
    });
    expect(r.assumptions.terminalGrowthRate).toBeLessThan(r.assumptions.discountRate);
    expect(r.warnings.some((w) => w.includes("Gordon Growth"))).toBe(true);
  });

  it("warns on non-positive owner earnings", () => {
    const r = runDcf(baseSnapshot({ netIncome: -200 }));
    expect(r.warnings.some((w) => w.toLowerCase().includes("owner earnings"))).toBe(true);
  });

  it("warns when terminal value dominates", () => {
    // Long fast-growth + low discount pushes weight into the terminal value.
    const r = runDcf(baseSnapshot(), {
      stage1GrowthRate: 0.15,
      stage1Years: 10,
      terminalGrowthRate: 0.04,
      discountRate: 0.06,
    });
    expect(r.terminalValueWeight).toBeGreaterThan(0.5);
  });
});

describe("deriveDefaultAssumptions", () => {
  it("caps default stage-1 growth at 15%", () => {
    const a = deriveDefaultAssumptions(baseSnapshot({ roic: 0.9 }));
    expect(a.stage1GrowthRate).toBeLessThanOrEqual(0.15);
  });

  it("floors default stage-1 growth at 4%", () => {
    const a = deriveDefaultAssumptions(baseSnapshot({ roic: 0.01 }));
    expect(a.stage1GrowthRate).toBeGreaterThanOrEqual(0.04);
  });
});
