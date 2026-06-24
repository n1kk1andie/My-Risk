// RAG (red-amber-green) status language + formatters.
// Ported verbatim from the original index.html so the rebuilt UI is colour-identical.

import type { Band } from "./types";

export interface BandStyle {
  label: string;
  color: string;
  bg: string;
}

export const BAND: Record<Band, BandStyle> = {
  Target: { label: "On / Ahead of Target", color: "#0E8A4D", bg: "#E5F4EC" },
  Limit: { label: "Within Limit", color: "#E3B341", bg: "#FBF5DC" },
  Tolerance: { label: "Below Limit", color: "#E07B00", bg: "#FBF0E5" },
  Breach: { label: "Breach", color: "#8E0E1F", bg: "#F9E2E5" },
};

/** Heatmap "world-class" scale — fixed cutoffs on the raw percentage value. */
export const heatColor = (v: number | null): string =>
  v == null ? "#EFE9E6" : v >= 0.95 ? "#0E8A4D" : v >= 0.9 ? "#E3B341" : v >= 0.8 ? "#E07B00" : "#B5142A";

export const heatLabel = (v: number | null): string =>
  v == null
    ? "Not tracked"
    : v >= 0.95
    ? "World Class"
    : v >= 0.9
    ? "Industry Average"
    : v >= 0.8
    ? "Non-Competitive"
    : "Unacceptable";

export const RATING: Record<string, { c: string; bg: string }> = {
  "Grade 1 - Fundamental": { c: "#8E0E1F", bg: "#F9E2E5" },
  "Grade 2 - Significant": { c: "#C75F00", bg: "#FCEBD9" },
  High: { c: "#8E0E1F", bg: "#F9E2E5" },
  Moderate: { c: "#A07208", bg: "#FBF2DC" },
  "Improvement Opportunity": { c: "#0E8A4D", bg: "#E5F4EC" },
  Unrated: { c: "#8A7E7A", bg: "#F1ECE9" },
};

export const STATUSC: Record<string, { c: string; bg: string }> = {
  "Past Due": { c: "#8E0E1F", bg: "#F9E2E5" },
  Open: { c: "#A07208", bg: "#FBF2DC" },
  Resolved: { c: "#0E8A4D", bg: "#E5F4EC" },
};

/**
 * Compute a RAG band for a value against its target/tolerance/limit thresholds.
 * Assumes higher-is-better. Mirrors the original parser's banding.
 */
export function calcBand(value: number | null, target: number, lim: number, tol: number): Band | null {
  if (value == null) return null;
  if (value >= target) return "Target";
  if (value >= lim) return "Limit";
  if (value >= tol) return "Tolerance";
  return "Tolerance";
}

// ── formatters ──
export const fmtPct = (v: number | null | undefined): string =>
  v == null || isNaN(v) ? "—" : (v * 100).toFixed(1) + "%";

export const fmtNum = (v: number | null | undefined): string =>
  v == null || isNaN(v as number) ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

export const fmtDate = (s: string | null | undefined): string => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
