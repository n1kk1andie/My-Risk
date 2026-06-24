// Server-side admin auth: a password (ADMIN_PASSWORD) is verified on the server and
// exchanged for a signed, httpOnly session cookie. Replaces the original app's
// client-side password check and the hardcoded x-admin-key shipped to every browser.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "vmbs_session";
const MAX_AGE = 60 * 60 * 12; // 12h

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

/** Constant-time check of a submitted password against ADMIN_PASSWORD. */
export function checkPassword(submitted: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // auth disabled until configured
  return safeEqual(submitted, expected);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
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
