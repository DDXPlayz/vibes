import { createHash } from "crypto";
import { NextResponse } from "next/server";
import type { Media } from "@/lib/types";
import { requireRole } from "@/server/auth";
import { mutate } from "@/server/db";
import { putObject } from "@/server/storage";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 40 * 1024 * 1024;

/** Upload to object storage. Keys are content hashes, so URLs are immutable. */
export async function POST(req: Request) {
  const s = await requireRole("staff");
  if (s instanceof NextResponse) return s;
  const form = await req.formData();
  const file = form.get("file");
  const kind = (form.get("kind") as Media["kind"]) ?? "other";
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: "Please upload a JPEG, PNG or WebP image." }, { status: 415 });
  if (file.size > MAX) return NextResponse.json({ error: "That file is larger than 40 MB." }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 24);
  const folder = { scan: "scans", original: "originals", render: "renders", portrait: "portraits", other: "misc" }[kind] ?? "misc";
  const key = `${folder}/${hash}.${ext}`;
  await putObject(key, bytes);
  await mutate((db) => {
    if (!db.media.some((m) => m.key === key)) db.media.push({ key, contentType: file.type, bytes: bytes.length, kind, createdAt: new Date().toISOString() });
  });
  return NextResponse.json({ key, url: `/api/media/${key}` });
}
