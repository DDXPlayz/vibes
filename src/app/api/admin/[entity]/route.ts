import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth";
import { mutate, read } from "@/server/db";
import { ENTITIES, isEntity } from "@/server/entities";

export async function GET(_req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const s = await requireRole("staff");
  if (s instanceof NextResponse) return s;
  if (!isEntity(entity)) return NextResponse.json({ error: "Unknown entity" }, { status: 404 });
  return NextResponse.json(await read((db) => db[entity]));
}

export async function POST(req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const s = await requireRole("staff");
  if (s instanceof NextResponse) return s;
  if (!isEntity(entity)) return NextResponse.json({ error: "Unknown entity" }, { status: 404 });
  const body = await req.json();
  const created = await mutate((db) => ENTITIES[entity].create(db, body));
  return NextResponse.json(created);
}
