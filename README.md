# VM Building Society — Operational Risk & Audit Register

A bundled **Next.js 14 (App Router) + TypeScript** rebuild of the VMBS operational-risk &
audit dashboard. Production target is **Microsoft Azure**; Vercel is a staging ground.

This replaces the original single-file `index.html` (React + Babel-in-browser via CDN) and
the earlier Next.js port that wrote uploads into `/public` (which can't persist on serverless
hosts). The UI is pixel-identical; the architecture is now proper:

- Real bundled React components — **no Babel-in-browser, no CDN React, nothing served from `/public`**.
- The **xlsx is processed server-side** (`/api/data`) — the browser never runs SheetJS.
- Uploaded data persists through a **pluggable storage adapter** (Azure Blob / Vercel Blob / local FS).
- Admin upload is gated by **server-side password → signed httpOnly session cookie** (no secret shipped to the browser).

---

## How it works

```
Browser ──GET /api/data──▶ server reads data.xlsx from storage ──▶ parse + merge with built-in
                            seed (Jan '24–May '26) ──▶ returns merged JSON ──▶ UI renders

Admin ──login (password)──▶ /api/login sets signed session cookie
      ──upload data.xlsx──▶ /api/upload (cookie-gated) validates + writes to storage
                            ──▶ everyone sees it on next load
```

The built-in history is baked into `data/seed.json`. Only months **after `May '26`** in an
uploaded workbook are merged in — older months always come from the seed.

## Project structure

```
app/
  layout.tsx · globals.css · page.tsx        UI shell (page renders the client app — not a redirect)
  api/data    GET   parse+merge stored xlsx -> JSON      (the xlsx-processing API)
  api/file    GET   build current data -> downloadable data.xlsx
  api/upload  POST  admin-only; validate + persist xlsx
  api/login   POST password -> session cookie · GET session status
  api/logout  POST clear session
components/
  RiskApp.tsx · risk-context.tsx             app shell + state/derived-data context
  screens/*                                  Pulse / Register / History / Report / Settings (per mode)
  ui/*                                       VMLogo, status/rating pills
lib/
  types.ts · rag.ts · periods.ts             domain types, RAG colours/bands, period helpers
  xlsx.ts                                    server-side parse + merge + workbook build
  storage.ts                                 Azure Blob / Vercel Blob / local-fs adapter
  auth.ts · dataset.ts                       session signing; effective-dataset resolver
data/seed.ts · seed.json                     built-in history (Jan '24 – May '26)
legacy/                                      the original index.html + zip, for reference
```

## Local development

```bash
npm install
cp .env.example .env.local        # set ADMIN_PASSWORD + SESSION_SECRET
npm run dev                       # http://localhost:3000
```

With no storage env vars set, uploads are written to `./.data/data.xlsx` (the `local-fs` driver).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | prod | Admin sign-in password (server-verified). Upload is disabled if unset. |
| `SESSION_SECRET` | prod | Signs the session cookie. `openssl rand -base64 32`. |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure | Selects the `azure-blob` driver. |
| `AZURE_STORAGE_CONTAINER` | no | Container name (default `vmbs-risk`). |
| `AZURE_STORAGE_BLOB` | no | Blob name (default `data.xlsx`). |
| `BLOB_READ_WRITE_TOKEN` | Vercel | Selects the `vercel-blob` driver (auto-injected by Vercel Blob). |
| `STORAGE_DRIVER` | no | Force a driver: `azure-blob` \| `vercel-blob` \| `local-fs`. |
| `DATA_DIR` | no | For `local-fs`: directory to read/write (e.g. Azure App Service's persistent `/home/data`). |

Driver auto-selection order: `AZURE_STORAGE_CONNECTION_STRING` → `BLOB_READ_WRITE_TOKEN` → `local-fs`.

## Deploy — Microsoft Azure (production)

**Azure App Service (Node 18/20) — recommended, no extra infrastructure.**
App Service's `/home` filesystem is **persistent** — it survives restarts and redeploys and is
shared across scaled-out instances (backed by Azure Files). So the app just stores `data.xlsx`
on the same host it runs on; **no separate Storage account is needed.**
1. `npm run build`, deploy the repo (App Service runs `npm start`).
2. Configuration → set `ADMIN_PASSWORD` and `SESSION_SECRET`. **That's it** — storage
   auto-detects App Service and uses `/home/data`.
3. Custom-container deploys only: also set `WEBSITES_ENABLE_APP_SERVICE_STORAGE=true` so `/home` is mounted.

**Prefer a managed store, or deploying somewhere without a persistent disk?**
Create an Azure Storage account and set `AZURE_STORAGE_CONNECTION_STRING` — the app switches to
the `azure-blob` driver automatically. Use this on **Static Web Apps / Container Apps**, whose
filesystems are not durable.

## Deploy — Vercel (staging)

1. Import the repo (auto-detected as Next.js).
2. Add **Vercel Blob** (injects `BLOB_READ_WRITE_TOKEN`) — required, since Vercel's filesystem is read-only.
3. Set `ADMIN_PASSWORD` and `SESSION_SECRET`.

## Sandra's monthly workflow

Settings → **Download data.xlsx** → add the new month (new `er` column; new `gov`/`pfl` rows; new
`audit` rows) → **Upload updated data.xlsx**. The server validates, persists, and all users see it
on next load. The `audit` sheet is the full register (download-edit-reupload); `er`/`gov`/`pfl`
only contribute months after `May '26`.
