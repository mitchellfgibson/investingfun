/**
 * Buffett-style two-stage DCF valuation engine.
 *
 * Design notes:
 * - "Buffett-style" here means we value the business on **owner earnings**
 *   (Warren Buffett's preferred cash measure) rather than reported EPS or raw
 *   free cash flow, and we apply an explicit **margin of safety** to derive a
 *   "buy below" price.
 *
 *   Owner earnings ≈ net income
 *                    + depreciation & amortization
 *                    - maintenance capex
 *                    - increase in working capital
 *
 *   (Buffett, 1986 Berkshire letter. We use *maintenance* capex, not total,
 *   because growth capex is discretionary investment, not a cost of keeping
 *   the existing earnings stream alive.)
 *
 * - The projection has two stages plus a terminal value:
 *     Stage 1: high growth at a constant rate for `stage1Years`.
 *     Stage 2: growth fades linearly from the stage-1 rate down to the
 *              terminal growth rate over `stage2Years` (a "fade" period —
 *              no company grows fast forever).
 *     Terminal: Gordon Growth perpetuity on the final-year owner earnings.
 *
 * - Everything is a pure function of (snapshot, assumptions). No I/O.
 */

import type {
  DcfAssumptions,
  DcfResult,
  FinancialSnapshot,
  ProjectedYear,
} from "./types";

/** If maintenance capex is unknown, assume this fraction of total capex. */
export const DEFAULT_MAINTENANCE_CAPEX_RATIO = 0.7;

/**
 * Compute Buffett's owner earnings from a financial snapshot.
 * Maintenance capex defaults to a fraction of total capex if not provided.
 */
export function computeOwnerEarnings(snapshot: FinancialSnapshot): number {
  const maintenanceCapex =
    snapshot.maintenanceCapex ??
    snapshot.capex * DEFAULT_MAINTENANCE_CAPEX_RATIO;
  const changeInWC = snapshot.changeInWorkingCapital ?? 0;
  return (
    snapshot.netIncome +
    snapshot.depreciationAmortization -
    maintenanceCapex -
    changeInWC
  );
}

/**
 * Derive conservative default assumptions from a snapshot. This gives the user
 * a sensible starting point they can then tune. We deliberately lean cautious
 * (Buffett would rather miss a buy than overpay).
 */
export function deriveDefaultAssumptions(
  snapshot: FinancialSnapshot
): DcfAssumptions {
  // Anchor stage-1 growth on recent profitability quality, but cap it.
  // A high-ROIC, high-margin business can compound faster; cap at 15% so we
  // never bake in heroic growth by default.
  const roic = snapshot.roic ?? 0.12;
  const qualityGrowth = Math.min(0.15, Math.max(0.04, roic * 0.6));

  return {
    stage1GrowthRate: qualityGrowth,
    stage1Years: 5,
    stage2Years: 5,
    terminalGrowthRate: 0.025, // ~ long-run GDP / inflation
    discountRate: 0.09, // conservative required return for equities
    marginOfSafety: 0.25, // classic 25% Graham/Buffett haircut
  };
}

/**
 * Build the year-by-year growth schedule:
 * - stage 1: constant `stage1GrowthRate`
 * - stage 2: linear fade from stage-1 rate to terminal rate
 */
function buildGrowthSchedule(a: DcfAssumptions): number[] {
  const schedule: number[] = [];
  for (let i = 0; i < a.stage1Years; i++) {
    schedule.push(a.stage1GrowthRate);
  }
  for (let i = 1; i <= a.stage2Years; i++) {
    // Linear interpolation from stage1 rate (at fade start) to terminal rate
    // (at fade end). fraction goes from just above 0 to 1.
    const fraction = i / a.stage2Years;
    const rate =
      a.stage1GrowthRate +
      (a.terminalGrowthRate - a.stage1GrowthRate) * fraction;
    schedule.push(rate);
  }
  return schedule;
}

/**
 * Run the full valuation. Returns a complete DcfResult including the explicit
 * projection, terminal value, intrinsic per-share value, and buy-below price.
 *
 * @param snapshot   Company financials + market data.
 * @param overrides  Optional assumption overrides; anything omitted falls back
 *                   to deriveDefaultAssumptions(snapshot).
 */
