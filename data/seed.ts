// Built-in historical dataset (Jan '24 – May '26), extracted losslessly from the
// original index.html. This is the always-present fallback/base; the uploaded
// workbook only adds months AFTER LAST_BUILTIN.
import seedJson from "./seed.json";
import type { Dataset } from "@/lib/types";

export const SEED = seedJson as unknown as Dataset;

/** The last month baked into the build. Only later periods are merged from the workbook. */
export const LAST_BUILTIN = "May '26";
