// POST /api/upload — admin-only. Receives an updated data.xlsx, validates it parses,
// persists it to the storage adapter (Azure/Vercel Blob / fs), and returns the merge result.
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { mergeWorkbook } from "@/lib/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  if (!isAdmin(Date.now())) {
    return NextResponse.json({ ok: false, error: "Not signed in as admin." }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "File exceeds 10MB." }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // Validate by actually parsing/merging it before we persist anything.
  let newPeriods: string[];
  let warnings: string[];
  let stats;
  try {
    ({ newPeriods, warnings, stats } = mergeWorkbook(buf));
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Could not read workbook: " + (e as Error).message }, { status: 422 });
  }

  try {
    await getStorage().write(buf);
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Save failed: " + (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    newPeriods,
    warnings,
    stats,
    source: "live",
    savedAt: new Date().toISOString(),
  });
}