export function runDcf(
  snapshot: FinancialSnapshot,
  overrides: Partial<DcfAssumptions> = {}
): DcfResult {
  const warnings: string[] = [];
  const defaults = deriveDefaultAssumptions(snapshot);
  const a: DcfAssumptions = { ...defaults, ...overrides };

  // --- Guardrails on assumptions ---
  if (a.terminalGrowthRate >= a.discountRate) {
    warnings.push(
      `Terminal growth (${pct(a.terminalGrowthRate)}) >= discount rate (${pct(
        a.discountRate
      )}). Gordon Growth is invalid; clamping terminal growth below discount rate.`
    );
    a.terminalGrowthRate = a.discountRate - 0.01;
  }

  const baseOwnerEarnings =
    a.baseOwnerEarnings ?? computeOwnerEarnings(snapshot);

  if (baseOwnerEarnings <= 0) {
    warnings.push(
      "Base owner earnings is zero or negative — a DCF is unreliable for unprofitable / pre-cash-flow companies. Treat the intrinsic value with deep skepticism."
    );
  }
  if (snapshot.sharesOutstanding <= 0) {
    warnings.push("Shares outstanding is missing or zero; per-share value cannot be computed.");
  }

  // --- Explicit projection (stage 1 + stage 2 fade) ---
  const growthSchedule = buildGrowthSchedule(a);
  const projection: ProjectedYear[] = [];
  let oe = baseOwnerEarnings;
  let pvOfExplicitPeriod = 0;

  growthSchedule.forEach((growthRate, idx) => {
    const year = idx + 1;
    oe = oe * (1 + growthRate);
    const discountFactor = 1 / Math.pow(1 + a.discountRate, year);
    const presentValue = oe * discountFactor;
    pvOfExplicitPeriod += presentValue;
    projection.push({ year, growthRate, ownerEarnings: oe, discountFactor, presentValue });
  });

  // --- Terminal value (Gordon Growth on the final projected year) ---
  const finalYear = projection[projection.length - 1];
  const finalOwnerEarnings = finalYear ? finalYear.ownerEarnings : baseOwnerEarnings;
  const terminalValue =
    (finalOwnerEarnings * (1 + a.terminalGrowthRate)) /
    (a.discountRate - a.terminalGrowthRate);
  const terminalDiscountFactor =
    finalYear ? finalYear.discountFactor : 1 / Math.pow(1 + a.discountRate, 1);
  const pvOfTerminalValue = terminalValue * terminalDiscountFactor;

  // --- Bridge to equity value ---
  const enterpriseValue = pvOfExplicitPeriod + pvOfTerminalValue;
  const netDebt = snapshot.totalDebt - snapshot.cashAndEquivalents;
  const equityValue = enterpriseValue - netDebt;
  const intrinsicValuePerShare =
    snapshot.sharesOutstanding > 0
      ? equityValue / snapshot.sharesOutstanding
      : 0;

  const upsideDownside =
    snapshot.currentPrice > 0
      ? (intrinsicValuePerShare - snapshot.currentPrice) / snapshot.currentPrice
      : 0;
  const buyBelowPrice = intrinsicValuePerShare * (1 - a.marginOfSafety);

  const totalValue = enterpriseValue;
  const terminalValueWeight =
    totalValue !== 0 ? pvOfTerminalValue / totalValue : 0;

  if (terminalValueWeight > 0.75) {
    warnings.push(
      `${pct(terminalValueWeight)} of value sits in the terminal value — the result is highly sensitive to the terminal growth & discount rate assumptions.`
    );
  }

  return {
    ticker: snapshot.ticker,
    name: snapshot.name,
    currency: snapshot.currency,
    baseOwnerEarnings,
    projection,
    pvOfExplicitPeriod,
    terminalValue,
    pvOfTerminalValue,
    enterpriseValue,
    equityValue,
    intrinsicValuePerShare,
    currentPrice: snapshot.currentPrice,
    upsideDownside,
    buyBelowPrice,
    terminalValueWeight,
    assumptions: {
      baseOwnerEarnings,
      stage1GrowthRate: a.stage1GrowthRate,
      stage1Years: a.stage1Years,
      stage2Years: a.stage2Years,
      terminalGrowthRate: a.terminalGrowthRate,
      discountRate: a.discountRate,
      marginOfSafety: a.marginOfSafety,
    },
    warnings,
  };
}

/** Format a decimal as a percent string for warning messages. */
function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
