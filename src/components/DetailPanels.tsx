import type { MomentumSignals } from "@/lib/analysis/momentum";
import type { OptionsSentiment } from "@/lib/analysis/options";
import type { SocialBuzz } from "@/lib/social/types";
import type { AsymmetricBet } from "@/lib/ratings/types";
import { fmtPct, fmtNum } from "@/lib/format";

export function MomentumPanel({ m }: { m: MomentumSignals }) {
  return (
    <div className="card">
      <h3>Momentum &amp; volume</h3>
      <Line label="5-day return" value={fmtPct(m.returns.d5)} good={m.returns.d5 >= 0} />
      <Line label="20-day return" value={fmtPct(m.returns.d20)} good={m.returns.d20 >= 0} />
      <Line label="60-day return" value={fmtPct(m.returns.d60)} good={m.returns.d60 >= 0} />
      <Line label="vs 200-day avg" value={fmtPct(m.trend.vsSma200)} good={m.trend.vsSma200 >= 0} />
      <Line label="Golden cross" value={m.trend.goldenCross ? "yes" : "no"} good={m.trend.goldenCross} />
      <Line label="RSI (14)" value={fmtNum(m.rsi14, 0)} good={m.rsi14 >= 30 && m.rsi14 <= 70} />
      <Line label="Volatility (ann.)" value={fmtPct(m.annualizedVolatility, 0)} />
      <Line label="Volume surge" value={`${fmtNum(m.volumeSurge, 1)}×`} good={m.volumeSurge >= 1} />
    </div>
  );
}

export function OptionsPanel({ o }: { o: OptionsSentiment }) {
  return (
    <div className="card">
      <h3>Options sentiment (proxy)</h3>
      <Line label="Skew" value={o.skew} good={o.skew === "bullish"} />
      <Line label="Vol regime" value={o.volRegime} />
      <Line label="Implied-vol proxy" value={fmtPct(o.impliedVolProxy, 0)} />
      <Line label="Put/call tilt" value={fmtNum(o.putCallTilt, 2)} good={o.putCallTilt >= 0} />
      <Line label="Unusual activity" value={o.unusualActivity ? "yes" : "no"} good={o.unusualActivity} />
      <p className="faint" style={{ fontSize: "0.72rem", marginTop: 8 }}>
        Derived from price/volatility — no live options-chain data on the free tier.
      </p>
    </div>
  );
}

export function SocialPanel({ s }: { s: SocialBuzz }) {
  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0 }}>Social buzz</h3>
        <span className="faint" style={{ fontSize: "0.72rem" }}>via {s.analyzedBy}</span>
      </div>
      <p style={{ fontSize: "0.9rem", margin: "10px 0" }}>{s.summary}</p>
      <Line label="Posts analyzed" value={String(s.postCount)} />
      <Line label="Buzz level" value={s.buzzLevel} />
      <Line label="Sentiment" value={fmtNum(s.score, 2)} good={s.score >= 0} />
      <div className="row" style={{ marginTop: 8, fontSize: "0.8rem" }}>
        <span className="green">▲ {s.breakdown.bullish}</span>
        <span className="dim">● {s.breakdown.neutral}</span>
        <span className="red">▼ {s.breakdown.bearish}</span>
      </div>
    </div>
  );
}

export function AsymmetricBetPanel({ bet }: { bet: AsymmetricBet }) {
  return (
    <div className="card" style={{ borderColor: bet.hasIdea ? "var(--accent-dim)" : "var(--border)" }}>
      <h3>Asymmetric options bet</h3>
      {bet.hasIdea ? (
        <>
          <div className="mono accent" style={{ fontSize: "1.05rem", fontWeight: 600 }}>
            {bet.direction.toUpperCase()} · {bet.structure}
          </div>
          <p style={{ fontSize: "0.88rem", margin: "10px 0" }}>{bet.thesis}</p>
          <Line label="Conviction" value={fmtPct(bet.conviction, 0)} good={bet.conviction >= 0.4} />
        </>
      ) : (
        <p className="dim" style={{ fontSize: "0.9rem" }}>{bet.thesis}</p>
      )}
      <p className="faint" style={{ fontSize: "0.72rem", marginTop: 10 }}>{bet.caveat}</p>
    </div>
  );
}

function Line({ label, value, good }: { label: string; value: string; good?: boolean }) {
  const cls = good === undefined ? "mono" : good ? "mono green" : "mono red";
  return (
    <div className="muted-line" style={{ fontSize: "0.85rem" }}>
      <span className="dim">{label}</span>
      <span className={cls}>{value}</span>
    </div>
  );
}
