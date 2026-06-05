/**
 * Domain types for the Buffett-style DCF valuation engine.
 *
 * The engine is intentionally pure: it takes a fully-specified set of
 * financial inputs + assumptions and returns a valuation. It never fetches
 * data itself — that's the data-provider layer's job. This keeps the
 * valuation logic deterministic and unit-testable.
 */

/**
 * The raw financial facts about a company that the DCF needs as a starting
 * point. These come from the data-provider layer (most-recent fiscal year,
 * unless noted). All monetary values are in the company's reporting currency,
 * absolute units (not millions).
 */
export interface FinancialSnapshot {
  ticker: string;
  /** Company display name. */
  name: string;
  /** Reporting currency, e.g. "USD". */
  currency: string;

  // --- Cash-flow building blocks (Buffett's "owner earnings") ---
  /** Net income (trailing twelve months or latest FY). */
  netIncome: number;
  /** Depreciation & amortization. */
  depreciationAmortization: number;
  /** Capital expenditures (reported as a positive number here). */
  capex: number;
  /**
   * Maintenance capex estimate. Buffett's owner earnings uses *maintenance*
   * capex (what's needed to sustain the business), not total capex which
   * includes growth investment. If unknown, callers may default this to a
   * fraction of total capex (see DEFAULT_MAINTENANCE_CAPEX_RATIO).
   */
  maintenanceCapex?: number;
  /** Change in non-cash working capital (increase = cash use = positive). */
  changeInWorkingCapital?: number;

  // --- Balance sheet (for equity bridge & sanity) ---
  /** Total debt (short + long term). */
  totalDebt: number;
  /** Cash & short-term investments. */
  cashAndEquivalents: number;
  /** Diluted shares outstanding. */
  sharesOutstanding: number;

  // --- Market data ---
  /** Current share price. */
  currentPrice: number;

  // --- Optional quality signals (used for sanity flags, not the core math) ---
  /** Return on invested capital, as a decimal (0.15 = 15%). */
  roic?: number;
  /** Operating margin, as a decimal. */
  operatingMargin?: number;
}

/**
 * The assumptions that drive the projection. These are the "knobs" a user
 * edits. Defaults are derived conservatively (see deriveDefaultAssumptions).
 */
export interface DcfAssumptions {
  /**
   * Starting owner-earnings figure to project forward. If omitted, the engine
   * computes it from the FinancialSnapshot via the owner-earnings formula.
   */
  baseOwnerEarnings?: number;

  /** Annual growth rate for the high-growth stage, as a decimal (0.10 = 10%). */
  stage1GrowthRate: number;
  /** Number of years in the high-growth stage. */
  stage1Years: number;

  /**
   * Growth rate for the fade/transition stage. Growth linearly fades from
   * stage1GrowthRate toward the terminal growth rate over these years.
   */
  stage2Years: number;

  /** Perpetual (terminal) growth rate, as a decimal. Must be < discountRate. */
  terminalGrowthRate: number;

  /** Discount rate (WACC or required return), as a decimal. */
  discountRate: number;

  /**
   * Margin of safety, as a decimal (0.25 = 25%). The "buy below" price is the
   * intrinsic value haircut by this amount.
   */
  marginOfSafety: number;
}

/** One year of the explicit projection. */
export interface ProjectedYear {
  year: number;
  growthRate: number;
  ownerEarnings: number;
  discountFactor: number;
  presentValue: number;
}

/** The complete output of a valuation run. */
export interface DcfResult {
  ticker: string;
  name: string;
  currency: string;

  /** The owner-earnings figure the projection started from. */
  baseOwnerEarnings: number;

  /** Year-by-year explicit projection (stage 1 + stage 2). */
  projection: ProjectedYear[];

  /** Sum of present values of the explicit projection years. */
  pvOfExplicitPeriod: number;

  /** Undiscounted terminal value at the end of the explicit period. */
  terminalValue: number;
  /** Present value of the terminal value. */
  pvOfTerminalValue: number;

  /** Enterprise value = PV(explicit) + PV(terminal). */
  enterpriseValue: number;
  /** Equity value = EV - net debt. */
  equityValue: number;
  /** Intrinsic value per share. */
  intrinsicValuePerShare: number;

  /** Current market price (echoed for convenience). */
  currentPrice: number;
  /** (intrinsic - price) / price, as a decimal. Positive = undervalued. */
  upsideDownside: number;

  /** Price at/below which to buy, given the margin of safety. */
  buyBelowPrice: number;

  /** Fraction of total value coming from the terminal value (0..1). */
  terminalValueWeight: number;

  /** The assumptions used (post-defaulting), for transparency/reproducibility. */
  assumptions: Required<Omit<DcfAssumptions, "baseOwnerEarnings">> & {
    baseOwnerEarnings: number;
  };

  /** Human-readable sanity warnings (e.g. negative owner earnings). */
  warnings: string[];
}
