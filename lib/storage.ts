// Pluggable storage adapter for the persisted data.xlsx.
//
// Production target is Microsoft/Azure; Vercel is a staging ground; local-fs is for dev.
// The driver is chosen by whichever env var is present (or STORAGE_DRIVER to force it):
//   AZURE_STORAGE_CONNECTION_STRING -> azure-blob   (Microsoft, production)
//   BLOB_READ_WRITE_TOKEN           -> vercel-blob   (Vercel staging)
//   (none)                          -> local-fs      (./.data/data.xlsx, dev only)
//
// The whole point of this layer: the original app wrote uploads into /public, which is
// read-only/ephemeral on Vercel. Object storage (Azure/Vercel Blob) survives cold starts.

export type StorageDriverName = "azure-blob" | "vercel-blob" | "local-fs";

export interface StorageDriver {
  name: StorageDriverName;
  read(): Promise<Buffer | null>;
  write(buf: Buffer): Promise<void>;
}

/**
 * Find the Vercel Blob read/write token.
 *
 * Normally it's BLOB_READ_WRITE_TOKEN, but a connected Blob store can expose the
 * token under a non-standard env var name (e.g. when the store isn't the project
 * default). Every Vercel Blob R/W token's *value* starts with "vercel_blob_rw_",
 * so we fall back to matching by value — making detection independent of the var name.
 */
export function vercelBlobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  for (const v of Object.values(process.env)) {
    if (typeof v === "string" && v.startsWith("vercel_blob_rw_")) return v;
  }
  return undefined;
}

export function activeDriverName(): StorageDriverName {
  const forced = process.env.STORAGE_DRIVER as StorageDriverName | undefined;
  if (forced) return forced;
  if (process.env.AZURE_STORAGE_CONNECTION_STRING) return "azure-blob";
  if (vercelBlobToken()) return "vercel-blob";
  // On Vercel the filesystem is read-only, so local-fs can't work there. If we got
  // this far on Vercel, storage is misconfigured — surface it instead of failing later
  // with a cryptic ENOENT/mkdir error from the local-fs driver.
  if (process.env.VERCEL) {
    // Diagnostic: which blob/token-related env keys does the runtime actually see?
    // Names only — never values — so it's safe to surface in the error.
    const blobKeys = Object.keys(process.env).filter((k) => /blob|token/i.test(k));
    throw new Error(
      "No storage configured: connect a Vercel Blob store (provides BLOB_READ_WRITE_TOKEN) " +
        "or set AZURE_STORAGE_CONNECTION_STRING. " +
        `[runtime env keys matching blob/token: ${blobKeys.length ? blobKeys.join(", ") : "none"}]`,
    );
  }
  return "local-fs";
}

const BLOB_NAME = process.env.AZURE_STORAGE_BLOB || "data.xlsx";
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER || "vmbs-risk";

// ── Azure Blob Storage (production) ──────────────────────────────────────────
const azureDriver: StorageDriver = {
  name: "azure-blob",
  async read() {
    const { BlobServiceClient } = await import("@azure/storage-blob");
    const svc = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING as string);
    const container = svc.getContainerClient(CONTAINER);
    const blob = container.getBlockBlobClient(BLOB_NAME);
    if (!(await blob.exists())) return null;
    return await blob.downloadToBuffer();
  },
  async write(buf) {
    const { BlobServiceClient } = await import("@azure/storage-blob");
    const svc = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING as string);
    const container = svc.getContainerClient(CONTAINER);
    await container.createIfNotExists();
    const blob = container.getBlockBlobClient(BLOB_NAME);
    await blob.uploadData(buf, {
      blobHTTPHeaders: { blobContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  },
};

// ── Vercel Blob (staging) ────────────────────────────────────────────────────
const vercelDriver: StorageDriver = {
  name: "vercel-blob",
  async read() {
    const { list } = await import("@vercel/blob");
    const token = vercelBlobToken();
    const { blobs } = await list({ prefix: BLOB_NAME, limit: 1, token });
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  },
  async write(buf) {
    const { put } = await import("@vercel/blob");
    await put(BLOB_NAME, buf, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      token: vercelBlobToken(),
    });
  },
};

// ── Local filesystem (dev / Azure App Service writable /home) ─────────────────
const localDriver: StorageDriver = {
  name: "local-fs",
  async read() {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(localDir(), BLOB_NAME);
    try {
      return await fs.readFile(file);
    } catch {
      return null;
    }
  },
  async write(buf) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = localDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, BLOB_NAME), buf);
  },
};

/**
 * Where the local-fs driver stores data.xlsx.
 *  - Explicit DATA_DIR always wins.
 *  - On Azure App Service (WEBSITE_SITE_NAME is set), default to the persistent /home volume,
 *    which survives restarts/redeploys and is shared across instances — so "store it on the
 *    same host as the server" works with zero extra infrastructure.
 *  - Otherwise ./.data (local dev).
 */
function localDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.env.WEBSITE_SITE_NAME) return "/home/data"; // Azure App Service persistent storage
  return ".data";
}

export function getStorage(): StorageDriver {
  switch (activeDriverName()) {
    case "azure-blob":
      return azureDriver;
    case "vercel-blob":
      return vercelDriver;
    default:
      return localDriver;
  }
}
