import { NextResponse } from "next/server";
import type { StudioSettings } from "@/lib/types";
import { requireRole } from "@/server/auth";
import { mutate } from "@/server/db";

export async function PUT(req: Request) {
  const s = await requireRole("manager");
  if (s instanceof NextResponse) return s;
  const body = (await req.json()) as Partial<StudioSettings> & { applyTo?: "all" | string[]; keepDefaults?: boolean };
  await mutate((db) => {
    if (body.defaults && !body.keepDefaults) db.studio.defaults = body.defaults;
    if (body.quality) db.studio.quality = body.quality;
    if (body.applyTo && body.defaults) {
      const ids = body.applyTo === "all" ? db.products.map((p) => p.id) : body.applyTo;
      db.products.forEach((p) => {
        if (ids.includes(p.id)) {
          p.drape = { ...body.defaults! };
          p.renders = []; // stale — regenerated from the new drape
          p.updatedAt = new Date().toISOString();
        }
      });
    }
  });
  return NextResponse.json({ ok: true });
}
