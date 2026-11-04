import { NextResponse } from "next/server";
import { suggest, type AssistInput } from "@/lib/assist";
import { requireRole } from "@/server/auth";
import { read } from "@/server/db";

export async function POST(req: Request) {
  const s = await requireRole("staff");
  if (s instanceof NextResponse) return s;
  const input = (await req.json()) as AssistInput;
  const collections = await read((db) => db.collections);
  return NextResponse.json(suggest(input, collections));
}
