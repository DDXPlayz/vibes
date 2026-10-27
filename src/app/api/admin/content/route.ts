import { NextResponse } from "next/server";
import type { SiteContent } from "@/lib/types";
import { requireRole } from "@/server/auth";
import { mutate } from "@/server/db";

export async function PUT(req: Request) {
  const s = await requireRole("manager");
  if (s instanceof NextResponse) return s;
  const content = (await req.json()) as SiteContent;
  await mutate((db) => {
    db.content = content;
  });
  return NextResponse.json({ ok: true });
}
