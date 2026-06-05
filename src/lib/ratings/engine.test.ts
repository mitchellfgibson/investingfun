import { describe, expect, it } from "vitest";
import { rateStock, type RatingInputs } from "./engine";
import type { DcfResult, FinancialSnapshot } from "@/lib/dcf/types";
import type { MomentumSignals } from "@/lib/analysis/momentum";
import type { OptionsSentiment } from "@/lib/analysis/options";
import type { SocialBuzz } from "@/lib/social/types";

function dcf(upside: number, ownerEarnings = 1000): DcfResult {
  return {
    ticker: "T", name: "T Co", currency: "USD",
    baseOwnerEarnings: ownerEarnings,
    projection: [], pvOfExplicitPeriod: 0, terminalValue: 0, pvOfTerminalValue: 0,
    enterpriseValue: 0, equityValue: 0, intrinsicValuePerShare: 0,
    currentPrice: 100, upsideDownside: upside, buyBelowPrice: 0, terminalValueWeight: 0.5,
    assumptions: {
      baseOwnerEarnings: ownerEarnings, stage1GrowthRate: 0.1, stage1Years: 5,
      stage2Years: 5, terminalGrowthRate: 0.025, discountRate: 0.09, marginOfSafety: 0.25,
    },
    warnings: [],
  };
}

function momentum(score: number): MomentumSignals {
  return {
    lastClose: 100,
    returns: { d5: 0, d20: 0, d60: score * 0.2, d120: 0 },
    sma: { d20: 100, d50: 100, d200: 100 },
    trend: { vsSma50: 0, vsSma200: score * 0.15, goldenCross: score > 0 },
    rsi14: 50 + score * 20,
    annualizedVolatility: 0.3,
    volumeSurge: 1,
    score,
    notes: [],
  };
}

function options(score: number): OptionsSentiment {
  return {
    isProxy: true, impliedVolProxy: 0.3, volRegime: "normal",
    skew: score > 0 ? "bullish" : score < 0 ? "bearish" : "neutral",
    putCallTilt: score, unusualActivity: false, score, notes: [],
  };
}

function social(score: number, postCount = 30): SocialBuzz {
  return {
    ticker: "T", postCount,
    breakdown: { bullish: 10, bearish: 5, neutral: 15 },
    score, buzzLevel: "normal", summary: "", analyzedBy: "rule-based", samplePosts: [], notes: [],
  };
}

const snapshot: FinancialSnapshot = {
  ticker: "T", name: "T Co", currency: "USD",
  netIncome: 1000, depreciationAmortization: 100, capex: 100,
  totalDebt: 0, cashAndEquivalents: 0, sharesOutstanding: 100, currentPrice: 100,
};

function inputs(v: number, m: number, o: number, s: number): RatingInputs {
  return { dcf: dcf(v), snapshot, momentum: momentum(m), options: options(o), social: social(s) };
}

describe("rateStock — horizon weighting", () => {
  it("1y rating tracks intrinsic value; 6d tracks momentum", () => {
    // Undervalued (value +) but weak momentum (momentum -).
    const r = rateStock(inputs(0.8, -0.6, -0.3, -0.2));
    // 1y leans on value -> should be more bullish than 6d which leans momentum.
    expect(r.ratings["1y"].score).toBeGreaterThan(r.ratings["6d"].score);
  });

  it("6d rating tracks momentum when value is flat", () => {
    const bull = rateStock(inputs(0, 0.9, 0.5, 0.5));
    const bear = rateStock(inputs(0, -0.9, -0.5, -0.5));
    expect(bull.ratings["6d"].score).toBeGreaterThan(0.3);
    expect(bear.ratings["6d"].score).toBeLessThan(-0.3);
  });

  it("produces sensible labels at the extremes", () => {
    const strongBuy = rateStock(inputs(1, 1, 1, 1));
    const strongSell = rateStock(inputs(-1, -1, -1, -1));
    expect(strongBuy.ratings["1y"].label).toBe("Strong Buy");
    expect(strongSell.ratings["1y"].label).toBe("Strong Sell");
  });

  it("scores stay within [-1, 1]", () => {
    const r = rateStock(inputs(1, 1, 1, 1));
    for (const h of ["6d", "30d", "1y"] as const) {
      expect(r.ratings[h].score).toBeLessThanOrEqual(1);
      expect(r.ratings[h].score).toBeGreaterThanOrEqual(-1);
    }
  });
});

describe("rateStock — value signal guarding", () => {
  it("neutralizes the value signal when owner earnings are non-positive", () => {
    const bad = rateStock({ ...inputs(0.9, 0, 0, 0), dcf: dcf(0.9, -500) });
    // With value neutralized and everything else 0, the 1y score should be ~0.
    expect(Math.abs(bad.ratings["1y"].score)).toBeLessThan(0.05);
  });
});

describe("rateStock — confidence", () => {
  it("is lower when signals strongly disagree", () => {
    const agree = rateStock(inputs(0.5, 0.5, 0.5, 0.5));
    const disagree = rateStock(inputs(0.9, -0.9, 0.9, -0.9));
    expect(disagree.ratings["1y"].confidence).toBeLessThan(agree.ratings["1y"].confidence);
  });

  it("is lower with thin social data", () => {
    const thick = rateStock(inputs(0.5, 0.5, 0.5, 0.5));
    const thin = rateStock({ ...inputs(0.5, 0.5, 0.5, 0.5), social: social(0.5, 2) });
    expect(thin.ratings["1y"].confidence).toBeLessThan(thick.ratings["1y"].confidence);
  });
});

describe("rateStock — asymmetric bet", () => {
  it("suggests a bullish structure on strong bullish conviction", () => {
    const r = rateStock(inputs(0.8, 0.8, 0.5, 0.5));
    expect(r.asymmetricBet.hasIdea).toBe(true);
    expect(r.asymmetricBet.direction).toBe("bullish");
    expect(r.asymmetricBet.structure.toLowerCase()).toContain("call");
  });

  it("suggests no idea when signals are mixed", () => {
    const r = rateStock(inputs(0.05, 0.05, 0, 0));
    expect(r.asymmetricBet.hasIdea).toBe(false);
    expect(r.asymmetricBet.direction).toBe("none");
  });

  it("uses a spread when implied vol is high", () => {
    const hv: OptionsSentiment = { ...options(0.5), volRegime: "high", impliedVolProxy: 0.7 };
    const r = rateStock({ ...inputs(0.8, 0.8, 0.5, 0.5), options: hv });
    expect(r.asymmetricBet.structure.toLowerCase()).toContain("spread");
  });
});
