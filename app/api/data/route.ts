// GET /api/data — returns the merged dataset as JSON (built-in seed + any uploaded months).
// The xlsx is parsed server-side here; the browser never touches SheetJS.
import { NextResponse } from "next/server";
import { getCurrentDataset } from "@/lib/dataset";
import type { DataResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, source, newPeriods } = await getCurrentDataset();
  const body: DataResponse = { ...data, source, newPeriods };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
