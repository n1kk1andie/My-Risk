"use client";

import { useRisk } from "@/components/risk-context";
import { auditStatusAsOf } from "@/lib/audit";

export function AuditHistory() {
  const { P, auditList, cell, setCell } = useRisk();

  const periodData = P.map((p, pi) => {
    let pastDue = 0,
      open = 0;
    // Count the points that were OPEN on the register that month, split by their
    // status *as of that month* (due-date aware). Resolved points are not "open",
    // so they're excluded — the chart tracks the open audit-point load over time.
    auditList.forEach((a) => {
      const s = auditStatusAsOf(a, pi, P);
      if (s === "Past Due") pastDue++;
      else if (s === "Open") open++;
    });
    return { p, pastDue, open, total: pastDue + open };
  });

  const maxVal = Math.max(...periodData.map((d) => d.total), 1);
  const sel = cell && "pi" in cell ? cell : null;

  return (
    <div>
      <div className="h2l">Audit points open by month</div>
      <div className="sub13" style={{ margin: "0 4px 12px" }}>
        Shows how many audit points were open each month, split into past due and within timeline.
      </div>

      <div className="legend" style={{ marginBottom: 12 }}>
        <span>
          <i className="sw" style={{ background: "#8E0E1F" }} />
          Past due
        </span>
        <span>
          <i className="sw" style={{ background: "#A07208" }} />
          Open
        </span>
      </div>

      <div>
        {periodData.map((d, i) => {
          const isSel = sel != null && sel.pi === i;
          const yr = d.p.split(" ")[1];
          const prevYr = i > 0 ? P[i - 1].split(" ")[1] : null;
          const pdW = (d.pastDue / maxVal) * 100;
          const opW = (d.open / maxVal) * 100;
          return (
            <div key={i}>
              {yr !== prevYr && (
                <div
                  style={{
                    fontFamily: "Sora",
                    fontSize: 10,
                    fontWeight: 800,
                    color: "var(--red)",
                    margin: i === 0 ? "0 0 4px" : "12px 0 4px",
                    paddingLeft: 4,
                  }}
                >
                  20{(yr || "").replace("'", "")}
                </div>
              )}
              <div
                onClick={() => setCell(isSel ? null : { pi: i, d })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "3px 4px",
                  cursor: "pointer",
                  background: isSel ? "#FAF4F0" : "transparent",
                  borderRadius: 6,
                }}
              >
                <div style={{ width: 30, flexShrink: 0, fontSize: 9, fontWeight: 700, color: "#6E625E", textAlign: "right" }}>
                  {d.p.split(" ")[0]}
                </div>
                <div style={{ flex: 1, height: 16, background: "#F4EFEC", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                  {d.pastDue > 0 && (
                    <div style={{ width: pdW + "%", background: "#8E0E1F", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {pdW >= 9 && <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{d.pastDue}</span>}
                    </div>
                  )}
                  {d.open > 0 && (
                    <div style={{ width: opW + "%", background: "#A07208", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {opW >= 9 && <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{d.open}</span>}
                    </div>
                  )}
                </div>
                <div style={{ width: 16, flexShrink: 0, fontSize: 9, fontWeight: 800, color: "#1C1416" }}>{d.total || ""}</div>
              </div>
            </div>
          );
        })}
      </div>

      {sel && (
        <div className="notebox" style={{ marginTop: 10 }}>
          <div className="b t13">{P[sel.pi]}</div>
          <div className="row gap8" style={{ marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#8E0E1F" }}>Past due: {sel.d.pastDue}</span>
            <span style={{ fontSize: 12, color: "#A07208" }}>Open: {sel.d.open}</span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Total open: {sel.d.total}</span>
          </div>
        </div>
      )}
    </div>
  );
}
