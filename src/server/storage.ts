import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR } from "./db";

/**
 * Object storage. Locally, files live in .data/media. In production this
 * module is replaced by an S3/R2/GCS driver with the same three methods;
 * keys are already namespaced (scans/, originals/, renders/, portraits/).
 */

const ROOT = path.join(DATA_DIR, "media");

function safe(key: string) {
  const p = path.normalize(path.join(ROOT, key));
  if (!p.startsWith(ROOT + path.sep)) throw new Error("Invalid key");
  return p;
}

export async function putObject(key: string, bytes: Buffer) {
  const p = safe(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, bytes);
}

export async function getObject(key: string) {
  return fs.readFile(safe(key));
}

export async function deleteObject(key: string) {
  await fs.rm(safe(key), { force: true });
}

export function mediaUrl(key: string | undefined) {
  return key ? `/api/media/${key}` : undefined;
}
