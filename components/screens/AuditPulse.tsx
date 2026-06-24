"use client";

import { useRisk } from "@/components/risk-context";
import { STATUSC, fmtDate } from "@/lib/rag";

export function AuditPulse() {
  const { P, LAST, openAudit, aCounts, auditList, setStatusFilter, setRatingFilter, setOpen, setTab } = useRisk();

  return (
    <div>
      <div className="hero">
        <div className="row between base">
          <span className="eyebrow">OPEN AUDIT POINTS</span>
          <span className="dim12">as at {P[LAST]}</span>
        </div>
        <div className="big">{openAudit.length}</div>
        <div className="dim13">
          {aCounts["Past Due"]} past due · {aCounts["Open"]} within timeline · {aCounts["Resolved"]} resolved to date
        </div>
      </div>

      <div className="grid-status">
        {([
          ["Past Due", "Past Due"],
          ["Open", "Open"],
          ["Resolved", "Resolved"],
        ] as const).map(([k, lab]) => {
          const s = STATUSC[k];
          return (
            <button
              key={k}
              className="card btncard"
              onClick={() => {
                setStatusFilter(k);
                setRatingFilter(null);
                setOpen(null);
                setTab("register");
              }}
            >
              <div className="num" style={{ color: s.c }}>
                {aCounts[k] || 0}
              </div>
              <div className="sub" style={{ marginTop: 2 }}>
                {lab}
              </div>
            </button>
          );
        })}
        <div className="card">
          <div className="num">{auditList.length}</div>
          <div className="sub" style={{ marginTop: 2 }}>
            Total tracked
          </div>
        </div>
      </div>

      <div className="h2l">Open audit points</div>
      <div className="grid-cats">
        {openAudit.length === 0 ? (
          <div className="card">
            <div className="sub13">No open audit points — all VMBS items resolved.</div>
          </div>
        ) : (
          openAudit.map((a, i) => {
            const s = STATUSC[a.status];
            return (
              <button
                key={i}
                className="card btncard"
                onClick={() => {
                  setStatusFilter(null);
                  setRatingFilter(null);
                  setOpen(a.code + "|" + a.exc);
                  setTab("register");
                }}
              >
                <div className="row between mid">
                  <div style={{ flex: 1, paddingRight: 10 }}>
                    <div className="t14">{a.exc}</div>
                    <div className="sub" style={{ marginTop: 3 }}>
                      {a.owner} · {a.rating} · due {fmtDate(a.due)}
                    </div>
                  </div>
                  <span className="statpill" style={{ background: s?.bg, color: s?.c }}>
                    {a.status}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
      <div style={{ fontSize: 11, color: "#A89C97", textAlign: "center", margin: "22px 0 8px" }}>
        VMBS Operational Risk &amp; Audit Register · Owner: Nicola Anderson, COO
      </div>
    </div>
  );
}
