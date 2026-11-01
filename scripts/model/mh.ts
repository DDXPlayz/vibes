/**
 * Reading MakeHuman (CC0) assets: base mesh, morph targets, skeleton, weights.
 * Used only by the offline model build (scripts/build-model.ts).
 */
import { readFileSync } from "fs";
import path from "path";

export interface Obj {
  v: Float64Array; // xyz (MakeHuman units: decimetres)
  vt: Float64Array; // uv
  faces: { v: number[]; t: number[]; group: string }[];
}

export function readObj(file: string): Obj {
  const v: number[] = [];
  const vt: number[] = [];
  const faces: Obj["faces"] = [];
  let group = "";
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const p = line.trim().split(/\s+/);
    if (p[0] === "v") v.push(+p[1], +p[2], +p[3]);
    else if (p[0] === "vt") vt.push(+p[1], +p[2]);
    else if (p[0] === "g") group = p[1];
    else if (p[0] === "f") {
      const f = { v: [] as number[], t: [] as number[], group };
      for (const c of p.slice(1)) {
        const [a, b] = c.split("/");
        f.v.push(+a - 1);
        f.t.push(b ? +b - 1 : -1);
      }
      faces.push(f);
    }
  }
  return { v: Float64Array.from(v), vt: Float64Array.from(vt), faces };
}

/** Apply a .target file (vertex offsets) with a weight. */
export function applyTarget(v: Float64Array, file: string, w: number) {
  if (!w) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line || line[0] === "#") continue;
    const p = line.trim().split(/\s+/);
    if (p.length < 4) continue;
    const i = +p[0] * 3;
    v[i] += +p[1] * w;
    v[i + 1] += +p[2] * w;
    v[i + 2] += +p[3] * w;
  }
}

export interface Skeleton {
  bones: Record<string, { head: string; tail: string; parent: string | null }>;
  joints: Record<string, number[]>;
  order: string[]; // parents before children
}

export function readSkeleton(file: string): Skeleton {
  const d = JSON.parse(readFileSync(file, "utf8"));
  const bones = d.bones as Skeleton["bones"];
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (b: string) => {
    if (seen.has(b)) return;
    const p = bones[b].parent;
    if (p) visit(p);
    seen.add(b);
    order.push(b);
  };
  Object.keys(bones).forEach(visit);
  return { bones, joints: d.joints, order };
}

export function jointPos(v: Float64Array, sk: Skeleton, name: string): [number, number, number] {
  const ids = sk.joints[name];
  const out: [number, number, number] = [0, 0, 0];
  for (const i of ids) for (let a = 0; a < 3; a++) out[a] += v[i * 3 + a];
  return out.map((x) => x / ids.length) as [number, number, number];
}

export function readWeights(file: string): Record<string, [number, number][]> {
  return JSON.parse(readFileSync(file, "utf8")).weights;
}

export const mhPath = (root: string, ...p: string[]) => path.join(root, "makehuman", "data", ...p);
