/**
 * Single saved-stock endpoint.
 *   GET    /api/saved/AAPL  — load the full saved snapshot
 *   DELETE /api/saved/AAPL  — delete it
 */
import { NextResponse } from "next/server";
import { deleteStock, getSavedStock } from "@/lib/storage/savedStocks";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const stock = await getSavedStock(ticker);
  if (!stock) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ stock });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const deleted = await deleteStock(ticker);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
