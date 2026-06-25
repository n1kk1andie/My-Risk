// Server-side admin auth: a password (ADMIN_PASSWORD) is verified on the server and
// exchanged for a signed, httpOnly session cookie. Replaces the original app's
// client-side password check and the hardcoded x-admin-key shipped to every browser.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getStorage } from "@/lib/storage";

export const SESSION_COOKIE = "vmbs_session";
const MAX_AGE = 60 * 60 * 12; // 12h

// Where the admin-changeable password hash is persisted (same backend as data.xlsx).
const CRED_BLOB = "admin-credentials.json";

interface StoredCredential {
  alg: "scrypt";
  salt: string; // hex
  hash: string; // hex
  updatedAt: string;
}

function secret(): string {
  return process.env.SESSION_SECRET || "vmbs-dev-secret-change-me";
}

function b64url(s: string): string {
  return Buffer.from(s).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Create a signed session token valid for MAX_AGE seconds. */
export function createSessionToken(now: number): string {
  const body = b64url(JSON.stringify({ role: "admin", exp: now + MAX_AGE * 1000 }));
  return `${body}.${sign(body)}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Verify a token's signature and expiry. `now` is the current epoch ms. */
export function verifySessionToken(token: string | undefined, now: number): boolean {
  if (!token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  if (!safeEqual(sig, sign(body))) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return payload.role === "admin" && typeof payload.exp === "number" && payload.exp > now;
  } catch {
    return false;
  }
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

/** Read the persisted, admin-changed credential (null if none has been set). */
async function readStoredCredential(): Promise<StoredCredential | null> {
  try {
    const buf = await getStorage().read(CRED_BLOB);
    if (!buf) return null;
    const parsed = JSON.parse(buf.toString("utf8")) as StoredCredential;
    if (parsed?.alg === "scrypt" && parsed.salt && parsed.hash) return parsed;
    return null;
  } catch {
    // No storage configured, or unreadable credential -> fall back to the env var.
    return null;
  }
}

/**
 * Persist a new admin password. Hashed with scrypt + a random salt; the plaintext
 * is never stored. Takes precedence over ADMIN_PASSWORD on subsequent sign-ins.
 */
export async function setPassword(newPassword: string): Promise<void> {
  const salt = randomBytes(16).toString("hex");
  const cred: StoredCredential = {
    alg: "scrypt",
    salt,
    hash: hashPassword(newPassword, salt),
    updatedAt: new Date().toISOString(),
  };
  await getStorage().write(Buffer.from(JSON.stringify(cred), "utf8"), CRED_BLOB);
}

/**
 * Constant-time check of a submitted password. A password set in-app (persisted via
 * setPassword) takes precedence; otherwise it falls back to the ADMIN_PASSWORD env var.
 */
export async function checkPassword(submitted: string): Promise<boolean> {
  const stored = await readStoredCredential();
  if (stored) {
    return safeEqual(hashPassword(submitted, stored.salt), stored.hash);
  }
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // auth disabled until configured
  return safeEqual(submitted, expected);
}

/** Auth is usable once either an env-var password or an in-app password exists. */
export async function adminConfigured(): Promise<boolean> {
  if (process.env.ADMIN_PASSWORD) return true;
  return (await readStoredCredential()) !== null;
}

/** Read the request's session cookie and report whether it's a valid admin session. */
export function isAdmin(now: number): boolean {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, now);
}

export const sessionCookieOptions = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
};
