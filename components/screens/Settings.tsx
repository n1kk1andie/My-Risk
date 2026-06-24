"use client";

import { useState } from "react";
import { useRisk } from "@/components/risk-context";

const INSTRUCTIONS = [
  { n: "1", title: "Download", body: 'Tap "Download data.xlsx" above to get the current file (built from the live data).' },
  {
    n: "2",
    title: "er sheet — KRI values",
    body: "Add a new column for the new month (e.g. Jun '26). Use the same header format. Enter each KRI's actual value. Percentages as decimals e.g. 0.97 for 97%. Leave blank if no data.",
  },
  { n: "3", title: "gov sheet — audit counts", body: "Add a new row for the month with open internal and external audit-point counts. Total calculates automatically." },
  { n: "4", title: "pfl sheet — financial loss", body: "Add a new row for the month: potential loss, recovered, and actual loss (JMD), and the transaction count." },
  {
    n: "5",
    title: "audit sheet — new points",
    body: "Add one row per new audit point: code, exception, owner, rating, status, issue date, due date, first seen period.",
  },
  { n: "6", title: "Upload & verify", body: 'Save the file, then tap "Upload updated data.xlsx" below. The app merges, persists for all users, and refreshes.' },
];

export function Settings() {
  const { xlStatus, data, refreshData, logout } = useRisk();
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const isOk = msg.startsWith("✓");

  const upload = async (file: File) => {
    setUploading(true);
    setMsg("Uploading…");
    setWarnings([]);
    try {
      const fd = new FormData();
      fd.append("file", file, "data.xlsx");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok && j.ok) {
        await refreshData();
        const s = j.stats || {};
        const n = (j.newPeriods || []).length;
        const bits = [
          n ? `${n} new month${n === 1 ? "" : "s"} (${(j.newPeriods || []).join(", ")})` : "no new months",
          `${s.auditPoints ?? 0} audit points${s.newAuditPoints ? ` (${s.newAuditPoints} new)` : ""}`,
        ];
        if (s.newMeasures?.length) bits.push(`${s.newMeasures.length} new measure${s.newMeasures.length === 1 ? "" : "s"}`);
        setMsg(`✓ Saved & published for all users — ${bits.join(" · ")}.`);
        setWarnings(j.warnings || []);
      } else {
        setMsg(j.error || "Upload failed.");
      }
    } catch (e) {
      setMsg("Upload failed: " + (e as Error).message);
    }
    setUploading(false);
  };

  const liveLabel =
    xlStatus === "live"
      ? `Live · ${data.newPeriods.length} new period${data.newPeriods.length === 1 ? "" : "s"} loaded`
      : xlStatus === "loading"
      ? "Checking for data…"
      : "Built-in data · Jan '24 – May '26";

  return (
    <div>
      <div className="h2l">Data file</div>
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="row between mid" style={{ marginBottom: 12 }}>
          <div>
            <div className="t14">Current data</div>
            <div className="sub13" style={{ marginTop: 3 }}>
              {liveLabel}
            </div>
          </div>
          <span className={`srcbadge${xlStatus === "live" ? " live" : ""}`}>{xlStatus === "live" ? "Live" : "Built-in"}</span>
        </div>
        <div className="row gap8" style={{ marginBottom: 10 }}>
          <a className="cta" style={{ flex: 1, textAlign: "center", textDecoration: "none", display: "block" }} href="/api/file">
            ⬇ Download data.xlsx
          </a>
          <button
            className="cta"
            style={{ flex: 1, background: "#1C1416" }}
            onClick={() => {
              setMsg("Refreshing…");
              refreshData().then(() => setTimeout(() => setMsg(""), 1500));
            }}
          >
            ↺ Refresh data
          </button>
        </div>
        <label
          style={{
            display: "block",
            padding: "12px 16px",
            borderRadius: 12,
            border: "2px dashed #EEE7E3",
            textAlign: "center",
            cursor: "pointer",
            background: "#FAFAFA",
            fontSize: 13,
            color: "#6E625E",
          }}
        >
          {uploading ? "Uploading…" : "⬆ Upload updated data.xlsx"}
          <input
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
        {msg && (
          <div
            style={{
              fontSize: 12,
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 8,
              background: isOk ? "#E5F4EC" : "#FBF2DC",
              color: isOk ? "#0E8A4D" : "#A07208",
              lineHeight: 1.5,
            }}
          >
            {msg}
          </div>
        )}
        {warnings.length > 0 && (
          <div
            style={{
              fontSize: 12,
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 8,
              background: "#FBF0E5",
              color: "#A0540B",
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Check these:</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {warnings.map((w, i) => (
                <li key={i} style={{ marginBottom: 2 }}>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 10 }}>
        <div className="t14" style={{ marginBottom: 10 }}>
          Monthly update instructions
        </div>
        {INSTRUCTIONS.map(({ n, title, body }) => (
          <div
            key={n}
            style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: n !== "1" ? "1px solid #F1ECE9" : "none", alignItems: "flex-start" }}
          >
            <div style={{ fontFamily: "Sora", fontSize: 11, fontWeight: 800, color: "var(--red)", flexShrink: 0, paddingTop: 2, minWidth: 16 }}>
              {n}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{title}</div>
              <div className="sub13" style={{ lineHeight: 1.5 }}>
                {body}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="h2l" style={{ marginTop: 18 }}>
        Admin session
      </div>
      <div className="card">
        <div className="sub13" style={{ marginBottom: 12 }}>
          You are signed in as admin. The sign-in password is configured on the server (ADMIN_PASSWORD); contact ICT to change it.
        </div>
        <button className="cta2" onClick={() => logout()}>
          Sign out
        </button>
      </div>

      <div style={{ fontSize: 11, color: "#A89C97", textAlign: "center", margin: "18px 0 8px" }}>
        The uploaded data.xlsx is the official data record.
      </div>
    </div>
  );
}
