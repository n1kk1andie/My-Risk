"use client";

import { useRisk } from "@/components/risk-context";
import { auditStatusAsOf } from "@/lib/audit";

export function AuditHistory() {
  const { P, data, auditList, cell, setCell } = useRisk();
  const periodsFull = data.periodsFull;

  const periodData = P.map((p, pi) => {
    let pastDue = 0,
      open = 0,
      resolved = 0;
    // Classify each point by its status *as of that month* (due-date aware),
    // not its current status — otherwise a point that was past due back then but
    // has since been resolved would be miscounted as resolved in that month.
    auditList.forEach((a) => {
      const s = auditStatusAsOf(a, pi, P);
      if (s === "Past Due") pastDue++;
      else if (s === "Open") open++;
      else if (s === "Resolved") resolved++;
      // null => not raised yet that month => not counted
    });
    return { p, pastDue, open, resolved, total: pastDue + open + resolved };
  });

  const maxVal = Math.max(...periodData.map((d) => d.total), 1);

  const yearGroups: { yr: string; count: number; startI: number }[] = [];
  {
    let cur: string | null = null;
    let count = 0;
    let startI = 0;
    P.forEach((p, i) => {
      const yr = p.split(" ")[1];
      if (yr !== cur) {
        if (cur) yearGroups.push({ yr: cur, count, startI });
        cur = yr;
        count = 1;
        startI = i;
      } else count++;
    });
    if (cur) yearGroups.push({ yr: cur, count, startI });
  }

  const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mon3 = (p: string) => {
    const f = periodsFull[P.indexOf(p)];
    return f ? MON3[FULL.indexOf(f.split(" ")[0])] : p.split(" ")[0].slice(0, 3);
  };

  const BAR_W = 22;
  const GAP = 4;
  const COL = BAR_W + GAP;
  const CHART_H = 160;
  const totalW = P.length * COL + 8;
  const sel = cell && "pi" in cell ? cell : null;

  return (
    <div>
      <div className="h2l">Audit points open by month</div>
      <div className="sub13" style={{ margin: "0 4px 12px" }}>
        Shows how many points were on the register each month, split by status.
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
        <span>
          <i className="sw" style={{ background: "#0E8A4D" }} />
          Resolved
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ width: totalW, minWidth: totalW }}>
          <div style={{ display: "flex", alignItems: "flex-end", height: CHART_H, gap: GAP + "px", padding: "0 4px", position: "relative" }}>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <div
                key={f}
                style={{ position: "absolute", left: 0, right: 0, bottom: f * CHART_H, borderTop: "1px dashed #EEE7E3", pointerEvents: "none" }}
              >
                <span style={{ fontSize: 8, color: "#C0B8B5", position: "absolute", right: 2, top: -8 }}>{Math.round(f * maxVal)}</span>
              </div>
            ))}
            {periodData.map((d, i) => (
              <div
                key={i}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", width: BAR_W, flexShrink: 0, cursor: "pointer" }}
                onClick={() => setCell(sel && sel.pi === i ? null : { pi: i, d })}
              >
                <div style={{ width: "100%", display: "flex", flexDirection: "column-reverse", position: "relative" }}>
                  {d.resolved > 0 && (
                    <div
                      style={{
                        width: "100%",
                        height: (d.resolved / maxVal) * CHART_H,
                        background: "#0E8A4D",
                        borderRadius: d.open === 0 && d.pastDue === 0 ? "3px 3px 0 0" : "0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {(d.resolved / maxVal) * CHART_H >= 12 && (
                        <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{d.resolved}</span>
                      )}
                    </div>
                  )}
                  {d.open > 0 && (
                    <div
                      style={{
                        width: "100%",
                        height: (d.open / maxVal) * CHART_H,
                        background: "#A07208",
                        borderRadius: d.pastDue === 0 ? "3px 3px 0 0" : "0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {(d.open / maxVal) * CHART_H >= 12 && (
                        <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{d.open}</span>
                      )}
                    </div>
                  )}
                  {d.pastDue > 0 && (
                    <div
                      style={{
                        width: "100%",
                        height: (d.pastDue / maxVal) * CHART_H,
                        background: "#8E0E1F",
                        borderRadius: "3px 3px 0 0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {(d.pastDue / maxVal) * CHART_H >= 12 && (
                        <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{d.pastDue}</span>
                      )}
                    </div>
                  )}
                </div>
                {d.total > 0 && (
                  <div style={{ fontSize: 8, fontWeight: 800, color: "#1C1416", marginTop: 2, lineHeight: 1 }}>{d.total}</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", marginTop: 4, paddingLeft: 4 }}>
            {yearGroups.map((y, yi) => (
              <div key={yi} style={{ flexShrink: 0, borderLeft: yi > 0 ? "2px solid rgba(228,1,43,0.2)" : "none" }}>
                <div
                  style={{
                    fontFamily: "Sora",
                    fontSize: 10,
                    fontWeight: 800,
                    color: "var(--red)",
                    textAlign: "center",
                    padding: "2px 0 2px",
                    width: y.count * COL,
                  }}
                >
                  {"20" + y.yr.replace("'", "")}
                </div>
                <div style={{ display: "flex" }}>
                  {P.slice(y.startI, y.startI + y.count).map((p, j) => (
                    <div key={j} style={{ width: COL, flexShrink: 0, fontSize: 8, color: "#A89C97", textAlign: "center", fontWeight: 600 }}>
                      {mon3(p)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {sel && (
        <div className="notebox" style={{ marginTop: 10 }}>
          <div className="b t13">{P[sel.pi]}</div>
          <div className="row gap8" style={{ marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#8E0E1F" }}>Past due: {sel.d.pastDue}</span>
            <span style={{ fontSize: 12, color: "#A07208" }}>Open: {sel.d.open}</span>
            <span style={{ fontSize: 12, color: "#0E8A4D" }}>Resolved: {sel.d.resolved}</span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Total: {sel.d.total}</span>
          </div>
        </div>
      )}
    </div>
  );
}
