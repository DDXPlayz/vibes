import { getObject } from "@/server/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", json: "application/json" };

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const k = key.join("/");
  try {
    const bytes = await getObject(k);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": TYPES[k.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream",
        // keys are content-addressed (new upload → new key), so cache forever
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
