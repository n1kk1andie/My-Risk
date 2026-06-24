"use client";

import { useRisk } from "@/components/risk-context";
import { STATUSC, fmtDate } from "@/lib/rag";
import { StatPill, RatingPill } from "@/components/ui/Pills";

export function AuditRegister() {
  const { P, auditList, aCounts, statusFilter, ratingFilter, open, setStatusFilter, setRatingFilter, setOpen } = useRisk();

  const auditFiltered = auditList.filter(
    (a) => (!statusFilter || a.status === statusFilter) && (!ratingFilter || a.rating === ratingFilter)
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
          All ({auditList.length})
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
            {s} ({aCounts[s] || 0})
          </button>
        ))}
      </div>
      <div className="grid-measures" style={{ marginTop: 4 }}>
        {auditFiltered.map((a, i) => {
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
                    <StatPill status={a.status} />
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
                          background: v ? STATUSC[a.status]?.c || "#8A7E7A" : "#EEE7E3",
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
            No points match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
