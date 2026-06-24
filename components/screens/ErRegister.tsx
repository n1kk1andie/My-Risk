"use client";

import { useRisk } from "@/components/risk-context";
import { BAND, fmtNum, fmtPct } from "@/lib/rag";

export function ErRegister() {
  const { P, erSnap, open, setOpen } = useRisk();

  return (
    <div>
      <div className="grid-measures">
        {erSnap.map((m, i) => {
          const isOpen = open === m.name;
          const b = (m.band && BAND[m.band]) || BAND.Target;
          const vals = m.s.filter((x): x is number => x != null);
          const mx = Math.max(...vals, 1);
          return (
            <div key={i} className="apt">
              <button className="rowbtn" style={{ padding: 0 }} onClick={() => setOpen(isOpen ? null : m.name)}>
                <div style={{ flex: 1 }}>
                  <div className="row between base">
                    <div className="t13" style={{ flex: 1, paddingRight: 8 }}>
                      {m.name}
                    </div>
                    <div className="num16" style={{ color: b.color }}>
                      {m.isPct ? fmtPct(m.latest) : fmtNum(m.latest)}
                    </div>
                  </div>
                  <div className="aptmeta">
                    <span className="statpill" style={{ background: b.bg, color: b.color }}>
                      {b.label}
                    </span>
                    <span>target {m.isPct ? fmtPct(m.target) : m.target_raw || "—"}</span>
                  </div>
                </div>
              </button>
              {isOpen && (
                <div>
                  <div className="spark">
                    {m.s.map((v, mi) => {
                      if (v == null)
                        return (
                          <div
                            key={mi}
                            className="sparkbar"
                            style={{ background: "#F1ECE9", height: "4px" }}
                            title={P[mi] + ": n/a"}
                          />
                        );
                      const bb = (m.bands[mi] && BAND[m.bands[mi]!]) || BAND.Target;
                      const norm = m.isPct ? Math.max(0.06, v) : Math.max(0.06, v / (mx || 1));
                      return (
                        <div
                          key={mi}
                          className="sparkbar"
                          style={{ background: bb.color, height: norm * 34 + "px" }}
                          title={P[mi] + ": " + (m.isPct ? fmtPct(v) : fmtNum(v))}
                        />
                      );
                    })}
                  </div>
                  <table className="kvtable">
                    <tbody>
                      <tr>
                        <td>Target</td>
                        <td>{m.isPct ? fmtPct(m.target) : m.target_raw || "—"}</td>
                      </tr>
                      <tr>
                        <td>Tolerance</td>
                        <td>{m.tol != null ? (m.isPct ? fmtPct(m.tol) : m.tol) : "—"}</td>
                      </tr>
                      <tr>
                        <td>Limit</td>
                        <td>{m.lim != null ? (m.isPct ? fmtPct(m.lim) : m.lim) : "—"}</td>
                      </tr>
                      <tr>
                        <td>Latest ({P[m.latestIdx]})</td>
                        <td>{m.isPct ? fmtPct(m.latest) : fmtNum(m.latest)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
