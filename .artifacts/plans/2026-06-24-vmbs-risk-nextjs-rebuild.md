## Implementation Plan: VMBS Operational Risk & Audit Register — proper Next.js rebuild

### Overview
Rebuild the single-file `index.html` risk dashboard as a bundled Next.js 14 (App Router) +
TypeScript app that deploys to **Azure** (production) and **Vercel** (staging), keeping the
UI pixel-identical while fixing the architecture: server-side xlsx processing, durable
storage for uploads, and real admin auth.

### Decisions (confirmed with user, 2026-06-24)
- **Scope:** full rebuild, real components, TypeScript, out of `/public`.
- **Storage:** keep the Excel-upload workflow, but persist via a pluggable adapter. **Azure
  Blob** is the production driver; `vercel-blob` for staging; `local-fs` for dev.
- **Auth:** server-side password → signed httpOnly session cookie (replaces the client-only
  `pa55w0rd` check and the hardcoded `x-admin-key` shipped to browsers).
- **xlsx:** processed server-side in an API route (not client SheetJS).

### Design Approach
- Next.js App Router; `app/page.tsx` renders a client app (NOT a redirect to a static file).
- One React Context (`RiskProvider`) holds state + derived data; each screen is its own
  component consuming `useRisk()` — faithful port of the original screen logic.
- Pure logic extracted to `lib/` (rag, periods, xlsx, storage, auth, types); data to `data/`.

### Data Model (unchanged from source)
- `er` (15 KRIs: target/tol/lim + monthly series + bands), `audit` (findings + monthly
  timeline), `gov` (internal/external audit points), `pfl` (potential/recovered/actual loss JMD).
- Built-in seed: 29 months Jan '24–May '26, extracted losslessly from `index.html`.

### Files to Create
| Area | Files |
|---|---|
| Config | package.json, tsconfig.json, next.config.mjs, .env.example, .gitignore |
| Data | data/seed.json (extracted), data/seed.ts |
| Lib | types.ts, rag.ts, periods.ts, xlsx.ts, storage.ts, auth.ts, dataset.ts |
| API | api/data, api/file, api/upload, api/login, api/logout |
| UI shell | app/layout.tsx, app/globals.css, app/page.tsx, components/RiskApp.tsx, risk-context.tsx |
| Screens | AllPulse, AuditPulse, ErPulse, AuditRegister, ErRegister, AuditHistory, ErHistory, Report, Settings |
| UI atoms | VMLogo, Pills |

### Integration Points
- `GET /api/data` → `getCurrentDataset()` → storage.read() → `mergeWorkbook()` → JSON.
- `POST /api/upload` → `isAdmin()` gate → validate via `mergeWorkbook()` → `storage.write()`.
- Client `risk-context` fetches `/api/data` and `/api/login` (status) on mount.

### Testing Strategy
- `tsc --noEmit` + `next build`.
- Runtime smoke: data API (built-in), page render, upload 401 without auth, login cookie,
  download template → add `Jun '26` across all sheets → upload → assert merge (periods 29→30,
  no audit duplication, status edits apply, new-point timeline correct).

### Risks / Considerations
- Original latent bugs to fix: merge referenced out-of-scope `D.er`; period comparison used
  string order (`"Mar" > "Jun"`); upload wrote to ephemeral `/public`.
- Audit sheet is full-register replace (download-edit-reupload), enriched with seed timelines —
  avoids duplicating the 15 seed points on re-upload.
- Vercel filesystem is read-only → must use Blob there. Azure App Service `/home` is durable.
