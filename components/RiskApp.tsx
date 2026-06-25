"use client";

import { useState } from "react";
import { useRisk, type Tab } from "@/components/risk-context";
import { VMLogo } from "@/components/ui/VMLogo";
import { AllPulse } from "@/components/screens/AllPulse";
import { AuditPulse } from "@/components/screens/AuditPulse";
import { ErPulse } from "@/components/screens/ErPulse";
import { AuditRegister } from "@/components/screens/AuditRegister";
import { ErRegister } from "@/components/screens/ErRegister";
import { PeriodSelect } from "@/components/ui/PeriodSelect";
import { AuditHistory } from "@/components/screens/AuditHistory";
import { ErHistory } from "@/components/screens/ErHistory";
import { Report } from "@/components/screens/Report";
import { Settings } from "@/components/screens/Settings";

const TABS: { id: Tab; label: (mode: string) => string; icon: string; admin?: boolean }[] = [
  { id: "pulse", label: () => "Pulse", icon: "M3 12h4l3-8 4 16 3-8h4" },
  { id: "register", label: (m) => (m === "audit" ? "Register" : m === "er" ? "Measures" : "Detail"), icon: "M4 6h16M4 12h16M4 18h10" },
  { id: "history", label: () => "History", icon: "M3 17l6-6 4 4 8-8" },
  { id: "report", label: () => "Report", icon: "M6 2h9l5 5v15H6zM14 2v6h6" },
  {
    id: "settings",
    label: () => "Settings",
    admin: true,
    icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  },
];

export function RiskApp() {
  const { mode, tab, admin, xlStatus, data, switchMode, setTab, setOpen, login, logout } = useRisk();

  const [pwOpen, setPwOpen] = useState(false);
  const [pwTry, setPwTry] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwNext, setPwNext] = useState<Tab | null>(null);

  const submitPw = async () => {
    const res = await login(pwTry);
    if (res.ok) {
      setPwOpen(false);
      setPwTry("");
      setPwErr("");
      if (pwNext) {
        setTab(pwNext);
        setPwNext(null);
      }
    } else {
      setPwErr(res.error || "Incorrect password.");
    }
  };

  const screen = () => {
    if (mode === "all") {
      if (tab === "pulse") return <AllPulse />;
      if (tab === "register")
        return (
          <div>
            <PeriodSelect />
            <ErRegister />
            <div className="h2l">Audit register</div>
            <AuditRegister />
          </div>
        );
      if (tab === "history")
        return (
          <div>
            <ErHistory />
            <div style={{ height: 8 }} />
            <AuditHistory />
          </div>
        );
      if (tab === "report") return <Report />;
      if (tab === "settings") return admin ? <Settings /> : null;
    } else if (mode === "audit") {
      if (tab === "pulse") return <AuditPulse />;
      if (tab === "register")
        return (
          <div>
            <PeriodSelect />
            <AuditRegister />
          </div>
        );
      if (tab === "history") return <AuditHistory />;
      if (tab === "report") return <Report />;
      if (tab === "settings") return admin ? <Settings /> : null;
    } else {
      if (tab === "pulse") return <ErPulse />;
      if (tab === "register")
        return (
          <div>
            <PeriodSelect />
            <ErRegister />
          </div>
        );
      if (tab === "history") return <ErHistory />;
      if (tab === "report") return <Report />;
      if (tab === "settings") return admin ? <Settings /> : null;
    }
    return null;
  };

  const srcLabel =
    xlStatus === "loading"
      ? "Checking…"
      : xlStatus === "live"
      ? `Live · ${data.newPeriods.length} new period${data.newPeriods.length === 1 ? "" : "s"}`
      : "Built-in data";

  return (
    <div className="shell">
      <div className="app">
        <div className="appbar">
          <VMLogo h={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="brand">VM Building Society</div>
            <div className="sub" style={{ fontWeight: 500 }}>
              Operational Risk &amp; Audit · Latest data: {data.periods[data.periods.length - 1]}
            </div>
          </div>
          <span className={`srcbadge${xlStatus === "live" ? " live" : ""}`}>{srcLabel}</span>
          {admin ? (
            <button className="userchip" title="Sign out of admin" onClick={() => logout()}>
              A
            </button>
          ) : (
            <button
              className="loginpill"
              onClick={() => {
                setPwOpen(true);
                setPwTry("");
                setPwErr("");
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 018 0v4" />
              </svg>
              Login
            </button>
          )}
        </div>

        <div style={{ padding: "2px 16px 8px" }}>
          <div className="toggle">
            <button className={mode === "all" ? "on" : ""} onClick={() => switchMode("all")}>
              All
            </button>
            <button className={mode === "audit" ? "on" : ""} onClick={() => switchMode("audit")}>
              Audit
            </button>
            <button className={mode === "er" ? "on" : ""} onClick={() => switchMode("er")}>
              Enterprise Risk
            </button>
          </div>
        </div>

        <div className="content">{screen()}</div>

        {pwOpen && (
          <div
            className="overlay"
            onClick={() => {
              setPwOpen(false);
              setPwErr("");
            }}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <button
                className="modalx"
                onClick={() => {
                  setPwOpen(false);
                  setPwErr("");
                }}
              >
                ✕
              </button>
              <div className="t15" style={{ marginBottom: 4 }}>
                Admin sign-in
              </div>
              <div className="sub13" style={{ marginBottom: 12 }}>
                Enter the admin password to update figures.
              </div>
              {pwErr && <div className="errmsg">{pwErr}</div>}
              <input
                className="login-in"
                type="password"
                placeholder="Password"
                value={pwTry}
                autoFocus
                onChange={(e) => {
                  setPwTry(e.target.value);
                  setPwErr("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitPw();
                }}
              />
              <button className="cta" onClick={submitPw}>
                Unlock
              </button>
            </div>
          </div>
        )}

        <div className="tabbar">
          {TABS.map(({ id, label, icon, admin: adm }) => (
            <button
              key={id}
              className={"tabbtn" + (tab === id ? " on" : "")}
              onClick={() => {
                if (adm && !admin) {
                  setPwNext(id);
                  setPwOpen(true);
                  return;
                }
                setTab(id);
                setOpen(null);
                window.scrollTo(0, 0);
              }}
            >
              <span className="iconwrap">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icon} />
                </svg>
                {adm && !admin && (
                  <span className="tablock">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8A7E7A" strokeWidth="3">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </span>
                )}
              </span>
              <span>{label(mode)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
