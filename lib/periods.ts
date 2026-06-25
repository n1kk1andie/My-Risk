// Period-label helpers shared by the server-side xlsx merge and the UI.
// A "period" is a short label like "Jun '26"; "periodFull" is "June 2026".

const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_FULL: Record<string, string> = {
  Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June",
  Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December",
};

/** Normalise an Excel header/cell into the canonical "Mon 'YY" form. */
export function normalizePeriod(p: unknown): string | null {
  if (p == null || p === "") return null;
  const s = String(p)
    .trim()
    .replace(/[‘’‚‛′ʼ]/g, "'"); // curly/smart quotes -> straight
  const full = s.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i
  );
  if (full) {
    const mo = full[1].slice(0, 3);
    const mo3 = mo.charAt(0).toUpperCase() + mo.slice(1).toLowerCase();
    return `${mo3} '${full[2].slice(2)}`;
  }
  return s;
}

/** "Jun '26" -> "June 2026". */
export function expandPeriod(p: string): string {
  const [mo, yr] = p.split(" ");
  return (MON_FULL[mo] || mo) + " 20" + (yr || "").replace("'", "");
}

/** Three-letter month from a short period label. */
export function mon3(p: string): string {
  return p.split(" ")[0].slice(0, 3);
}

/** Last calendar day of a period, e.g. "Jun '26" -> 30 Jun 2026. null if unparseable. */
export function periodEndDate(p: string): Date | null {
  const [mo, yr] = p.split(" ");
  const mi = MON3.indexOf((mo || "").slice(0, 3));
  const yy = (yr || "").replace("'", "");
  if (mi < 0 || !/^\d{2}$/.test(yy)) return null;
  return new Date(2000 + Number(yy), mi + 1, 0); // day 0 of next month = last day of this one
}

export { MON3, MON_FULL };
