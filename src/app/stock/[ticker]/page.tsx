import Link from "next/link";
import { analyzeStock } from "@/lib/ratings/analyze";
import { StockView } from "@/components/StockView";

export const dynamic = "force-dynamic";

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const sym = decodeURIComponent(ticker).toUpperCase();

  if (!/^[A-Z0-9.\-]{1,12}$/.test(sym)) {
    return <ErrorView ticker={sym} message="Invalid ticker format." />;
  }

  try {
    const data = await analyzeStock(sym);
    return <StockView data={data} />;
  } catch (err) {
    return <ErrorView ticker={sym} message={(err as Error).message} />;
  }
}

function ErrorView({ ticker, message }: { ticker: string; message: string }) {
  return (
    <main className="stack" style={{ gap: 16 }}>
      <Link href="/" className="faint" style={{ fontSize: "0.85rem" }}>
        ← back
      </Link>
      <div className="card">
        <h2>Couldn’t analyze {ticker}</h2>
        <p className="dim">{message}</p>
        <p className="faint" style={{ fontSize: "0.85rem" }}>
          This often happens for ETFs, ADRs, very new listings, or if the data
          provider hit a rate limit. Try another ticker.
        </p>
      </div>
    </main>
  );
}
