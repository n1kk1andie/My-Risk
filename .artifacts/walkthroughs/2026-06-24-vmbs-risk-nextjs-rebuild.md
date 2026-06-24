## Walkthrough: VMBS Risk Register — Next.js rebuild

### What changed
The single-file `index.html` app (React + Babel-in-browser via CDN) and the `/public`-writing
Next.js port were replaced by a bundled **Next.js 14 App Router + TypeScript** app.

- **Out of `/public`:** the app is now real bundled React components; the page renders the app
  directly (no redirect to a static HTML blob, no in-browser Babel, no CDN React).
- **Server-side xlsx:** `GET /api/data` reads the stored workbook, parses + merges it with the
  built-in seed (`lib/xlsx.ts`), and returns JSON. The browser no longer runs SheetJS.
- **Durable storage:** `lib/storage.ts` is a pluggable adapter — `azure-blob` (Microsoft prod),
  `vercel-blob` (staging), `local-fs` (dev), auto-selected by env. Fixes the original's fatal
  flaw of writing uploads into the read-only/ephemeral `/public`.
- **Real auth:** `lib/auth.ts` — `ADMIN_PASSWORD` verified server-side, exchanged for a signed
  httpOnly session cookie that gates `POST /api/upload`. No secret is shipped to the browser.
- **Bugs fixed vs. original:** merge no longer references an out-of-scope `D.er`; period
  comparison is chronological (was lexical `"Mar" > "Jun"`); audit sheet is full-register
  replace (no duplication of the 15 seed points on re-upload), enriched with seed timelines.
- **UI:** pixel-identical — CSS, RAG palette, Sora/IBM Plex fonts, all screens and modes ported faithfully.

### How to verify
```bash
npm install
ADMIN_PASSWORD=test123 SESSION_SECRET=$(openssl rand -base64 32) npm run dev
```
- Open http://localhost:3000 — All / Audit / Enterprise Risk modes, all five tabs.
- Lock icon → Login (`test123`) → Settings unlocks → Download data.xlsx, edit, re-upload.

Automated checks run during the build (all passing):
- `tsc --noEmit` clean; `next build` clean (page static, 5 API routes as server functions).
- Upload round-trip: periods 29→30 on adding `Jun '26`; upload returns 401 without the cookie;
  audit count stays correct (no duplication); status edits apply; new-point timeline `[…,0,1]`.

### Follow-ups / known limitations
- Provision storage before production upload works: Azure Storage account (set
  `AZURE_STORAGE_CONNECTION_STRING`) or Vercel Blob (`BLOB_READ_WRITE_TOKEN`).
- History is seed-immutable: editing an **old** `er`/`gov`/`pfl` value in the workbook won't
  override the built-in seed — only months after `May '26` merge. (Audit is full-replace.)
- The original's per-device localStorage edit/Entry features were intentionally dropped in
  favour of the confirmed Excel-upload workflow.
- `legacy/` holds the original `index.html` and zip for reference; safe to delete later.
- `data.xlsx` at the repo root is the user's original data file (no longer read at runtime).
