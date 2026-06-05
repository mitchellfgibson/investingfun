/** GET /api/analyze?ticker=AAPL  — full multi-horizon analysis of a stock. */
import { NextRequest, NextResponse } from "next/server";
import { analyzeStock } from "@/lib/ratings/analyze";

export const dynamic = "force-dynamic"; // always fresh; providers handle their own caching

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim();
  if (!ticker) {
    return NextResponse.json({ error: "Missing ?ticker= parameter" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9.\-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker format" }, { status: 400 });
  }
  try {
    const rating = await analyzeStock(ticker);
    return NextResponse.json(rating);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Analysis failed" },
      { status: 502 }
    );
  }
}
