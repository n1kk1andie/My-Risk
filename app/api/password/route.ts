// POST /api/password — admin-only. Changes the admin sign-in password.
// Verifies the current password, then persists a hashed new password via the
// storage adapter so it survives restarts and applies to every browser.
import { NextRequest, NextResponse } from "next/server";
import { checkPassword, isAdmin, setPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_LENGTH = 4;

export async function POST(req: NextRequest) {
  if (!isAdmin(Date.now())) {
    return NextResponse.json({ ok: false, error: "Not signed in as admin." }, { status: 401 });
  }

  const { currentPassword, newPassword } = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!newPassword || newPassword.length < MIN_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `New password must be at least ${MIN_LENGTH} characters.` },
      { status: 400 },
    );
  }

  if (!(await checkPassword(currentPassword || ""))) {
    return NextResponse.json({ ok: false, error: "Current password is incorrect." }, { status: 401 });
  }

  try {
    await setPassword(newPassword);
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Could not save password: " + (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
