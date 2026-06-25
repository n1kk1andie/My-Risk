"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuditPoint, Band, DataResponse, ErMeasure, PflRow } from "@/lib/types";
import { auditStatusAsOf } from "@/lib/audit";
import { SEED } from "@/data/seed";

export type Mode = "all" | "audit" | "er";
export type Tab = "pulse" | "register" | "history" | "report" | "settings";
export type XlStatus = "loading" | "live" | "builtin";

/** A heatmap cell tap, or an audit-history bar tap. */
export type CellSel =
  | { m: ErMeasure; mi: number; v: number | null }
  | { pi: number; d: { pastDue: number; open: number; resolved: number; total: number } }
  | null;

export interface ErSnap extends ErMeasure {
  latest: number | null;
  latestIdx: number;
  band: Band | null;
}

interface RiskCtx {
  data: DataResponse;
  P: string[];
  LAST: number;
  xlStatus: XlStatus;
  admin: boolean;
  authConfigured: boolean;
  mode: Mode;
  tab: Tab;
  open: string | null;
  statusFilter: string | null;
  ratingFilter: string | null;
  cell: CellSel;
  /** Index into `P` for the register's "as of" period. Defaults to the latest. */
  selPeriod: number;
  auditList: AuditPoint[];
  erList: ErMeasure[];
  aCounts: Record<string, number>;
  openAudit: AuditPoint[];
  erSnap: ErSnap[];
  erBandCounts: { Target: number; Limit: number; Tolerance: number };
  lossSnap: PflRow | undefined;
  setTab: (t: Tab) => void;
  setOpen: (o: string | null) => void;
  setMode: (m: Mode) => void;
  setStatusFilter: (s: string | null) => void;
  setRatingFilter: (s: string | null) => void;
  setCell: (c: CellSel) => void;
  setSelPeriod: (i: number) => void;
  switchMode: (m: Mode) => void;
  refreshData: () => Promise<void>;
  login: (pw: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
}

const Ctx = createContext<RiskCtx | null>(null);

export function useRisk(): RiskCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRisk must be used within RiskProvider");
  return c;
}

const SEED_RESPONSE: DataResponse = { ...SEED, source: "builtin", newPeriods: [] };

// Audit points are limited to these owners (matched on any name token in the owner
// field, case-insensitive — e.g. "Nicola Anderson, COO" matches "Nicola").
const ALLOWED_OWNERS = new Set(["paul", "devon", "nicola", "lesa"]);
function ownerAllowed(owner: string): boolean {
  return (owner || "")
    .toLowerCase()
    .split(/[\s,]+/)
    .some((token) => ALLOWED_OWNERS.has(token));
}

export function RiskProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DataResponse>(SEED_RESPONSE);
  const [xlStatus, setXlStatus] = useState<XlStatus>("loading");
  const [admin, setAdmin] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(false);

  const [mode, setMode] = useState<Mode>("all");
  const [tab, setTab] = useState<Tab>("pulse");
  const [open, setOpen] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [ratingFilter, setRatingFilter] = useState<string | null>(null);
  const [cell, setCell] = useState<CellSel>(null);
  const [selPeriod, setSelPeriod] = useState<number>(0);

  const refreshData = useCallback(async () => {
    setXlStatus("loading");
    try {
      const resp = await fetch("/api/data", { cache: "no-store" });
      if (!resp.ok) throw new Error(String(resp.status));
      const json = (await resp.json()) as DataResponse;
      setData(json);
      setXlStatus(json.source === "live" ? "live" : "builtin");
    } catch {
      setData(SEED_RESPONSE);
      setXlStatus("builtin");
    }
  }, []);

  useEffect(() => {
    refreshData();
    fetch("/api/login", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { admin: boolean; configured: boolean }) => {
        setAdmin(Boolean(j.admin));
        setAuthConfigured(Boolean(j.configured));
      })
      .catch(() => {});
  }, [refreshData]);

  const login = useCallback(async (pw: string) => {
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        setAdmin(true);
        return { ok: true };
      }
      return { ok: false, error: j.error || "Sign-in failed." };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    setAdmin(false);
    setTab((t) => (t === "settings" ? "pulse" : t));
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const r = await fetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const j = await r.json();
      if (r.ok && j.ok) return { ok: true };
      return { ok: false, error: j.error || "Could not update password." };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }, []);

  const P = data.periods;
  const LAST = P.length - 1;

  // Default the register's "as of" period to the latest whenever the dataset changes.
  useEffect(() => {
    setSelPeriod(data.periods.length - 1);
  }, [data.periods.length]);
  // The register is limited to audit points owned by these four people; everything
  // downstream (counts, dashboards, history, report) derives from this filtered list.
  const auditList = useMemo(() => data.audit.filter((a) => ownerAllowed(a.owner)), [data.audit]);
  const erList = data.er;

  // Classify each point by its effective status (due-date aware) as at the latest period,
  // so the dashboards, report and register chips all agree and reflect overdue items.
  const auditEval = useMemo(
    () => auditList.map((a) => ({ a, eff: auditStatusAsOf(a, P.length - 1, P) })),
    [auditList, P]
  );
  const aCounts = useMemo(() => {
    const c: Record<string, number> = { "Past Due": 0, Open: 0, Resolved: 0 };
    auditEval.forEach(({ eff }) => {
      if (eff) c[eff] = (c[eff] || 0) + 1;
    });
    return c;
  }, [auditEval]);
  const openAudit = useMemo(
    () => auditEval.filter(({ eff }) => eff && eff !== "Resolved").map(({ a, eff }) => ({ ...a, status: eff as string })),
    [auditEval]
  );

  const erSnap = useMemo<ErSnap[]>(
    () =>
      erList.map((m) => {
        let li = -1;
        for (let i = m.s.length - 1; i >= 0; i--) {
          if (m.s[i] != null) {
            li = i;
            break;
          }
        }
        const band = li >= 0 ? m.bands[li] : null;
        return { ...m, latest: li >= 0 ? m.s[li] : null, latestIdx: li, band };
      }),
    [erList]
  );

  const erBandCounts = useMemo(() => {
    const c = { Target: 0, Limit: 0, Tolerance: 0 } as { Target: number; Limit: number; Tolerance: number };
    erSnap.forEach((m) => {
      const b = (m.band === "Breach" ? "Tolerance" : m.band) as keyof typeof c;
      if (b && c[b] != null) c[b]++;
    });
    return c;
  }, [erSnap]);

  const lossSnap = data.pfl[data.pfl.length - 1];

  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m);
      setOpen(null);
      setStatusFilter(null);
      setRatingFilter(null);
      setCell(null);
      if (tab === "settings" && !admin) setTab("pulse");
      window.scrollTo(0, 0);
    },
    [tab, admin]
  );

  const value: RiskCtx = {
    data, P, LAST, xlStatus, admin, authConfigured,
    mode, tab, open, statusFilter, ratingFilter, cell, selPeriod,
    auditList, erList, aCounts, openAudit, erSnap, erBandCounts, lossSnap,
    setTab, setOpen, setMode, setStatusFilter, setRatingFilter, setCell, setSelPeriod,
    switchMode, refreshData, login, logout, changePassword,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
