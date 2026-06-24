"use client";

import { useRisk } from "@/components/risk-context";
import { fmtDate, fmtNum } from "@/lib/rag";
import { StatPill } from "@/components/ui/Pills";

export function AllPulse() {
  const { P, LAST, erSnap, erBandCounts, openAudit, aCounts, auditList, lossSnap, setStatusFilter, setRatingFilter, setOpen, setMode, setTab } =
    useRisk();

  const jumpAudit = (status: string) => {
    setStatusFilter(status);
    setRatingFilter(null);
    setOpen(null);
    setMode("audit");
    setTab("register");
  };

  return (
    <div>
      <div className="hero">
        <div className="row between base">
          <span className="eyebrow">OPERATIONAL HEALTH</span>
          <span className="dim12">as at {P[LAST]}</span>
        </div>
        <div className="big">
          {erBandCounts.Target}
          <span style={{ fontSize: 22, opacity: 0.65 }}>/{erSnap.length}</span> <span style={{ fontSize: 22, opacity: 0.5 }}>·</span>{" "}
          {openAudit.length}
          <span style={{ fontSize: 22, opacity: 0.65 }}> open</span>
        </div>
        <div className="dim13">
          {erBandCounts.Target} KRIs on/ahead of target · {openAudit.length} audit point{openAudit.length === 1 ? "" : "s"} open (
          {aCounts["Past Due"]} past due)
        </div>
      </div>

      <div className="h2l">Enterprise risk — performance score</div>
      <div className="grid-status">
        <div className="card">
          <div className="num" style={{ color: "#0E8A4D" }}>
            {erBandCounts.Target}
          </div>
          <div className="sub" style={{ marginTop: 2 }}>
            On / Ahead of Target
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
          <div className="num16">{fmtNum(lossSnap && lossSnap.aj)}</div>
          <div className="sub" style={{ marginTop: 2 }}>
            Actual loss JMD
          </div>
        </div>
      </div>

      <div className="h2l">Audit register — status</div>
      <div className="grid-status">
        <button className="card btncard" onClick={() => jumpAudit("Past Due")}>
          <div className="num" style={{ color: "#8E0E1F" }}>
            {aCounts["Past Due"] || 0}
          </div>
          <div className="sub" style={{ marginTop: 2 }}>
            Past Due
          </div>
        </button>
        <button className="card btncard" onClick={() => jumpAudit("Open")}>
          <div className="num" style={{ color: "#A07208" }}>
            {aCounts["Open"] || 0}
          </div>
          <div className="sub" style={{ marginTop: 2 }}>
            Open
          </div>
        </button>
        <button className="card btncard" onClick={() => jumpAudit("Resolved")}>
          <div className="num" style={{ color: "#0E8A4D" }}>
            {aCounts["Resolved"] || 0}
          </div>
          <div className="sub" style={{ marginTop: 2 }}>
            Resolved
          </div>
        </button>
        <div className="card">
          <div className="num">{auditList.length}</div>
          <div className="sub" style={{ marginTop: 2 }}>
            Total tracked
          </div>
        </div>
      </div>

      {openAudit.filter((a) => a.status === "Past Due").length > 0 && (
        <div>
          <div className="h2l">Needs attention · past due</div>
          <div className="grid-measures">
            {openAudit
              .filter((a) => a.status === "Past Due")
              .map((a, i) => (
                <button
                  key={i}
                  className="erbtn"
                  onClick={() => {
                    setStatusFilter(null);
                    setRatingFilter(null);
                    setOpen(a.code + "|" + a.exc);
                    setMode("audit");
                    setTab("register");
                  }}
                >
                  <div className="row between base">
                    <div className="t13" style={{ flex: 1, paddingRight: 8 }}>
                      {a.exc}
                    </div>
                    <StatPill status={a.status} />
                  </div>
                  <div className="aptmeta">
                    <span>{a.owner}</span>
                    <span>·</span>
                    <span>due {fmtDate(a.due)}</span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: "#A89C97", textAlign: "center", margin: "22px 0 8px" }}>
        VMBS Operational Risk &amp; Audit Register · Owner: Nicola Anderson, COO
      </div>
    </div>
  );
}
