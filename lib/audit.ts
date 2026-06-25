// Effective audit-point status, derived from the open/closed timeline and the due
// date rather than the spreadsheet's stored status text. The stored text isn't kept
// in step with due dates, so an open point that is past its due date can still read
// "Open"; computing it here keeps every Past Due / Open / Resolved count accurate.
import type { AuditPoint } from "./types";
import { periodEndDate } from "./periods";

export type EffectiveStatus = "Past Due" | "Open" | "Resolved";

/**
 * Status of an audit point as it stood at period index `pi`.
 *  - null      → not yet raised that period
 *  - Resolved  → closed by that period
 *  - Past Due  → still open and the due date had passed by the end of that period
 *  - Open      → still open and within (or without) its due date
 */
export function auditStatusAsOf(a: AuditPoint, pi: number, periods: string[]): EffectiveStatus | null {
  const firstIdx = periods.indexOf(a.first);
  if (firstIdx >= 0 && pi < firstIdx) return null; // not raised yet
  if (a.tl[pi] !== 1) return "Resolved"; // closed by this period
  if (a.due) {
    const due = new Date(a.due);
    const end = periodEndDate(periods[pi]);
    if (!isNaN(due.getTime()) && end && due <= end) return "Past Due";
  }
  return "Open";
}
