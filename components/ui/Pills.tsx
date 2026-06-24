import { RATING, STATUSC } from "@/lib/rag";

export function StatPill({ status }: { status: string }) {
  const s = STATUSC[status] || STATUSC.Open;
  return (
    <span className="statpill" style={{ background: s.bg, color: s.c }}>
      {status}
    </span>
  );
}

export function RatingPill({ rating }: { rating: string }) {
  const r = RATING[rating] || RATING.Unrated;
  return (
    <span className="statpill" style={{ background: r.bg, color: r.c }}>
      {rating}
    </span>
  );
}
