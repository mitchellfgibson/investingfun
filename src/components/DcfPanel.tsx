"use client";

import { useMemo, useState } from "react";
import { runDcf } from "@/lib/dcf/engine";
import type { DcfAssumptions, FinancialSnapshot } from "@/lib/dcf/types";
import { fmtMoney, fmtPct, fmtPrice } from "@/lib/format";

/**
 * Interactive Buffett-style DCF. Because the engine is a pure function, we
 * re-run it CLIENT-SIDE as the user drags the assumption sliders — instant
 * live recompute, no server round-trip.
 */
export function DcfPanel({
  snapshot,
  initial,
}: {
  snapshot: FinancialSnapshot;
  initial: Required<Omit<DcfAssumptions, "baseOwnerEarnings">> & { baseOwnerEarnings: number };
}) {
  const [a, setA] = useState<DcfAssumptions>({
    stage1GrowthRate: initial.stage1GrowthRate,
    stage1Years: initial.stage1Years,
    stage2Years: initial.stage2Years,
    terminalGrowthRate: initial.terminalGrowthRate,
    discountRate: initial.discountRate,
    marginOfSafety: initial.marginOfSafety,
  });

  const result = useMemo(() => runDcf(snapshot, a), [snapshot, a]);
  const c = result.currency;
  const upColor = result.upsideDownside > 0 ? "green" : "red";

  function set<K extends keyof DcfAssumptions>(key: K, value: number) {
    setA((prev) => ({ ...prev, [key]: value }));
  }
  function reset() {
    setA({
      stage1GrowthRate: initial.stage1GrowthRate,
      stage1Years: initial.stage1Years,
      stage2Years: initial.stage2Years,
      terminalGrowthRate: initial.terminalGrowthRate,
      discountRate: initial.discountRate,
      marginOfSafety: initial.marginOfSafety,
    });
  }

  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Buffett-style DCF</h2>
        <button onClick={reset} style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
          Reset
        </button>
      </div>

      <div className="grid-2" style={{ marginTop: 16, alignItems: "start" }}>
        {/* Left: live result */}
        <div className="stack">
          <Big label="Intrinsic value / share" value={fmtPrice(result.intrinsicValuePerShare, c)} />
          <div className="muted-line">
            <span className="dim">Current price</span>
            <span className="mono">{fmtPrice(result.currentPrice, c)}</span>
          </div>
          <div className="muted-line">
            <span className="dim">Upside / downside</span>
            <span className={`mono ${upColor}`}>{fmtPct(result.upsideDownside)}</span>
          </div>
          <div className="muted-line">
            <span className="dim">Buy below ({fmtPct(a.marginOfSafety!, 0)} MoS)</span>
            <span className="mono accent">{fmtPrice(result.buyBelowPrice, c)}</span>
          </div>
          <div className="muted-line">
            <span className="dim">Owner earnings (base)</span>
            <span className="mono">{fmtMoney(result.baseOwnerEarnings, c)}</span>
          </div>
          <div className="muted-line">
            <span className="dim">Enterprise value</span>
            <span className="mono">{fmtMoney(result.enterpriseValue, c)}</span>
          </div>
          <div className="muted-line">
            <span className="dim">Terminal value weight</span>
            <span className="mono">{fmtPct(result.terminalValueWeight, 0)}</span>
          </div>
        </div>

        {/* Right: assumption sliders */}
        <div className="stack">
          <Slider label="Stage-1 growth" value={a.stage1GrowthRate!} min={-0.1} max={0.4} step={0.005}
            display={fmtPct(a.stage1GrowthRate!)} onChange={(v) => set("stage1GrowthRate", v)} />
          <Slider label="Stage-1 years" value={a.stage1Years!} min={1} max={10} step={1}
            display={`${a.stage1Years} yr`} onChange={(v) => set("stage1Years", v)} />
          <Slider label="Fade years" value={a.stage2Years!} min={0} max={10} step={1}
            display={`${a.stage2Years} yr`} onChange={(v) => set("stage2Years", v)} />
          <Slider label="Terminal growth" value={a.terminalGrowthRate!} min={0} max={0.05} step={0.0025}
            display={fmtPct(a.terminalGrowthRate!)} onChange={(v) => set("terminalGrowthRate", v)} />
          <Slider label="Discount rate" value={a.discountRate!} min={0.04} max={0.15} step={0.0025}
            display={fmtPct(a.discountRate!)} onChange={(v) => set("discountRate", v)} />
          <Slider label="Margin of safety" value={a.marginOfSafety!} min={0} max={0.5} step={0.01}
            display={fmtPct(a.marginOfSafety!, 0)} onChange={(v) => set("marginOfSafety", v)} />
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {result.warnings.map((w, i) => (
            <p key={i} className="amber" style={{ fontSize: "0.8rem", margin: "4px 0" }}>
              ⚠ {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="faint" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div className="mono accent" style={{ fontSize: "1.8rem", fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

function Slider({
  label, value, min, max, step, display, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  display: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="row" style={{ fontSize: "0.85rem" }}>
        <span className="dim">{label}</span>
        <span className="mono">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent)", padding: 0 }}
      />
    </div>
  );
}
