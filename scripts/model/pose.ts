import * as THREE from "three";
import { jointPos, type Skeleton } from "./mh";

/**
 * Posing through the MakeHuman skeleton with linear-blend skinning.
 * A pose is a set of rotations, each about an axis given in the rest
 * (world) frame and pivoting on the bone's head joint; children inherit
 * their parent's motion.
 */

export type Rot = { axis: [number, number, number]; deg: number };
export type Pose = Record<string, Rot[]>;

/** Gentle finger curl, computed from the hand's own geometry. */
export function curlHand(v: Float64Array, sk: Skeleton, side: "L" | "R", amount: number, thumb = 0.5): Pose {
  const j = (b: string) => new THREE.Vector3(...jointPos(v, sk, sk.bones[b].head));
  const across = j(`metacarpal4.${side}`).sub(j(`metacarpal1.${side}`)).normalize();
  const out: Pose = {};
  for (let f = 2; f <= 5; f++)
    for (let s = 1; s <= 3; s++) {
      const b = `finger${f}-${s}.${side}`;
      const dir = new THREE.Vector3(...jointPos(v, sk, sk.bones[b].tail)).sub(j(b)).normalize();
      // curl axis: across the knuckles, perpendicular to the finger
      const axis = across.clone().sub(dir.clone().multiplyScalar(across.dot(dir))).normalize();
      const k = (side === "L" ? -1 : 1) * amount * (s === 1 ? 0.7 : s === 2 ? 1 : 0.8) * (1 + (f - 2) * 0.12);
      out[b] = [{ axis: axis.toArray() as [number, number, number], deg: k }];
    }
  for (let s = 2; s <= 3; s++) out[`finger1-${s}.${side}`] = [{ axis: [0, 1, 0], deg: (side === "L" ? 1 : -1) * amount * thumb }];
  return out;
}

export function skin(v: Float64Array, sk: Skeleton, weights: Record<string, [number, number][]>, pose: Pose): { pos: Float64Array; world: Record<string, THREE.Matrix4> } {
  const world: Record<string, THREE.Matrix4> = {};
  for (const b of sk.order) {
    const head = new THREE.Vector3(...jointPos(v, sk, sk.bones[b].head));
    const local = new THREE.Matrix4();
    for (const r of pose[b] ?? []) {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...r.axis).normalize(), THREE.MathUtils.degToRad(r.deg));
      const m = new THREE.Matrix4().makeTranslation(head.x, head.y, head.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-head.x, -head.y, -head.z));
      local.premultiply(m);
    }
    const parent = sk.bones[b].parent;
    world[b] = parent ? world[parent].clone().multiply(local) : local;
  }
  const n = v.length / 3;
  const acc = new Float64Array(v.length);
  const wsum = new Float64Array(n);
  const p = new THREE.Vector3();
  for (const [bone, list] of Object.entries(weights)) {
    const m = world[bone];
    if (!m) continue;
    for (const [i, w] of list) {
      p.set(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]).applyMatrix4(m);
      acc[i * 3] += p.x * w;
      acc[i * 3 + 1] += p.y * w;
      acc[i * 3 + 2] += p.z * w;
      wsum[i] += w;
    }
  }
  const out = new Float64Array(v);
  for (let i = 0; i < n; i++)
    if (wsum[i] > 0) for (let a = 0; a < 3; a++) out[i * 3 + a] = acc[i * 3 + a] / wsum[i];
  return { pos: out, world };
}

export function mergePoses(...ps: Pose[]): Pose {
  const out: Pose = {};
  for (const p of ps) for (const [b, r] of Object.entries(p)) out[b] = [...(out[b] ?? []), ...r];
  return out;
}
