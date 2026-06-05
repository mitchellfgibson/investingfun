# investingfun

A personal investing analysis website. Feed in a ticker and get a **Buffett-style
DCF**, **price momentum & volume** analysis, an **options-sentiment proxy**, and
**social buzz** — fused into **buy ratings across 6-day, 30-day, and 1-year
horizons**, plus an **asymmetric options-bet** idea. Save analyses, delete them,
and export a live-formula DCF to Google Sheets.

> Educational tool, not financial advice.

## Quick start

```bash
npm install
cp .env.local.example .env.local   # add your FMP_API_KEY
npm run dev                        # http://localhost:3000
```

Without an `FMP_API_KEY` the app runs on **sample data** so you can click around.
Get a free key (250 req/day) at <https://site.financialmodelingprep.com>.

```bash
npm test          # unit tests for the DCF, momentum, and ratings engines
npm run build     # production build
```

## How it works

```
ticker ─▶ provider layer ─▶ ┌ DCF engine (owner earnings, 2-stage + terminal)
        (FMP /stable,       ├ momentum (returns, RSI, golden cross, vol surge)
         pluggable)         ├ options proxy (vol regime + directional skew)
                            └ social buzz (StockTwits; Claude if key present)
                                        │
                                        ▼
                            ratings engine (per-horizon weighting)
                              ├ 6d / 30d / 1y buy ratings + confidence
                              └ asymmetric options-bet idea
```

- **DCF** — values the business on Warren Buffett's *owner earnings*
  (NI + D&A − maintenance capex − ΔWC), a two-stage growth projection with a
  linear fade to a Gordon-Growth terminal value, then a margin-of-safety
  "buy below" price. The DCF page is **interactive** — drag the assumption
  sliders and the valuation recomputes live (the engine is pure TS, so it runs
  in the browser).
- **Ratings** — the same four signals are weighted differently per horizon:
  short horizons lean on momentum/buzz/options; the 1-year leans on intrinsic
  value. Confidence drops when signals disagree or data is thin.

## Configuration (all optional)

| Env var | Effect |
| --- | --- |
| `FMP_API_KEY` | Live fundamentals & prices (else sample data) |
| `GEMINI_API_KEY` | Social buzz summary via Gemini (free tier) — the preferred AI path |
| `ANTHROPIC_API_KEY` | Premium override: used only if Gemini is absent/fails. Else free rule-based |
| `GOOGLE_SERVICE_ACCOUNT_FILE` / `_JSON` | Enables "Export DCF to Google Sheets" — see [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md) |

The social-buzz AI precedence is **Gemini → Claude → rule-based**: it prefers
Gemini's free tier ($0), uses Claude only as a fallback if a Claude key is set,
and always works (rule-based) with no keys at all.

## Known limitations (free-tier honesty)

- **Options sentiment is a proxy** derived from price/volatility — real options
  chains (put/call, IV skew) aren't on the free data tier. The architecture lets
  a paid options provider slot in behind `MarketDataProvider`.
- **Social buzz is StockTwits-only** for now. Real X/Twitter API is ~$200/mo;
  Reddit now requires OAuth. Both can be added behind the `SocialPost` shape.
- **Saved stocks use a local file store** (`/data`). On serverless hosts (Vercel)
  the filesystem is ephemeral — swap in a KV store before deploying there.

## Roadmap

- Phase 2: a multivariable linear regression predicting 10-day moves, fine-tuned
  on historical data. (Not yet built.)
