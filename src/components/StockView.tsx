"use client";

import Link from "next/link";
import type { StockRating } from "@/lib/ratings/types";
import { fmtPrice, fmtPct } from "@/lib/format";
import { RatingCard } from "./RatingCard";
import { DcfPanel } from "./DcfPanel";
import { ActionBar } from "./ActionBar";
import {
  MomentumPanel,
  OptionsPanel,
  SocialPanel,
  AsymmetricBetPanel,
} from "./DetailPanels";

/** Full client-side view of a stock's analysis bundle. */
export function StockView({ data }: { data: StockRating }) {
  const { inputs } = data;
  const price = inputs.dcf.currentPrice;
  const change1y = inputs.momentum.returns.d120; // ~6mo proxy display

  return (
    <main className="stack" style={{ gap: 20 }}>
      <Link href="/" className="faint" style={{ fontSize: "0.85rem" }}>
        ← back
      </Link>

      <div className="row" style={{ flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1>
            <span className="mono">{data.ticker}</span>{" "}
            <span className="dim" style={{ fontSize: "1.1rem", fontWeight: 400 }}>
              {data.name}
            </span>
          </h1>
          <div className="mono" style={{ fontSize: "1.2rem", marginTop: 4 }}>
            {fmtPrice(price, inputs.dcf.currency)}{" "}
            <span className="faint" style={{ fontSize: "0.85rem" }}>
              (6-mo {fmtPct(change1y)})
            </span>
          </div>
        </div>
        <ActionBar ticker={data.ticker} />
      </div>

      {/* Ratings across horizons */}
      <section className="grid-3">
        <RatingCard rating={data.ratings["6d"]} />
        <RatingCard rating={data.ratings["30d"]} />
        <RatingCard rating={data.ratings["1y"]} />
      </section>

      {/* Interactive DCF */}
      <DcfPanel snapshot={inputs.snapshot} initial={inputs.dcf.assumptions} />

      {/* Asymmetric bet */}
      <AsymmetricBetPanel bet={data.asymmetricBet} />

      {/* Detail panels */}
      <section className="grid-3">
        <MomentumPanel m={inputs.momentum} />
        <OptionsPanel o={inputs.options} />
        <SocialPanel s={inputs.social} />
      </section>

      <p className="faint" style={{ fontSize: "0.75rem", textAlign: "center" }}>
        Educational tool, not financial advice. Ratings combine a DCF, price
        momentum, an options-sentiment proxy, and social buzz. Data may be
        delayed or incomplete.
      </p>
    </main>
  );
}
