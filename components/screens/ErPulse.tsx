"use client";

import { useRisk } from "@/components/risk-context";
import { BAND, fmtNum, fmtPct } from "@/lib/rag";

export function ErPulse() {
  const { P, LAST, erSnap, erBandCounts, totPotLoss, setOpen, setTab } = useRisk();

  return (
    <div>
      <div className="hero">
        <div className="row between base">
          <span className="eyebrow">ON / AHEAD OF TARGET</span>
          <span className="dim12">as at {P[LAST]}</span>
        </div>
        <div className="big">
          {erBandCounts.Target}
          <span style={{ fontSize: 24, opacity: 0.7 }}>/{erSnap.length}</span>
        </div>
        <div className="dim13">
          {erBandCounts.Limit} within limit · {erBandCounts.Tolerance} below target
        </div>
      </div>

      <div className="grid-status">
        <div className="card">
          <div className="num" style={{ color: "#0E8A4D" }}>
            {erBandCounts.Target}
          </div>
          <div className="sub" style={{ marginTop: 2 }}>
            On / Ahead
          </div>
        </div>
        <div className="card">
          <div className="num" style={{ color: "#A07208" }}>
            {erBandCounts.Limit}
          </div>
          <div className="sub" style={{ marginTop: 2 }}>
            Within Limit
          </div>
        </div>
        <div className="card">
          <div className="num" style={{ color: "#8E0E1F" }}>
            {erBandCounts.Tolerance}
          </div>
          <div className="sub" style={{ marginTop: 2 }}>
            Below Target
          </div>
        </div>
        <div className="card">
          <div className="num16">{fmtNum(totPotLoss && totPotLoss.pj)}</div>
          <div className="sub" style={{ marginTop: 2 }}>
            Potential loss JMD ({P[LAST]})
          </div>
        </div>
      </div>

      <div className="h2l">Operational risk measures</div>
      <div className="grid-measures">
        {erSnap.map((m, i) => {
          const b = (m.band && BAND[m.band]) || BAND.Target;
          return (
            <button
              key={i}
              className="erbtn"
              onClick={() => {
                setOpen(m.name);
                setTab("register");
              }}
            >
              <div className="row between base">
                <div className="t13" style={{ flex: 1, paddingRight: 8 }}>
                  {m.name}
                </div>
                <div className="num16" style={{ color: b.color }}>
                  {m.isPct ? fmtPct(m.latest) : fmtNum(m.latest)}
                </div>
              </div>
              <div className="row between mid" style={{ marginTop: 6 }}>
                <span className="statpill" style={{ background: b.bg, color: b.color }}>
                  {b.label}
                </span>
                <span className="sub">target {m.isPct ? fmtPct(m.target) : m.target_raw || "—"}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "#A89C97", textAlign: "center", margin: "22px 0 8px" }}>
        VMBS Operational Risk &amp; Audit Register · Owner: Nicola Anderson, COO
      </div>
    </div>
  );
}
