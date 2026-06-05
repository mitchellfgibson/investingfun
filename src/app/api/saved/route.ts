/**
 * Saved stocks collection endpoint.
 *   GET  /api/saved        — list saved stocks (summaries)
 *   POST /api/saved        — save a stock: body { ticker } (re-analyzes & stores)
 */
import { NextRequest, NextResponse } from "next/server";
import { analyzeStock } from "@/lib/ratings/analyze";
import { listSavedStocks, saveStock } from "@/lib/storage/savedStocks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ stocks: await listSavedStocks() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let ticker: string | undefined;
  try {
    ({ ticker } = (await req.json()) as { ticker?: string });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!ticker || !/^[A-Za-z0-9.\-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ error: "Missing or invalid ticker" }, { status: 400 });
  }
  try {
    const rating = await analyzeStock(ticker);
    const saved = await saveStock(rating);
    return NextResponse.json({ saved }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
