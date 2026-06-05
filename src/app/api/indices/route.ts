/** GET /api/indices — live quotes for the major indices (front-page strip). */
import { NextResponse } from "next/server";
import { getIndexQuotes } from "@/lib/indices";

export const revalidate = 60; // cache 60s — indices don't need sub-minute freshness

export async function GET() {
  try {
    const quotes = await getIndexQuotes();
    return NextResponse.json({ quotes });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to load indices", quotes: [] },
      { status: 502 }
    );
  }
}
