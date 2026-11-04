import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { resetDatabase } from "@/server/db";

export async function POST() {
  const s = await requireRole("owner");
  if (s instanceof NextResponse) return s;
  await resetDatabase();
  return NextResponse.json({ ok: true });
}
