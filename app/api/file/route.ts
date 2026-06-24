// GET /api/file — download the current data as a data.xlsx workbook (built server-side
// from the merged dataset, so "Download data.xlsx" always returns a correctly-structured
// file to edit and re-upload).
import { getCurrentDataset } from "@/lib/dataset";
import { buildWorkbook } from "@/lib/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { data } = await getCurrentDataset();
  const buf = buildWorkbook(data);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="data.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
