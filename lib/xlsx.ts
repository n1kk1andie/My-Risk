// Server-side workbook processing — parse an uploaded data.xlsx, merge any months
// newer than the built-in cutoff into the seed, and (re)build a workbook for download.
//
// This is the "API to process the xlsx": it runs in Node on the server, NOT in the
// browser. The client just receives merged JSON from /api/data.
//
// The merge is SCHEMA-TOLERANT: every sheet is read by header name / detected column role,
// not fixed position, so adding, reordering, or inserting columns does not corrupt the data.
// Anything it can't line up is reported in `warnings` rather than silently mangled.
import * as XLSX from "xlsx";
import type { Dataset, ErMeasure, AuditPoint, GovRow, PflRow } from "./types";
import { SEED, LAST_BUILTIN } from "@/data/seed";
import { calcBand } from "./rag";
import { normalizePeriod, expandPeriod } from "./periods";

export interface MergeStats {
  newPeriods: string[];
  measuresUpdated: number;
  measuresUnmatched: string[];
  newMeasures: string[];
  auditPoints: number;
  newAuditPoints: number;
  govRows: number;
  pflRows: number;
}

export interface MergeResult {
  data: Dataset;
  newPeriods: string[];
  warnings: string[];
  stats: MergeStats;
}

const PERIOD_RE = /^[A-Z][a-z]{2} '\d{2}$/;
const norm = (v: unknown): string => String(v ?? "").trim();

/** First column whose (normalised) header matches `re`, else `fallback`. */
function findCol(header: unknown[], re: RegExp, fallback = -1): number {
  for (let i = 0; i < header.length; i++) {
    if (re.test(norm(header[i]))) return i;
  }
  return fallback;
}

/** Read a cell as a number, treating blank/non-numeric as null. */
function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * Normalise a date cell to ISO `YYYY-MM-DD`. Excel stores dates as serial numbers,
 * which sheet_to_json returns as plain numbers — `new Date(45657)` would then be
 * read as milliseconds (1970), not a real date. Handles Excel serials, JS Dates,
 * and day-first text like `31/12/2024`. Returns null for blanks.
 */
function excelDateToISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : `${v.getUTCFullYear()}-${pad2(v.getUTCMonth() + 1)}-${pad2(v.getUTCDate())}`;
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad2(d.m)}-${pad2(d.d)}` : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  // Day-first text dates (dd/mm/yyyy, dd-mm-yy, etc.) — the format used in the source data.
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const day = +m[1];
    const mon = +m[2];
    const yr = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) return `${yr}-${pad2(mon)}-${pad2(day)}`;
  }
  return s; // already ISO (or some other text) — leave as-is
}

function cloneSeed(): Dataset {
  return JSON.parse(JSON.stringify(SEED)) as Dataset;
}

export function mergeWorkbook(buf: ArrayBuffer | Uint8Array | Buffer): MergeResult {
  const base = cloneSeed();
  const warnings: string[] = [];
  // cellNF keeps each cell's number-format string (.z) so we can detect "%"-formatted cells.
  const wb = XLSX.read(new Uint8Array(buf as ArrayBuffer), { type: "array", cellNF: true });

  const existing = new Set(base.periods);

  // ── er sheet ───────────────────────────────────────────────────────────────
  let mergedER: ErMeasure[] = base.er;
  let addPeriods: string[] = [];
  const newMeasures: string[] = [];
  const measuresUnmatched: string[] = [];
  let measuresUpdated = 0;

  const erWs = wb.Sheets["er"];
  if (!erWs) {
    warnings.push("No 'er' sheet found — operational-risk measures were left unchanged.");
  } else {
    const erRows = XLSX.utils.sheet_to_json<unknown[]>(erWs, { header: 1, defval: null });
    const header = (erRows[0] as unknown[]) || [];

    // Detect column roles by header name (tolerant of inserts/reorders).
    const measureCol = findCol(header, /^(measure|kri|name)/i, 0);
    const targetCol = findCol(header, /target/i);
    const tolCol = findCol(header, /toler/i);
    const limCol = findCol(header, /limit/i);
    const typeCol = findCol(header, /type/i);

    // Period columns = any header that normalises to a "Mon 'YY" label.
    const periodColMap = new Map<string, number>();
    const orderedPeriods: string[] = [];
    header.forEach((h, ci) => {
      const p = normalizePeriod(h);
      if (p && PERIOD_RE.test(p) && !periodColMap.has(p)) {
        periodColMap.set(p, ci);
        orderedPeriods.push(p);
      }
    });

    if (orderedPeriods.length === 0) {
      warnings.push("No month columns recognised on the 'er' sheet (expected headers like \"Jun '26\").");
    }
    addPeriods = orderedPeriods.filter((p) => !existing.has(p));

    const allPeriods = [...base.periods, ...addPeriods];

    // Map measure name -> { row, sheet row index }. The index lets us read each cell's
    // number format to detect percentage columns.
    const rowByName = new Map<string, { r: unknown[]; idx: number }>();
    erRows.forEach((row, idx) => {
      if (idx === 0) return; // header
      const r = row as unknown[];
      const key = norm(r[measureCol]).toLowerCase();
      if (key && !rowByName.has(key)) rowByName.set(key, { r, idx });
    });
    const seedNames = new Set(base.er.map((m) => m.name.trim().toLowerCase()));

    // True when the Excel cell is percent-formatted (value 1 displays as "100%").
    const cellPct = (rowIdx: number, col: number): boolean => {
      if (col < 0) return false;
      const cell = erWs[XLSX.utils.encode_cell({ r: rowIdx, c: col })] as { z?: unknown; w?: unknown } | undefined;
      if (!cell) return false;
      return /%/.test(String(cell.z ?? "")) || /%\s*$/.test(String(cell.w ?? ""));
    };
    const rowPct = (rowIdx: number): boolean =>
      cellPct(rowIdx, targetCol) || [...periodColMap.values()].some((ci) => cellPct(rowIdx, ci));

    // Existing measures: keep seed history, append values for the new months only.
    mergedER = base.er.map((m) => {
      const entry = rowByName.get(m.name.trim().toLowerCase());
      if (!entry) {
        measuresUnmatched.push(m.name);
        return { ...m, s: [...m.s, ...addPeriods.map(() => null)], bands: [...m.bands, ...addPeriods.map(() => null)] };
      }
      measuresUpdated++;
      const isPct = m.isPct || rowPct(entry.idx);
      const newVals = addPeriods.map((p) => {
        const ci = periodColMap.get(p);
        return ci != null ? numOrNull(entry.r[ci]) : null;
      });
      const newBands = newVals.map((v) => calcBand(v, m.target, m.lim, m.tol));
      return { ...m, isPct, s: [...m.s, ...newVals], bands: [...m.bands, ...newBands] };
    });

    // New measure rows (not in the seed): create them with whatever history the workbook has.
    rowByName.forEach((entry, key) => {
      const r = entry.r;
      const nm = norm(r[measureCol]);
      if (!nm || seedNames.has(key)) return;
      const isPct =
        /%|percent/i.test(norm(typeCol >= 0 ? r[typeCol] : "")) ||
        /%/.test(norm(targetCol >= 0 ? r[targetCol] : "")) ||
        rowPct(entry.idx);
      const targetRaw = targetCol >= 0 ? r[targetCol] : null;
      const target = numOrNull(targetRaw) ?? 0;
      const tol = (tolCol >= 0 ? numOrNull(r[tolCol]) : 0) ?? 0;
      const lim = (limCol >= 0 ? numOrNull(r[limCol]) : 0) ?? 0;
      const series = allPeriods.map((p) => {
        const ci = periodColMap.get(p);
        return ci != null ? numOrNull(r[ci]) : null;
      });
      const bands = series.map((v) => calcBand(v, target, lim, tol));
      mergedER.push({ name: nm, target, target_raw: (targetRaw as number | string) ?? target, tol, lim, s: series, bands, isPct, _custom: true });
      newMeasures.push(nm);
    });

    // Percentages are stored as decimals (0.97 = 97%). If a percent measure carries
    // whole-number values (96, 100) — e.g. a cell formatted as % but typed as a whole
    // number — scale them to decimals so the UI's fmtPct shows "100%", not "1"/"10000%".
    mergedER = mergedER.map((m) => {
      if (!m.isPct) return m;
      const dec = (v: number | null): number | null => (v != null && v > 1.5 ? v / 100 : v);
      const s = m.s.map(dec);
      const target = dec(m.target) ?? m.target;
      const lim = dec(m.lim) ?? m.lim;
      const tol = dec(m.tol) ?? m.tol;
      return { ...m, s, target, lim, tol, bands: s.map((v) => calcBand(v, target, lim, tol)) };
    });
  }

  const allPeriods = [...base.periods, ...addPeriods];
  const lastPeriod = allPeriods[allPeriods.length - 1];

  // ── audit sheet (full register: REPLACE, enriched with seed timelines) ───────
  let mergedAudit: AuditPoint[] = base.audit;
  let newAuditPoints = 0;
  const auWs = wb.Sheets["audit"];
  if (auWs) {
    const auRows = XLSX.utils.sheet_to_json<unknown[]>(auWs, { header: 1, defval: null });
    const h = (auRows[0] as unknown[]) || [];
    const aCol = {
      code: findCol(h, /code/i),
      exc: findCol(h, /exception|finding/i, 1),
      owner: findCol(h, /owner/i),
      rating: findCol(h, /rating/i),
      status: findCol(h, /status/i),
      issue: findCol(h, /issue/i),
      due: findCol(h, /due/i),
      first: findCol(h, /first/i),
    };
    const seedByKey = new Map(base.audit.map((a) => [a.code + "|" + a.exc, a]));
    const rows = (auRows.slice(1) as unknown[][]).filter((r) => {
      const exc = norm(r[aCol.exc]);
      return exc && !/description/i.test(exc); // skip the sample row
    });
    if (rows.length) {
      mergedAudit = rows.map((r) => {
        const exc = norm(r[aCol.exc]);
        const code = norm(r[aCol.code]) || "VMBS-XL-" + exc.slice(0, 12).replace(/[^a-z0-9]/gi, "");
        const seed = seedByKey.get(code + "|" + exc);
        if (!seed) newAuditPoints++;
        const status = norm(r[aCol.status]) || seed?.status || "Open";
        const owner = norm(r[aCol.owner]) || seed?.owner || "—";
        const rating = norm(r[aCol.rating]) || seed?.rating || "Moderate";
        const issue = excelDateToISO(r[aCol.issue]) ?? seed?.issue ?? null;
        const due = excelDateToISO(r[aCol.due]) ?? seed?.due ?? null;
        const firstSeen = norm(r[aCol.first]) || seed?.first || addPeriods[0] || base.periods[0];
        const resolved = status === "Resolved";
        const firstIdx = allPeriods.indexOf(firstSeen);
        const tl = allPeriods.map((p, i) => {
          if (seed && i < seed.tl.length) return seed.tl[i];
          return !resolved && firstIdx >= 0 && i >= firstIdx ? 1 : 0;
        });
        return {
          ...(seed ?? {}),
          code,
          exc,
          rec: seed?.rec || exc,
          find: seed?.find || "",
          owner,
          rating,
          status,
          issue,
          due,
          first: firstSeen,
          last: lastPeriod,
          months: tl.filter((v) => v).length,
          tl,
          _fromExcel: !seed,
        } as AuditPoint;
      });
    }
  }

  // ── gov / pfl: append rows for the new months only (read by header role) ─────
  const newGov: GovRow[] = [];
  const govWs = wb.Sheets["gov"];
  if (govWs) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(govWs, { header: 1, defval: null });
    const h = (rows[0] as unknown[]) || [];
    const pCol = findCol(h, /period|month/i, 0);
    const iCol = findCol(h, /intern/i, 1);
    const eCol = findCol(h, /extern/i, 2);
    (rows.slice(1) as unknown[][]).forEach((r) => {
      const p = normalizePeriod(r[pCol]);
      if (!p || !addPeriods.includes(p)) return;
      const int = numOrNull(r[iCol]) ?? 0;
      const ext = numOrNull(r[eCol]) ?? 0;
      newGov.push({ p, int, ext, tot: int + ext });
    });
  }

  const newPfl: PflRow[] = [];
  const pflWs = wb.Sheets["pfl"];
  if (pflWs) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(pflWs, { header: 1, defval: null });
    const h = (rows[0] as unknown[]) || [];
    const pCol = findCol(h, /period|month/i, 0);
    const pjCol = findCol(h, /potential/i, 1);
    const rjCol = findCol(h, /recover/i, 2);
    const ajCol = findCol(h, /actual/i, 3);
    const nCol = findCol(h, /transaction|count|txn|number/i, 4);
    (rows.slice(1) as unknown[][]).forEach((r) => {
      const p = normalizePeriod(r[pCol]);
      if (!p || !addPeriods.includes(p)) return;
      newPfl.push({ p, pj: numOrNull(r[pjCol]) ?? 0, rj: numOrNull(r[rjCol]) ?? 0, aj: numOrNull(r[ajCol]) ?? 0, n: numOrNull(r[nCol]) ?? 0 });
    });
  }

  if (measuresUnmatched.length) {
    warnings.push(`${measuresUnmatched.length} measure(s) had no row in the workbook and kept their existing data: ${measuresUnmatched.join(", ")}.`);
  }
  if (newMeasures.length) {
    warnings.push(`${newMeasures.length} new measure(s) added: ${newMeasures.join(", ")}.`);
  }

  const data: Dataset = {
    periods: allPeriods,
    periodsFull: [...base.periodsFull, ...addPeriods.map(expandPeriod)],
    er: mergedER,
    audit: mergedAudit,
    gov: [...base.gov, ...newGov],
    pfl: [...base.pfl, ...newPfl],
  };

  return {
    data,
    newPeriods: addPeriods,
    warnings,
    stats: {
      newPeriods: addPeriods,
      measuresUpdated,
      measuresUnmatched,
      newMeasures,
      auditPoints: mergedAudit.length,
      newAuditPoints,
      govRows: newGov.length,
      pflRows: newPfl.length,
    },
  };
}

/**
 * Build a downloadable data.xlsx from the current dataset, with the four data
 * sheets laid out exactly as the upload-merge expects, plus a README sheet.
 */
export function buildWorkbook(data: Dataset): Buffer {
  const wb = XLSX.utils.book_new();

  const readme = [
    ["VMBS Operational Risk & Audit Register — data workbook"],
    [""],
    ["HOW TO ADD A NEW MONTH"],
    [`Built-in history runs through ${LAST_BUILTIN}. Only months AFTER that are merged on upload.`],
    [""],
    ["1. er sheet     — add a new month column (e.g. \"Jun '26\"); enter each KRI's value (percentages as decimals, e.g. 0.97)."],
    ["2. gov sheet    — add a row for the month with internal & external open audit-point counts."],
    ["3. pfl sheet    — add a row for the month with potential / recovered / actual loss (JMD) and transaction count."],
    ["4. audit sheet  — add one row per new audit point; fill code, exception, owner, rating, status, dates, first seen."],
    ["5. Save, then upload via the app's Settings tab (admin sign-in required)."],
    [""],
    ["Columns are matched by header NAME, so you can reorder or add columns. Don't rename a measure if you want to keep its history."],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(readme), "README");

  const erHeader = ["Measure", "Target", "Tolerance", "Limit", "Type", ...data.periods];
  const erBody = data.er.map((m) => [m.name, m.target_raw ?? m.target, m.tol, m.lim, m.isPct ? "%" : "value", ...m.s]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([erHeader, ...erBody]), "er");

  const auHeader = ["Code", "Exception / Finding", "Owner", "Risk Rating", "Status", "Issue Date", "Due Date", "First Seen", "Notes"];
  const auBody = data.audit.map((a) => [a.code, a.exc, a.owner, a.rating, a.status, a.issue, a.due, a.first, a.find || ""]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([auHeader, ...auBody]), "audit");

  const govHeader = ["Period", "Internal Audit Points", "External Audit Points", "Total"];
  const govBody = data.gov.map((g) => [g.p, g.int, g.ext, g.tot]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([govHeader, ...govBody]), "gov");

  const pflHeader = ["Period", "Potential Loss JMD", "Recovered JMD", "Actual Loss JMD", "Transaction Count"];
  const pflBody = data.pfl.map((p) => [p.p, p.pj, p.rj, p.aj, p.n]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([pflHeader, ...pflBody]), "pfl");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
