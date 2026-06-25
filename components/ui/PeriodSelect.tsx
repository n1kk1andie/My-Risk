"use client";

import { useRisk } from "@/components/risk-context";

/** "As of <month>" dropdown that drives which period the register screens reflect. */
export function PeriodSelect() {
  const { P, selPeriod, setSelPeriod } = useRisk();
  if (P.length === 0) return null;
  const last = P.length - 1;
  return (
    <div className="period-select">
      <span className="period-select-label">As of</span>
      <select
        className="period-select-input"
        value={selPeriod}
        onChange={(e) => setSelPeriod(Number(e.target.value))}
        aria-label="Select period"
      >
        {P.map((p, i) => (
          <option key={i} value={i}>
            {p}
            {i === last ? " · latest" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
