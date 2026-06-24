"use client";

import { useMemo } from "react";
import { useRisk } from "@/components/risk-context";
import { BAND, heatColor, heatLabel, fmtPct, fmtNum } from "@/lib/rag";

export function ErHistory() {
  const { P, data, erList, cell, setCell } = useRisk();
  const periodsFull = data.periodsFull;

  const erHM = useMemo(() => {
    const score = (m: (typeof erList)[number]) => {
      let good = 0,
        tot = 0;
      m.s.forEach((v, i) => {
        if (v != null) {
          tot++;
          if (m.isPct ? v >= 0.95 : m.bands[i] === "Target") good++;
        }
      });
      return tot ? good / tot : -1;
    };
    return [...erList].map((m) => ({ m, sc: score(m) })).sort((a, b) => b.sc - a.sc).map((x) => x.m);
  }, [erList]);

  const sel = cell && "m" in cell ? cell : null;

  const years: { yr: string; count: number; startI: number }[] = [];
  {
    let cur: string | null = null;
    let count = 0;
    let startI = 0;
    P.forEach((p, i) => {
      const yr = p.split(" ")[1];
      if (yr !== cur) {
        if (cur) years.push({ yr: cur, count, startI });
        cur = yr;
        count = 1;
        startI = i;
      } else count++;
    });
    if (cur) years.push({ yr: cur, count, startI });
  }

  const hexToRgb = (h: string): [number, number, number] => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];

  return (
    <div>
      <div className="h2l">Operational risk performance</div>
      <div className="sub13" style={{ margin: "0 4px 10px" }}>
        Sorted strongest → weakest, so consistently green measures band at the top and the trouble spots collect below.
      </div>
      <div className="legend">
        <span>
          <i className="sw" style={{ background: "#0E8A4D" }} />
          World Class ≥95%
        </span>
        <span>
          <i className="sw" style={{ background: "#E3B341" }} />
          Industry Avg 90–95%
        </span>
        <span>
          <i className="sw" style={{ background: "#E07B00" }} />
          Non-Competitive 80–90%
        </span>
        <span>
          <i className="sw" style={{ background: "#B5142A" }} />
          Unacceptable &lt;80%
        </span>
        <span>
          <i className="sw" style={{ background: "#EFE9E6" }} />
          Not tracked
        </span>
      </div>
      <div className="sub13" style={{ margin: "6px 4px 10px", fontStyle: "italic" }}>
        Faded cells indicate the last known value carried forward until new data is recorded.
      </div>
      <div style={{ overflowX: "auto" }}>
        <div className="hm">
          <div className="row" style={{ marginBottom: 0, alignItems: "flex-end" }}>
            <div className="hmname b" style={{ alignSelf: "flex-end" }}>
              Measure
            </div>
            {years.map((y, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: y.count * 24 }}>
                <div
                  style={{
                    fontFamily: "Sora",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--red)",
                    borderBottom: "2px solid #F1ECE9",
                    width: "100%",
                    textAlign: "center",
                    paddingBottom: 2,
                    marginBottom: 2,
                  }}
                >
                  {"20" + y.yr.replace("'", "")}
                </div>
                <div style={{ display: "flex" }}>
                  {P.slice(y.startI, y.startI + y.count).map((p, j) => (
                    <div key={j} className="hmmon">
                      {periodsFull[y.startI + j].split(" ")[0].slice(0, 3)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {erHM.map((m, i) => (
            <div key={i} className="row" style={{ alignItems: "center" }}>
              <div className="hmname" title={m.name}>
                {m.name}
              </div>
              {m.s.map((v, mi) => {
                let bg: string;
                let isCarry = false;
                if (v == null) {
                  let lastV: number | null = null;
                  let lastMi = -1;
                  for (let j = mi - 1; j >= 0; j--) {
                    if (m.s[j] != null) {
                      lastV = m.s[j];
                      lastMi = j;
                      break;
                    }
                  }
                  if (lastV != null) {
                    const lastBg = m.isPct ? heatColor(lastV) : ((m.bands[lastMi] && BAND[m.bands[lastMi]!]) || BAND.Target).color;
                    const [r, g, bl] = hexToRgb(lastBg);
                    bg = `rgba(${r},${g},${bl},0.22)`;
                    isCarry = true;
                  } else {
                    bg = "#EFE9E6";
                  }
                } else if (m.isPct) bg = heatColor(v);
                else bg = ((m.bands[mi] && BAND[m.bands[mi]!]) || BAND.Target).color;
                return (
                  <div
                    key={mi}
                    className="hmcell"
                    style={{ background: bg, outline: isCarry ? "1px dashed rgba(0,0,0,0.08)" : "none", outlineOffset: "-1px" }}
                    onClick={() => setCell({ m, mi, v })}
                    title={m.name + " · " + P[mi] + ": " + (v == null ? "carrying fwd" : m.isPct ? fmtPct(v) : fmtNum(v))}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {sel && (
        <div className="notebox">
          <b>{sel.m.name}</b>
          <br />
          {P[sel.mi]} ·{" "}
          {sel.v == null ? "Carrying forward last value" : sel.m.isPct ? fmtPct(sel.v) : fmtNum(sel.v)} ·{" "}
          {sel.v == null ? "—" : sel.m.isPct ? heatLabel(sel.v) : ((sel.m.bands[sel.mi] && BAND[sel.m.bands[sel.mi]!]) || { label: "—" }).label}
        </div>
      )}
    </div>
  );
}
