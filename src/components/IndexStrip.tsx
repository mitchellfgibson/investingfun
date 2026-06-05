import type { Quote } from "@/lib/providers/types";
import { fmtPct, changeColor } from "@/lib/format";

/** Horizontal strip of major index quotes for the front page. */
export function IndexStrip({ quotes }: { quotes: Quote[] }) {
  if (!quotes.length) {
    return <div className="index-strip dim">Market data unavailable right now.</div>;
  }
  return (
    <div className="index-strip">
      {quotes.map((q) => (
        <div className="index-item" key={q.symbol}>
          <span className="index-name">{q.name}</span>
          <span className="index-val">
            {q.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
          <span className={`index-chg ${changeColor(q.changePercent)}`}>
            {fmtPct(q.changePercent)}
          </span>
        </div>
      ))}
    </div>
  );
}
