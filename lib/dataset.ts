// Resolve the current effective dataset: stored workbook (merged) or the built-in seed.
// Server-only: imported only by route handlers (uses the storage adapter).
import type { DataResponse, Dataset } from "./types";
import { SEED } from "@/data/seed";
import { getStorage } from "./storage";
import { mergeWorkbook } from "./xlsx";

export async function getCurrentDataset(): Promise<{ data: Dataset } & Pick<DataResponse, "source" | "newPeriods">> {
  try {
    const buf = await getStorage().read();
    if (buf && buf.length) {
      // A stored workbook means an admin uploaded data -> "live", regardless of whether it
      // also added new months (it may just edit audit statuses).
      const { data, newPeriods } = mergeWorkbook(buf);
      return { data, source: "live", newPeriods };
    }
  } catch (e) {
    // Fall back to built-in data if storage/parse fails — the app stays usable.
    console.error("getCurrentDataset: falling back to seed —", (e as Error).message);
  }
  return { data: SEED, source: "builtin", newPeriods: [] };
}
