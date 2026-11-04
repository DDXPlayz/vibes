import type { DrapeStyleId, PoseId } from "@/lib/types";
import { decodeBake, type DrapeBake } from "./drapeBake";

/** Loads baked drapes from /drapes/{style}-{pose}.bin and caches them. */

const ready = new Map<string, DrapeBake>();
const pending = new Map<string, Promise<DrapeBake>>();

const key = (s: DrapeStyleId, p: PoseId) => `${s}-${p}`;

export function getBakeSync(style: DrapeStyleId, pose: PoseId) {
  return ready.get(key(style, pose));
}

export function loadBake(style: DrapeStyleId, pose: PoseId): Promise<DrapeBake> {
  const k = key(style, pose);
  const done = ready.get(k);
  if (done) return Promise.resolve(done);
  let p = pending.get(k);
  if (!p) {
    p = fetch(`/drapes/${k}.bin`)
      .then((r) => {
        if (!r.ok) throw new Error(`drape ${k} not baked`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        const b = decodeBake(buf, style, pose);
        ready.set(k, b);
        return b;
      });
    p.catch(() => pending.delete(k));
    pending.set(k, p);
  }
  return p;
}
