"use client";

import type { AuditPoint } from "@/lib/types";
import { useRisk } from "@/components/risk-context";
import { STATUSC, fmtDate } from "@/lib/rag";
import { periodEndDate } from "@/lib/periods";
import { StatPill, RatingPill } from "@/components/ui/Pills";

/**
 * Status of an audit point as it stood at period index `pi`.
 *  - null  → not yet raised that month (hidden from the register)
 *  - the latest period preserves the stored current status exactly
 *  - earlier periods are derived from the open/closed timeline + due date
 */
function statusAsOf(a: AuditPoint, pi: number, P: string[], isLast: boolean): string | null {
  const firstIdx = P.indexOf(a.first);
  if (firstIdx >= 0 && pi < firstIdx) return null; // not raised yet
  if (isLast) return a.status;
  if (a.tl[pi] !== 1) return "Resolved"; // closed by this month
  if (a.due) {
    const due = new Date(a.due);
    const end = periodEndDate(P[pi]);
    if (!isNaN(due.getTime()) && end && due <= end) return "Past Due";
  }
  return "Open";
}

export function AuditRegister() {
  const { P, LAST, selPeriod, auditList, statusFilter, ratingFilter, open, setStatusFilter, setRatingFilter, setOpen } =
    useRisk();
  const isLast = selPeriod === LAST;

  // Resolve each point's status for the selected period, dropping points not yet raised.
  const asOf = auditList
    .map((a) => ({ a, status: statusAsOf(a, selPeriod, P, isLast) }))
    .filter((x): x is { a: AuditPoint; status: string } => x.status !== null);

  const counts = asOf.reduce<Record<string, number>>((c, { status }) => {
    c[status] = (c[status] || 0) + 1;
    return c;
  }, {});

  const auditFiltered = asOf.filter(
    ({ a, status }) => (!statusFilter || status === statusFilter) && (!ratingFilter || a.rating === ratingFilter)
  );

  return (
    <div>
      <div className="chips">
        <button
          className={"chip" + (!statusFilter && !ratingFilter ? " on" : "")}
          onClick={() => {
            setStatusFilter(null);
            setRatingFilter(null);
          }}
        >
          All ({asOf.length})
        </button>
        {["Past Due", "Open", "Resolved"].map((s) => (
          <button
            key={s}
            className={"chip" + (statusFilter === s ? " on" : "")}
            onClick={() => {
              setStatusFilter(statusFilter === s ? null : s);
              setRatingFilter(null);
            }}
          >
            {s} ({counts[s] || 0})
          </button>
        ))}
      </div>
      <div className="grid-measures" style={{ marginTop: 4 }}>
        {auditFiltered.map(({ a, status }, i) => {
          const id = a.code + "|" + a.exc;
          const isOpen = open === id;
          return (
            <div key={i} className="apt">
              <button className="rowbtn" style={{ padding: 0 }} onClick={() => setOpen(isOpen ? null : id)}>
                <div style={{ flex: 1 }}>
                  <div className="row between base">
                    <div className="t13" style={{ flex: 1, paddingRight: 8 }}>
                      {a.exc}
                    </div>
                    <StatPill status={status} />
                  </div>
                  <div className="aptmeta">
                    <RatingPill rating={a.rating} />
                    <span>{a.owner}</span>
                  </div>
                </div>
              </button>
              {isOpen && (
                <div>
                  <table className="kvtable">
                    <tbody>
                      <tr>
                        <td>Project</td>
                        <td>{a.code}</td>
                      </tr>
                      <tr>
                        <td>Recommendation</td>
                        <td>{a.rec || "—"}</td>
                      </tr>
                      {a.find && (
                        <tr>
                          <td>Findings</td>
                          <td>{a.find}</td>
                        </tr>
                      )}
                      <tr>
                        <td>Owner</td>
                        <td>{a.owner}</td>
                      </tr>
                      <tr>
                        <td>Risk rating</td>
                        <td>{a.rating}</td>
                      </tr>
                      <tr>
                        <td>Issue date</td>
                        <td>{fmtDate(a.issue)}</td>
                      </tr>
                      <tr>
                        <td>Due date</td>
                        <td>{fmtDate(a.due)}</td>
                      </tr>
                      <tr>
                        <td>Tracked</td>
                        <td>
                          {a.first} → {a.last} ({a.months} mo)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="sub" style={{ marginTop: 8, marginBottom: 3 }}>
                    Open across period
                  </div>
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    {a.tl.map((v, mi) => (
                      <div
                        key={mi}
                        title={P[mi]}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          background: v ? STATUSC[status]?.c || "#8A7E7A" : "#EEE7E3",
                          outline: mi === selPeriod ? "2px solid #1C1416" : "none",
                          outlineOffset: 1,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {auditFiltered.length === 0 && (
          <div className="sub" style={{ textAlign: "center", padding: 20 }}>
            {asOf.length === 0 ? `No audit points raised as of ${P[selPeriod]}.` : "No points match this filter."}
          </div>
        )}
      </div>
    </div>
  );
}
