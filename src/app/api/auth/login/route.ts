import { NextResponse } from "next/server";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import { read } from "@/server/db";
import { verifyPassword } from "@/server/password";

export async function POST(req: Request) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  const user = await read((db) => db.users.find((u) => u.email.toLowerCase() === (email ?? "").toLowerCase()));
  if (!user || !verifyPassword(password ?? "", user.passwordHash)) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "That email and password don't match." }, { status: 401 });
  }
  const token = await signSession({ uid: user.id, name: user.name, role: user.role });
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
  return res;
}
