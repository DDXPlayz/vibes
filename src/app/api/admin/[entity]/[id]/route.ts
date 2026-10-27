import { NextResponse } from "next/server";
import { can } from "@/lib/session";
import type { Order } from "@/lib/types";
import { requireRole } from "@/server/auth";
import { mutate } from "@/server/db";
import { PROTECTED, isEntity, slugify } from "@/server/entities";
import { transitionOrder } from "@/server/inventory";

type Ctx = { params: Promise<{ entity: string; id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { entity, id } = await params;
  const s = await requireRole("staff");
  if (s instanceof NextResponse) return s;
  const body = (await req.json()) as Record<string, unknown>;

  if (entity === "orders") {
    const next = body.status as Order["status"];
    const o = await mutate((db) => {
      const order = db.orders.find((x) => x.id === id);
      if (!order) return null;
      transitionOrder(db, order, next);
      return order;
    });
    return o ? NextResponse.json(o) : NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isEntity(entity)) return NextResponse.json({ error: "Unknown entity" }, { status: 404 });

  const updated = await mutate((db) => {
    const list = db[entity] as unknown as Record<string, unknown>[];
    const item = list.find((x) => x.id === id);
    if (!item) return null;
    for (const [k, v] of Object.entries(body)) if (!PROTECTED.has(k)) item[k] = v;
    if (typeof body.slug === "string") {
      const slug = slugify(body.slug);
      item.slug = list.some((x) => x !== item && x.slug === slug) ? `${slug}-${String(id).slice(-4)}` : slug;
    }
    if ("updatedAt" in item) item.updatedAt = new Date().toISOString();
    return item;
  });
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { entity, id } = await params;
  const s = await requireRole("staff");
  if (s instanceof NextResponse) return s;
  if (!isEntity(entity)) return NextResponse.json({ error: "Unknown entity" }, { status: 404 });
  const { ENTITIES } = await import("@/server/entities");
  if (!can(s.role, ENTITIES[entity].deleteRole)) return NextResponse.json({ error: `Only a ${ENTITIES[entity].deleteRole} can delete this` }, { status: 403 });
  const ok = await mutate((db) => {
    const list = db[entity] as unknown as { id: string }[];
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return false;
    if (entity === "products" && db.orders.some((o) => o.lines.some((l) => l.productId === id))) throw new Error("This saree has orders — archive it instead of deleting.");
    list.splice(i, 1);
    if (entity === "collections") db.products.forEach((p) => (p.collectionIds = p.collectionIds.filter((c) => c !== id)));
    if (entity === "artisans") db.products.forEach((p) => p.artisanId === id && (p.artisanId = null));
    return true;
  }).catch((e: Error) => e);
  if (ok instanceof Error) return NextResponse.json({ error: ok.message }, { status: 409 });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
