"use client";

import { useRisk } from "@/components/risk-context";
import { auditStatusAsOf } from "@/lib/audit";
import { BAND, STATUSC, fmtDate, fmtNum, fmtPct } from "@/lib/rag";

function dl(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1500);
}

export function Report() {
  const { mode, P, LAST, erSnap, auditList, erBandCounts, openAudit, aCounts, lossSnap } = useRisk();

  // Effective (due-date aware) status as at the latest period, matching the on-screen
  // dashboards and register — so the exported Status column agrees with the counts.
  const effStatus = (a: (typeof auditList)[number]) => auditStatusAsOf(a, LAST, P) ?? a.status;

  const buildPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      doc.setFillColor(228, 1, 43);
      doc.rect(0, 0, W, 54, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      const title = mode === "audit" ? "Audit Register" : mode === "er" ? "Operational Risk" : "Operational Risk & Audit";
      doc.text("VM Building Society — " + title, 28, 26);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("As at " + P[LAST] + " · VMBS Operational Risk", 28, 42);

      const erTable = (startY: number) => {
        const rows = erSnap.map((m) => [
          m.name,
          m.isPct ? fmtPct(m.target) : String(m.target_raw || "—"),
          m.isPct ? fmtPct(m.latest) : fmtNum(m.latest),
          ((m.band && BAND[m.band]) || BAND.Target).label,
        ]);
        autoTable(doc, {
          startY,
          head: [["Measure", "Target", "Latest", "Band"]],
          body: rows,
          styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4 },
          headStyles: { fillColor: [28, 20, 22], textColor: 255 },
          columnStyles: { 0: { cellWidth: 360 } },
          didParseCell: (d: any) => {
            if (d.section === "body" && d.column.index === 3) {
              const bb = Object.values(BAND).find((x) => x.label === d.cell.raw);
              if (bb) d.cell.styles.fillColor = bb.bg.match(/\w\w/g)!.map((x) => parseInt(x, 16));
            }
          },
        });
      };
      const auditTable = (startY: number) => {
        const rows = auditList.map((a) => [a.exc, a.rating, a.owner, effStatus(a), fmtDate(a.due)]);
        autoTable(doc, {
          startY,
          head: [["Audit Point", "Rating", "Owner", "Status", "Due"]],
          body: rows,
          styles: { font: "helvetica", fontSize: 8, cellPadding: 3, valign: "top" },
          headStyles: { fillColor: [28, 20, 22], textColor: 255 },
          columnStyles: { 0: { cellWidth: 330 } },
          didParseCell: (d: any) => {
            if (d.section === "body" && d.column.index === 3) {
              const s = STATUSC[d.cell.raw as string];
              if (s) d.cell.styles.fillColor = s.bg.match(/\w\w/g)!.map((x) => parseInt(x, 16));
            }
          },
        });
      };

      if (mode === "audit") {
        auditTable(64);
      } else if (mode === "er") {
        erTable(64);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(28, 20, 22);
        doc.text("Enterprise Risk — Operational KRIs", 28, 70);
        erTable(78);
        doc.addPage("a4", "landscape");
        doc.setFillColor(228, 1, 43);
        doc.rect(0, 0, W, 54, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text("VM Building Society — Audit Register", 28, 26);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("As at " + P[LAST] + " · VMBS", 28, 42);
        auditTable(64);
      }
      const tag = mode === "audit" ? "Audit" : mode === "er" ? "OpRisk" : "OpRisk_Audit";
      dl("VMBS_" + tag + "_" + P[LAST].replace(/[ ']/g, "") + ".pdf", doc.output("blob"));
    } catch (e) {
      alert("Could not build the PDF: " + (e as Error).message);
    }
  };

  const buildCSV = () => {
    const { erList, auditList: aList } = { erList: erSnap, auditList };
    const auditCsv =
      "Audit Point,Rating,Owner,Status,Issue Date,Due Date,First Seen,Last Seen\n" +
      aList
        .map((a) =>
          [a.exc, a.rating, a.owner, effStatus(a), a.issue || "", a.due || "", a.first, a.last]
            .map((x) => '"' + String(x).replace(/"/g, '""') + '"')
            .join(",")
        )
        .join("\n");
    const erCsv =
      "Measure,Target,Tolerance,Limit," +
      P.join(",") +
      "\n" +
      erList
        .map((m) =>
          [m.name, m.target_raw || "", m.tol || "", m.lim || "", ...m.s.map((v) => (v == null ? "" : v))]
            .map((x) => '"' + String(x).replace(/"/g, '""') + '"')
            .join(",")
        )
        .join("\n");
    let csv: string;
    if (mode === "audit") csv = auditCsv;
    else if (mode === "er") csv = erCsv;
    else csv = "ENTERPRISE RISK — OPERATIONAL KRIs\n" + erCsv + "\n\nAUDIT REGISTER\n" + auditCsv;
    const tag = mode === "audit" ? "Audit" : mode === "er" ? "OpRisk" : "OpRisk_Audit";
    dl("VMBS_" + tag + "_" + P[LAST].replace(/[ ']/g, "") + ".csv", new Blob([csv], { type: "text/csv" }));
  };

  return (
    <div>
      <div className="card">
        <div className="t15">Download report</div>
        <div className="sub13" style={{ marginTop: 4, marginBottom: 14 }}>
          {mode === "audit"
            ? "Full VMBS audit register with rating, owner, status and due dates."
            : mode === "er"
            ? "Operational risk measures with target, latest actual and score band."
            : "Combined operational risk + audit register — both sections in one file."}{" "}
          As at {P[LAST]}.
        </div>
        <button className="cta shadow" onClick={buildPDF}>
          Download PDF
        </button>
        <button className="cta2" onClick={buildCSV}>
          Download CSV (full history)
        </button>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="t14">What&apos;s in this view</div>
        <table className="kvtable">
          <tbody>
            {mode !== "audit" && (
              <>
                <tr>
                  <td>KRIs on / ahead</td>
                  <td>
                    {erBandCounts.Target} of {erSnap.length}
                  </td>
                </tr>
                <tr>
                  <td>KRIs below target</td>
                  <td>{erBandCounts.Tolerance}</td>
                </tr>
                <tr>
                  <td>Actual loss JMD</td>
                  <td>{fmtNum(lossSnap && lossSnap.aj)}</td>
                </tr>
              </>
            )}
            {mode !== "er" && (
              <>
                <tr>
                  <td>Open audit points</td>
                  <td>
                    {openAudit.length} ({aCounts["Past Due"]} past due)
                  </td>
                </tr>
                <tr>
                  <td>Resolved to date</td>
                  <td>{aCounts["Resolved"]}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
