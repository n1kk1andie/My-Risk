"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuditPoint, Band, DataResponse, ErMeasure, PflRow } from "@/lib/types";
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

function auditCounts(list: AuditPoint[]): Record<string, number> {
  const c: Record<string, number> = { "Past Due": 0, Open: 0, Resolved: 0 };
  list.forEach((a) => {
    c[a.status] = (c[a.status] || 0) + 1;
  });
  return c;
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
  const auditList = data.audit;
  const erList = data.er;

  const aCounts = useMemo(() => auditCounts(auditList), [auditList]);
  const openAudit = useMemo(() => auditList.filter((a) => a.status !== "Resolved"), [auditList]);

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
    mode, tab, open, statusFilter, ratingFilter, cell,
    auditList, erList, aCounts, openAudit, erSnap, erBandCounts, lossSnap,
    setTab, setOpen, setMode, setStatusFilter, setRatingFilter, setCell,
    switchMode, refreshData, login, logout, changePassword,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
