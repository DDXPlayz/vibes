import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, can, verifySession, type Session } from "@/lib/session";
import type { Role } from "@/lib/types";

export async function currentSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** For route handlers: returns the session or a 401/403 response. */
export async function requireRole(min: Role): Promise<Session | NextResponse> {
  const s = await currentSession();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!can(s.role, min)) return NextResponse.json({ error: `Requires ${min} access` }, { status: 403 });
  return s;
}
