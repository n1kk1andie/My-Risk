// Domain types for the VMBS Operational Risk & Audit Register.
// These mirror the four data.xlsx sheets (er / audit / gov / pfl).

export type Band = "Target" | "Limit" | "Tolerance" | "Breach";
export type AuditStatus = "Past Due" | "Open" | "Resolved";

/** Enterprise-risk KRI: one row of the `er` sheet. */
export interface ErMeasure {
  name: string;
  target: number;
  target_raw: number | string;
  tol: number;
  lim: number;
  /** Monthly actuals, positionally aligned to Dataset.periods. null = not recorded. */
  s: (number | null)[];
  /** Precomputed RAG band per month, aligned to `s`. */
  bands: (Band | null)[];
  isPct: boolean;
  _custom?: boolean;
}

/** Audit finding: one row of the `audit` sheet. */
export interface AuditPoint {
  code: string;
  pid?: number;
  exc: string;
  rec: string;
  find: string;
  owner: string;
  rating: string;
  status: AuditStatus | string;
  issue: string | null;
  due: string | null;
  first: string;
  last: string;
  months: number;
  /** Open(1)/closed(0) per month, aligned to Dataset.periods. */
  tl: number[];
  _fromExcel?: boolean;
}

/** Governance audit-point counts: one row of the `gov` sheet. */
export interface GovRow {
  p: string;
  int: number;
  ext: number;
  tot: number;
}

/** Potential / fraud loss (JMD): one row of the `pfl` sheet. */
export interface PflRow {
  p: string;
  /** potential loss */ pj: number;
  /** recovered */ rj: number;
  /** actual loss */ aj: number;
  /** transaction count */ n: number;
}

export interface Dataset {
  periods: string[];
  periodsFull: string[];
  er: ErMeasure[];
  audit: AuditPoint[];
  gov: GovRow[];
  pfl: PflRow[];
}

export type DataSource = "builtin" | "live";

/** Shape returned by GET /api/data. */
export interface DataResponse extends Dataset {
  source: DataSource;
  /** Period labels merged in from the uploaded workbook (beyond the built-in cutoff). */
  newPeriods: string[];
}
