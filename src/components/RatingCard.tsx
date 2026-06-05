import type { HorizonRating } from "@/lib/ratings/types";
import { pillClass } from "@/lib/format";

const HORIZON_LABEL: Record<string, string> = {
  "6d": "6 days",
  "30d": "30 days",
  "1y": "1 year",
};

/** A single horizon's rating with a signed score bar and contribution breakdown. */
export function RatingCard({ rating }: { rating: HorizonRating }) {
  const pctScore = (rating.score + 1) / 2; // map [-1,1] -> [0,1]
  const color =
    rating.score > 0.15 ? "var(--green)" : rating.score < -0.15 ? "var(--red)" : "var(--amber)";

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0 }}>{HORIZON_LABEL[rating.horizon]}</h3>
        <span className={pillClass(rating.label)}>{rating.label}</span>
      </div>

      <div style={{ margin: "14px 0 6px" }}>
        <div className="bar-track" style={{ height: 10 }}>
          {/* center marker */}
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--text-faint)" }} />
          <div
            className="bar-fill"
            style={{
              width: `${Math.abs(rating.score) * 50}%`,
              marginLeft: rating.score >= 0 ? "50%" : `${50 - Math.abs(rating.score) * 50}%`,
              background: color,
            }}
          />
        </div>
        <div className="row" style={{ marginTop: 4, fontSize: "0.78rem" }}>
          <span className="faint">bearish</span>
          <span className="mono dim">score {rating.score.toFixed(2)}</span>
          <span className="faint">bullish</span>
        </div>
      </div>

      <div className="dim" style={{ fontSize: "0.8rem", marginTop: 8 }}>
        Confidence {Math.round(rating.confidence * 100)}%
      </div>

      <details style={{ marginTop: 10 }}>
        <summary className="faint" style={{ cursor: "pointer", fontSize: "0.8rem" }}>
          factor breakdown
        </summary>
        <div style={{ marginTop: 8 }}>
          {Object.entries(rating.contributions).map(([k, v]) => (
            <div className="muted-line" key={k} style={{ fontSize: "0.82rem" }}>
              <span className="dim">{k}</span>
              <span className={`mono ${v > 0 ? "green" : v < 0 ? "red" : "dim"}`}>
                {v >= 0 ? "+" : ""}
                {v.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
