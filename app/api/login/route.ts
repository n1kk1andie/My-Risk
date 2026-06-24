// POST /api/login {password} -> sets a signed admin session cookie.
// GET  /api/login            -> reports current session + whether auth is configured.
import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  adminConfigured,
  checkPassword,
  createSessionToken,
  isAdmin,
  sessionCookieOptions,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ admin: isAdmin(Date.now()), configured: adminConfigured() });
}

export async function POST(req: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json({ ok: false, error: "Admin password is not configured on the server." }, { status: 503 });
  }
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || !checkPassword(password)) {
    return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, admin: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(Date.now()), sessionCookieOptions);
  return res;
}
