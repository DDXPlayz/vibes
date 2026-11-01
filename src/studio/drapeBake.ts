import type { DrapeStyleId, PoseId } from "@/lib/types";
import { Cloth } from "./cloth";
import { floor, hullCollider, sampleSDF, sdfCollider, type SDF } from "./collider";
import { profileR, type ModelData } from "./modelFormat";

/**
 * Building and baking a drape.
 *
 * The skirt is what a saree physically is: a straight rectangle, a little
 * longer than the hip girth, tucked into a waistline shorter than itself —
 * so it gathers at the tuck, skims the hips and seat, and falls under its
 * own weight over the legs. The pleats are seven hand-made folds of slightly
 * different depths, pressed tight at the tuck and free to fan open below.
 * The pallu is pinned only at the hip and at the shoulder, and settles onto
 * the bust, the shoulder, the arm and the skirt.
 *
 * A bake depends only on drape style × pose, never on the textile, so nine
 * bakes serve every saree in the archive.
 */

export const SAREE_LEN = 5.5;
export const SAREE_W = 1.15;

/* ───────── skirt layout ───────── */
export const SK_NV = 60; // rows: 0 = hem … SK_NV = waist
export const WRAP_COLS = 150;
export const PLEATS = 7;
const FACE_COLS = 5;
const RET_COLS = 3;
export const PLEAT_COLS = PLEATS * (FACE_COLS + RET_COLS);
export const SK_NU = WRAP_COLS + PLEAT_COLS; // columns 0 … SK_NU
export const WAIST_Y = 1.045;
const DROP = 1.085; // waist to hem: the hem just kisses the floor and rests on the feet
const L_WRAP = 1.02; // fabric around the body (hip girth ≈ 1.0 m) — a little ease
const THETA_S = 0.26; // wrap begins just left of centre, under the pleats

/* ───────── pallu layout ───────── */
export const PA_NS = 140;
export const PA_NT = 28;

interface PathKey {
  p: [number, number, number];
  b: [number, number, number];
  w: number;
}

interface PalluDef {
  keys: PathKey[];
  /** fraction of the path where the pallu is pinned at the shoulder */
  shoulderS: number;
  /** fraction of the path where front pleating gives way to open flutes */
  openS: number;
  frontPleats: number;
  flutes: number;
  /** a second tuck further along the pallu (Seedha: across the front into the left waist) */
  tuckS?: number;
}

export const PALLU: Record<DrapeStyleId, PalluDef> = {
  nivi: {
    shoulderS: 0.4,
    openS: 0.44,
    frontPleats: 7,
    flutes: 3,
    keys: [
      // emerges from the second wrap at the right side of the waist, flat against the body
      { p: [-0.138, 1.04, -0.012], b: [0.12, -0.99, 0.05], w: 0.17 },
      { p: [-0.122, 1.1, 0.088], b: [0.45, -0.89, 0], w: 0.17 },
      { p: [-0.04, 1.21, 0.15], b: [0.72, -0.69, 0], w: 0.15 },
      { p: [0.045, 1.32, 0.148], b: [0.84, -0.54, 0], w: 0.14 },
      { p: [0.105, 1.44, 0.08], b: [0.95, -0.3, 0], w: 0.125 },
      { p: [0.12, 1.505, -0.01], b: [0.97, -0.24, 0], w: 0.12 },
      { p: [0.12, 1.45, -0.095], b: [1, -0.05, -0.06], w: 0.19 },
      { p: [0.105, 1.25, -0.138], b: [1, 0, -0.08], w: 0.32 },
      { p: [0.092, 0.96, -0.172], b: [1, 0, -0.06], w: 0.42 },
      { p: [0.085, 0.62, -0.2], b: [1, 0, -0.05], w: 0.48 },
    ],
  },
  open: {
    shoulderS: 0.42,
    openS: 0.12,
    frontPleats: 0,
    flutes: 4,
    keys: [
      { p: [-0.136, 1.04, -0.005], b: [0.15, -0.99, 0.05], w: 0.24 },
      { p: [-0.1, 1.12, 0.12], b: [0.55, -0.83, 0], w: 0.33 },
      { p: [0.0, 1.25, 0.16], b: [0.72, -0.69, 0], w: 0.34 },
      { p: [0.09, 1.38, 0.13], b: [0.88, -0.48, 0], w: 0.28 },
      { p: [0.125, 1.505, 0.0], b: [0.97, -0.24, 0], w: 0.2 },
      { p: [0.135, 1.44, -0.1], b: [1, -0.08, -0.08], w: 0.28 },
      { p: [0.145, 1.15, -0.145], b: [1, 0, -0.12], w: 0.46 },
      { p: [0.15, 0.75, -0.19], b: [1, 0, -0.14], w: 0.54 },
      { p: [0.15, 0.38, -0.22], b: [1, 0, -0.15], w: 0.58 },
    ],
  },
  seedha: {
    shoulderS: 0.36,
    openS: 0.42,
    frontPleats: 6,
    flutes: 3,
    tuckS: 0.66,
    keys: [
      { p: [0.132, 1.04, -0.03], b: [-0.15, -0.99, -0.05], w: 0.17 },
      { p: [0.085, 1.15, -0.115], b: [-0.6, -0.8, 0], w: 0.17 },
      { p: [-0.04, 1.3, -0.12], b: [-0.8, -0.6, 0], w: 0.15 },
      { p: [-0.11, 1.44, -0.07], b: [-0.95, -0.3, 0], w: 0.13 },
      { p: [-0.12, 1.505, 0.01], b: [-0.97, -0.24, 0], w: 0.13 },
      // over the right shoulder, spread diagonally across the front…
      { p: [-0.095, 1.41, 0.13], b: [-0.7, -0.3, 0.2], w: 0.24 },
      { p: [-0.01, 1.28, 0.17], b: [-0.6, -0.75, 0.1], w: 0.34 },
      // …tucked at the left waist, the decorated end falling in front
      { p: [0.085, 1.05, 0.135], b: [-0.75, -0.6, 0.15], w: 0.36 },
      { p: [0.1, 0.82, 0.19], b: [-1, 0, 0.12], w: 0.42 },
      { p: [0.1, 0.56, 0.22], b: [-1, 0, 0.1], w: 0.46 },
    ],
  },
};

/* ───────── small maths ───────── */

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
type V = [number, number, number];
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.sqrt(dot(a, a));
const norm = (a: V): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Everything the drape needs to know about her, in one place: her measured
 * profile (radius by height and angle), which way her hips and shoulders face,
 * and — for the bake — the distance field of her body.
 */
export interface Fit {
  /** radius of her body at height y, angle θ measured from *her* front */
  R(y: number, th: number): number;
  yawHip: number;
  yawShoulder: number;
  shoulderTop: number;
  sdf?: SDF;
}

export function fitFor(model: ModelData, sdf?: SDF): Fit {
  const L = model.landmarks;
  const yawOf = (a: number[], b: number[]) => Math.atan2(-(a[2] - b[2]), a[0] - b[0]);
  const yawHip = yawOf(L.hipL, L.hipR);
  const yawShoulder = yawOf(L.shoulderL, L.shoulderR);
  // the top of her left shoulder, where the pallu is pinned
  let shoulderTop = 1.44;
  if (sdf) {
    const c = Math.cos(yawShoulder), sn = Math.sin(yawShoulder);
    const x = 0.11 * c, z = -0.11 * sn;
    for (let y = 1.7; y > 1.2; y -= 0.002)
      if (sampleSDF(sdf, x, y, z) < 0.002) {
        shoulderTop = y;
        break;
      }
  }
  return { R: (y, th) => profileR(model.profile, y, th + yawHip), yawHip, yawShoulder, shoulderTop, sdf };
}

/** Rotate a point (x, z) about the vertical axis by yaw. */
const turn = (p: V, yaw: number): V => [p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw), p[1], p[2] * Math.cos(yaw) - p[0] * Math.sin(yaw)];

/* ───────── layouts shared with the runtime ───────── */

export interface SkirtLayout {
  /** fabric distance (m) from the start of the wrap, per column */
  arc: number[];
  pleatOf: number[]; // -1 for wrap columns
}

export function skirtLayout(seed = "vibes"): SkirtLayout & { face: number[]; ret: number[] } {
  const r = rng(`pleats:${seed}`);
  const face: number[] = [];
  const ret: number[] = [];
  for (let k = 0; k < PLEATS; k++) {
    face.push(0.05 * (0.86 + r() * 0.3));
    ret.push(0.033 * (0.82 + r() * 0.36));
  }
  const arc: number[] = [];
  const pleatOf: number[] = [];
  for (let j = 0; j <= WRAP_COLS; j++) {
    arc.push((L_WRAP * j) / WRAP_COLS);
    pleatOf.push(-1);
  }
  let a = L_WRAP;
  for (let k = 0; k < PLEATS; k++) {
    for (let c = 1; c <= FACE_COLS; c++) {
      a += face[k] / FACE_COLS;
      arc.push(a);
      pleatOf.push(k);
    }
    for (let c = 1; c <= RET_COLS; c++) {
      a += ret[k] / RET_COLS;
      arc.push(a);
      pleatOf.push(k);
    }
  }
  return { arc, pleatOf, face, ret };
}

/** Texture coordinates — physically scaled: 1 m of cloth is 1/5.5 of the saree. */
export function skirtUV(layout: SkirtLayout) {
  const uv = new Float32Array((SK_NU + 1) * (SK_NV + 1) * 2);
  for (let i = 0; i <= SK_NV; i++)
    for (let j = 0; j <= SK_NU; j++) {
      const o = (i * (SK_NU + 1) + j) * 2;
      uv[o] = layout.arc[j] / SAREE_LEN;
      // hem border at v = 0; the top of the width (and its border) is tucked into the waist
      uv[o + 1] = (i / SK_NV) * 0.8;
    }
  return uv;
}

export function palluUV(lengthM: number) {
  const uv = new Float32Array((PA_NS + 1) * (PA_NT + 1) * 2);
  const u0 = 1 - lengthM / SAREE_LEN;
  for (let k = 0; k <= PA_NT; k++)
    for (let i = 0; i <= PA_NS; i++) {
      const o = (k * (PA_NS + 1) + i) * 2;
      uv[o] = u0 + (i / PA_NS) * (1 - u0);
      uv[o + 1] = k / PA_NT;
    }
  return uv;
}

/* ───────── skirt ───────── */

const skIdx = (i: number, j: number) => i * (SK_NU + 1) + j;

export function buildSkirt(seed: string, fit: Fit) {
  const torsoR = fit.R;
  const HIP_Y = 0.94;
  const L = skirtLayout(seed);
  const r = rng(`skirt:${seed}`);
  const dv = DROP / SK_NV;
  const pos = new Float32Array((SK_NU + 1) * (SK_NV + 1) * 3);
  const thetaE = Math.PI * 2 + Math.asin(-0.056 / torsoR(WAIST_Y, Math.PI / 2));
  const phases = Array.from({ length: 5 }, () => r() * Math.PI * 2);
  const set = (i: number, j: number, p: V) => pos.set(p, skIdx(i, j) * 3);

  // per-pleat hem layout: sawtooth in a plane in front of the legs, fanned open
  const tuckX0 = -0.056;
  const tuckStep = 0.0175;
  const hemStep = 0.031;
  const pleatPts = (k: number, tuck: boolean) => {
    const s = tuck ? tuckStep * (0.9 + 0.2 * ((k * 7) % 3) / 2) : hemStep * (0.9 + 0.2 * r());
    const a = L.face[k];
    const b = L.ret[k];
    if (tuck) return { fx: s * 0.82, fz: 0.008, rx: s * 0.18, rz: -0.008 };
    const fx = (s + (a * a - b * b) / s) / 2;
    const rx = s - fx;
    const dz = Math.sqrt(Math.max(1e-6, a * a - fx * fx));
    return { fx, fz: dz, rx, rz: -dz };
  };
  const tuckSteps = Array.from({ length: PLEATS }, (_, k) => pleatPts(k, true));
  const hemSteps = Array.from({ length: PLEATS }, (_, k) => pleatPts(k, false));

  for (let i = 0; i <= SK_NV; i++) {
    const y = WAIST_Y - (SK_NV - i) * dv;
    const down = (SK_NV - i) / SK_NV;
    // below the fullest part of the hips the wrap falls straight
    const yc = Math.max(y, HIP_Y);
    // wrap
    for (let j = 0; j <= WRAP_COLS; j++) {
      const f = j / WRAP_COLS;
      const th = THETA_S + f * (thetaE - THETA_S);
      let rr = torsoR(yc, th) + 0.006;
      if (y < 0.9) rr += 0.004 * (0.9 - y);
      if (i === SK_NV) rr += 0.0035 * Math.sin(th * 31); // gathers at the tuck
      else rr += down * 0.005 * Math.sin(th * 6 + phases[0]) + down * 0.003 * Math.sin(th * 11 + phases[1]);
      if (f < 0.06) rr -= 0.004; // inner layer under the pleats
      set(i, j, [Math.sin(th) * rr, y, Math.cos(th) * rr]);
    }
    // pleats: from the tuck (tight) to the fanned hem layout
    const w = Math.pow(down, 0.55);
    const zFront = (yy: number) => torsoR(Math.max(yy, HIP_Y), 0) + 0.02;
    const start: V = [pos[skIdx(i, WRAP_COLS) * 3], y, pos[skIdx(i, WRAP_COLS) * 3 + 2]];
    let x = start[0];
    let col = WRAP_COLS;
    for (let k = 0; k < PLEATS; k++) {
      const t = tuckSteps[k];
      const h = hemSteps[k];
      const fx = t.fx * (1 - w) + h.fx * w;
      const fz = t.fz * (1 - w) + h.fz * w;
      const rx = t.rx * (1 - w) + h.rx * w;
      const base = zFront(y) + 0.004 * k * (1 - w);
      const z0 = base;
      for (let c = 1; c <= FACE_COLS; c++) {
        const q = c / FACE_COLS;
        set(i, ++col, [x + fx * q, y, z0 + fz * q]);
      }
      for (let c = 1; c <= RET_COLS; c++) {
        const q = c / RET_COLS;
        set(i, ++col, [x + fx + rx * q, y, z0 + fz * (1 - q)]);
      }
      x += fx + rx;
    }
  }
  // the pleat block's tucked top follows the curve of the waist
  for (let j = WRAP_COLS + 1; j <= SK_NU; j++) {
    const o = skIdx(SK_NV, j) * 3;
    const xx = pos[o];
    const th = Math.asin(Math.max(-0.95, Math.min(0.95, xx / torsoR(WAIST_Y, Math.PI / 2))));
    const extra = pos[o + 2] - (torsoR(HIP_Y, 0) + 0.02);
    const rr = torsoR(WAIST_Y, th) + 0.009 + Math.max(0, extra);
    pos[o] = Math.sin(th) * rr;
    pos[o + 2] = Math.cos(th) * rr;
  }

  // the skirt is built facing her front; turn it with her hips
  for (let q = 0; q < pos.length; q += 3) pos.set(turn([pos[q], pos[q + 1], pos[q + 2]], fit.yawHip), q);
  const cloth = new Cloth(pos);
  // columns: horizontal rest from the fabric layout; vertical rest with a hand-draped wobble per pleat
  const colScale = L.pleatOf.map((k) => (k < 0 ? 1 : 1 + (rng(`len:${seed}:${k}`)() - 0.5) * 0.016));
  for (let i = 0; i <= SK_NV; i++)
    for (let j = 0; j <= SK_NU; j++) {
      const id = skIdx(i, j);
      const pleat = L.pleatOf[j] >= 0;
      cloth.margin[id] = pleat ? 0.012 + L.pleatOf[j] * 0.0007 : j < WRAP_COLS * 0.08 ? 0.0025 : 0.0042;
      if (i === SK_NV) cloth.pin(id);
      const vRest = dv * colScale[j];
      if (j < SK_NU) {
        const h = L.arc[j + 1] - L.arc[j];
        const isPleat = L.pleatOf[j + 1] >= 0;
        // woven cloth barely compresses in-plane — it can only gather by folding.
        // Near the tuck it is allowed to bunch; below the hips it keeps its width.
        const gather = smooth(0.9, 1.0, WAIST_Y - (SK_NV - i) * dv);
        cloth.link(id, skIdx(i, j + 1), h, 1, isPleat ? 0.95 - 0.5 * gather : 0.04 + 0.86 * gather);
        if (i < SK_NV) {
          const d = Math.hypot(h, vRest);
          cloth.link(id, skIdx(i + 1, j + 1), d, 0.55, 0.08);
          cloth.link(skIdx(i, j + 1), skIdx(i + 1, j), d, 0.55, 0.08);
        }
      }
      if (i < SK_NV) cloth.link(id, skIdx(i + 1, j), vRest, 1, 0.3);
      // bending: soft silk across, a little firmer along the warp; pleats keep their pressed creases
      if (j < SK_NU - 1) {
        const isPleat = L.pleatOf[j + 2] >= 0 && L.pleatOf[j] >= 0;
        const rest = isPleat ? pleatBendRest(L, j, hemSteps) : L.arc[j + 2] - L.arc[j];
        cloth.link(id, skIdx(i, j + 2), rest, isPleat ? 0.4 : 0.035, isPleat ? 0.4 : 0.02);
      }
      // pressed pleats: a longer crease memory so no fold can flip over its neighbour
      if (j >= WRAP_COLS && j + 4 <= SK_NU && i < SK_NV - 2) cloth.link(id, skIdx(i, j + 4), pleatBendRest(L, j, hemSteps, 4), 0.3, 0.3);
      if (i < SK_NV - 1) cloth.link(id, skIdx(i + 2, j), 2 * vRest, 0.1, 0.05);
      if (i < SK_NV) cloth.tie(id, skIdx(SK_NV, j), (SK_NV - i) * vRest * 1.004);
    }
  cloth.colliders.push(innerLayerBehindPleats(cloth));
  return { cloth, layout: L };
}

/**
 * The start of the wrap lies under the pleats. Cloth does not collide with
 * itself here, so this keeps that inner layer behind the pleat block — as it
 * is on the body — instead of poking through it.
 */
function innerLayerBehindPleats(cloth: Cloth) {
  const INNER = Math.round(WRAP_COLS * 0.16);
  return (p: Float32Array, id: number) => {
    const row = Math.floor(id / (SK_NU + 1));
    const col = id - row * (SK_NU + 1);
    if (col >= INNER) return false;
    const x = p[3 * id];
    const z = p[3 * id + 2];
    let zb = Infinity;
    for (let j = WRAP_COLS + 1; j <= SK_NU; j++) {
      const o = (row * (SK_NU + 1) + j) * 3;
      if (Math.abs(cloth.pos[o] - x) < 0.022) zb = Math.min(zb, cloth.pos[o + 2]);
    }
    if (zb === Infinity || z < zb - 0.006) return false;
    p[3 * id + 2] = zb - 0.006;
    return true;
  };
}

/** Rest distance of a pleat crease spanning columns j…j+2, from the pressed hem layout. */
function pleatBendRest(L: SkirtLayout, j: number, hem: { fx: number; fz: number; rx: number; rz: number }[], span = 2) {
  const pt = (c: number): [number, number] => {
    let x = 0;
    let z = 0;
    let col = WRAP_COLS;
    for (let k = 0; k < PLEATS; k++) {
      const h = hem[k];
      for (let q = 1; q <= FACE_COLS; q++) if (++col === c) return [x + (h.fx * q) / FACE_COLS, (h.fz * q) / FACE_COLS];
      for (let q = 1; q <= RET_COLS; q++) if (++col === c) return [x + h.fx + (h.rx * q) / RET_COLS, h.fz * (1 - q / RET_COLS)];
      x += h.fx + h.rx;
      z = 0;
    }
    return [x, z];
  };
  const a = j === WRAP_COLS ? ([0, 0] as [number, number]) : pt(j);
  const b = pt(j + span);
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/* ───────── pallu ───────── */

const paIdx = (k: number, i: number) => k * (PA_NS + 1) + i;

function catmull(pts: V[], t: number): V {
  const n = pts.length - 1;
  const x = Math.min(n - 1e-6, Math.max(0, t * n));
  const i = Math.floor(x);
  const u = x - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n, i + 2)];
  const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u * u + (-a + 3 * b - 3 * cc + d) * u * u * u);
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), c(p0[2], p1[2], p2[2], p3[2])];
}

/**
 * The pallu's path is authored for a reference figure. Fit it to her: scale
 * heights above the waist to her shoulder, turn with her hips/shoulders, and
 * lay the points that rest on her (front, over the shoulder) onto her surface.
 */
function fitKeys(def: PalluDef, fit: Fit): PathKey[] {
  const REF_WAIST = 1.045;
  const REF_SHOULDER = 1.508;
  const top = def.keys.reduce((m, k, i) => (k.p[1] > def.keys[m].p[1] ? i : m), 0);
  return def.keys.map((k, i) => {
    let y = k.p[1];
    if (y > REF_WAIST) y = REF_WAIST + ((y - REF_WAIST) * (fit.shoulderTop + 0.004 - REF_WAIST)) / (REF_SHOULDER - REF_WAIST);
    const yaw = y > 1.12 ? fit.yawShoulder : fit.yawHip;
    let p = turn([k.p[0], y, k.p[2]], yaw);
    const b = turn(k.b, yaw);
    const sdf = fit.sdf;
    if (sdf) {
      const rests = i <= top + 1;
      const m = 0.009;
      for (let it = 0; it < 12; it++) {
        const d = sampleSDF(sdf, p[0], p[1], p[2]);
        if (!rests && d >= m) break;
        if (rests && Math.abs(d - m) < 0.0008) break;
        const e = 0.003;
        let g: V = [
          sampleSDF(sdf, p[0] + e, p[1], p[2]) - sampleSDF(sdf, p[0] - e, p[1], p[2]),
          sampleSDF(sdf, p[0], p[1] + e, p[2]) - sampleSDF(sdf, p[0], p[1] - e, p[2]),
          sampleSDF(sdf, p[0], p[1], p[2] + e) - sampleSDF(sdf, p[0], p[1], p[2] - e),
        ];
        g = norm(g);
        // only move points the field can see (inside its narrow band)
        if (Math.abs(d) > 0.029) {
          if (d < 0) p = add(p, g, 0.02);
          else break;
          continue;
        }
        p = add(p, g, m - d);
      }
    }
    return { ...k, p, b };
  });
}

export function buildPallu(style: DrapeStyleId, seed: string, fit: Fit) {
  const def = { ...PALLU[style], keys: fitKeys(PALLU[style], fit) };
  const r = rng(`pallu:${style}:${seed}`);
  const pts = def.keys.map((k) => k.p as V);
  // arc-length resample of the centreline
  const fine: V[] = [];
  for (let q = 0; q <= 600; q++) fine.push(catmull(pts, q / 600));
  const cum = [0];
  for (let q = 1; q < fine.length; q++) cum.push(cum[q - 1] + len(sub(fine[q], fine[q - 1])));
  const total = cum[cum.length - 1];
  const at = (s: number) => {
    const target = s * total;
    let q = 1;
    while (q < cum.length - 1 && cum[q] < target) q++;
    const t = (target - cum[q - 1]) / (cum[q] - cum[q - 1] || 1);
    return add(fine[q - 1], sub(fine[q], fine[q - 1]), t);
  };
  const keyS = def.keys.map((_, i) => cum[Math.round((i / (def.keys.length - 1)) * 600)] / total);
  const lerpKey = (s: number, f: (k: PathKey) => number) => {
    for (let i = 1; i < keyS.length; i++)
      if (s <= keyS[i]) {
        const t = smooth(0, 1, (s - keyS[i - 1]) / (keyS[i] - keyS[i - 1] || 1));
        return f(def.keys[i - 1]) * (1 - t) + f(def.keys[i]) * t;
      }
    return f(def.keys[def.keys.length - 1]);
  };

  // irregular hand-made pleats on the front, a few soft flutes where it falls open
  const pleatEdges: number[] = [0];
  for (let q = 0; q < def.frontPleats; q++) pleatEdges.push(pleatEdges[q] + 0.7 + r() * 0.6);
  const pe = pleatEdges.map((e) => e / pleatEdges[pleatEdges.length - 1]);
  const flutes = Array.from({ length: def.flutes }, () => ({ f: 0.8 + r() * 0.5, ph: r() * Math.PI * 2, a: 0.6 + r() * 0.6 }));
  const sawtooth = (t: number) => {
    for (let q = 1; q < pe.length; q++)
      if (t <= pe[q]) {
        const u = (t - pe[q - 1]) / (pe[q] - pe[q - 1]);
        return u < 0.72 ? u / 0.72 : (1 - u) / 0.28;
      }
    return 0;
  };

  const pos = new Float32Array((PA_NS + 1) * (PA_NT + 1) * 3);
  for (let i = 0; i <= PA_NS; i++) {
    const s = i / PA_NS;
    const c = at(s);
    const T = norm(sub(at(Math.min(1, s + 0.004)), at(Math.max(0, s - 0.004))));
    const b0: V = [lerpKey(s, (k) => k.b[0]), lerpKey(s, (k) => k.b[1]), lerpKey(s, (k) => k.b[2])];
    const B = norm(sub(b0, [T[0] * dot(b0, T), T[1] * dot(b0, T), T[2] * dot(b0, T)]));
    let N = norm(cross(T, B));
    if (N[0] * c[0] + N[2] * c[2] < 0) N = [-N[0], -N[1], -N[2]];
    const w = lerpKey(s, (k) => k.w);
    const open = smooth(def.openS - 0.06, def.openS + 0.12, s);
    const after = Math.max(0, (s - def.shoulderS) / (1 - def.shoulderS));
    for (let k = 0; k <= PA_NT; k++) {
      const t = k / PA_NT;
      const pleatD = def.frontPleats ? (0.0075 + 0.003 * Math.sin(s * 9 + t * 4)) * sawtooth(t) : 0.004 * Math.sin(t * Math.PI * 3 + s * 6);
      let flute = 0;
      for (const fl of flutes) flute += fl.a * Math.sin(t * Math.PI * 2 * fl.f * def.flutes * 0.5 + fl.ph + s * 1.5);
      flute *= (0.006 + 0.018 * after) / def.flutes;
      const fold = pleatD * (1 - open) + flute * open;
      // weighted borders hang a touch lower and straighter than the body of the cloth
      const edge = Math.pow(Math.abs(t - 0.5) * 2, 6) * 0.01 * after;
      const p = add(add(add(c, B, (t - 0.5) * w), N, fold), [0, -1, 0], edge);
      pos.set(p, paIdx(k, i) * 3);
    }
  }

  const cloth = new Cloth(pos);
  cloth.friction = 0.7;
  const shoulderI = Math.round(def.shoulderS * PA_NS);
  const k0 = Math.round(PA_NT * 0.3);
  const k1 = Math.round(PA_NT * 0.7);
  // pinned rows: the hip tuck, the shoulder brooch (on top and just past it), and an optional second tuck
  const pinRows = [shoulderI, shoulderI + 6];
  if (def.tuckS) pinRows.push(Math.round(def.tuckS * PA_NS));
  const isPinned = (k: number, i: number) => i <= 1 || (pinRows.includes(i) && k >= k0 && k <= k1);
  const tautUntil = def.tuckS ? Math.round(def.tuckS * PA_NS) : shoulderI;
  for (let k = 0; k <= PA_NT; k++)
    for (let i = 0; i <= PA_NS; i++) {
      const id = paIdx(k, i);
      cloth.margin[id] = 0.0075;
      if (isPinned(k, i)) cloth.pin(id);
      // rest lengths: the designed pleats are the metric; spans between pins are drawn snug
      if (i < PA_NS) cloth.link(id, paIdx(k, i + 1), cloth.dist(id, paIdx(k, i + 1)) * (i < tautUntil ? 0.93 : 1.0), 1, 0.6);
      if (k < PA_NT) cloth.link(id, paIdx(k + 1, i), cloth.dist(id, paIdx(k + 1, i)), 1, i > shoulderI ? 0.9 : 0.5);
      if (i < PA_NS && k < PA_NT) {
        cloth.link(id, paIdx(k + 1, i + 1), cloth.dist(id, paIdx(k + 1, i + 1)), 0.5, 0.1);
        cloth.link(paIdx(k + 1, i), paIdx(k, i + 1), cloth.dist(paIdx(k + 1, i), paIdx(k, i + 1)), 0.5, 0.1);
      }
      if (i < PA_NS - 1) cloth.link(id, paIdx(k, i + 2), cloth.dist(id, paIdx(k, i + 2)), 0.06, 0.03);
      if (k < PA_NT - 1) cloth.link(id, paIdx(k + 2, i), cloth.dist(id, paIdx(k + 2, i)), 0.07, 0.05);
    }
  // long-range ties to the pins on either side along the length: the cloth cannot stretch away from them
  const allPins = [1, ...pinRows].sort((a, b) => a - b);
  const pathLen = (k: number, a: number, b: number) => {
    let l = 0;
    for (let q = Math.min(a, b); q < Math.max(a, b); q++) l += cloth.dist(paIdx(k, q), paIdx(k, q + 1));
    return l;
  };
  for (let k = 0; k <= PA_NT; k++)
    for (let i = 2; i <= PA_NS; i++) {
      if (isPinned(k, i)) continue;
      const before = [...allPins].reverse().find((r) => r < i);
      const after = allPins.find((r) => r > i);
      for (const r of [before, after]) {
        if (r === undefined) continue;
        const kk = r <= 1 ? k : Math.min(k1, Math.max(k0, k));
        const l = pathLen(k, i, r) + cloth.dist(paIdx(kk, r), paIdx(k, r));
        const between = before !== undefined && after !== undefined;
        cloth.tie(paIdx(k, i), paIdx(kk, r), l * (between ? 0.95 : 1.01));
      }
    }
  return { cloth, length: total, shoulderI };
}

/**
 * At the tuck the pleats are pressed into a neat gathered band; they blossom
 * out of it below. Ease the zig-zag out over the top few centimetres.
 */
function smoothTuck(pos: Float32Array) {
  const W = 6;
  const src = new Float32Array(pos);
  for (let i = 0; i <= SK_NV; i++) {
    const y = src[(i * (SK_NU + 1) + WRAP_COLS) * 3 + 1];
    const w = smooth(WAIST_Y - 0.085, WAIST_Y - 0.01, y);
    if (w <= 0) continue;
    for (let j = WRAP_COLS + 1; j <= SK_NU; j++) {
      const acc = [0, 0, 0];
      let n = 0;
      for (let q = -W; q <= W; q++) {
        const jj = Math.min(SK_NU, Math.max(WRAP_COLS, j + q));
        const o = (i * (SK_NU + 1) + jj) * 3;
        acc[0] += src[o];
        acc[1] += src[o + 1];
        acc[2] += src[o + 2];
        n++;
      }
      const o = (i * (SK_NU + 1) + j) * 3;
      // keep the outermost surface: the band sits over the folds, never inside them
      let zMax = -Infinity;
      for (let q = -W; q <= W; q++) zMax = Math.max(zMax, src[(i * (SK_NU + 1) + Math.min(SK_NU, Math.max(WRAP_COLS, j + q))) * 3 + 2]);
      pos[o] = src[o] + (acc[0] / n - src[o]) * w;
      pos[o + 1] = src[o + 1] + (acc[1] / n - src[o + 1]) * w;
      pos[o + 2] = src[o + 2] + ((acc[2] / n) * 0.5 + zMax * 0.5 - src[o + 2]) * w;
    }
  }
}

/* ───────── shading baked into the cloth ───────── */

/** Soft ambient occlusion: darker in fold valleys and where cloth meets the body or floor. */
function bakeAO(pos: Float32Array, nu: number, nv: number, extra?: (x: number, y: number, z: number) => number) {
  const ao = new Float32Array((nu + 1) * (nv + 1));
  const P = (i: number, j: number): V => {
    const o = (Math.min(nv, Math.max(0, i)) * (nu + 1) + Math.min(nu, Math.max(0, j))) * 3;
    return [pos[o], pos[o + 1], pos[o + 2]];
  };
  for (let i = 0; i <= nv; i++)
    for (let j = 0; j <= nu; j++) {
      const p = P(i, j);
      const du = sub(P(i, j + 1), P(i, j - 1));
      const dv = sub(P(i + 1, j), P(i - 1, j));
      let n = norm(cross(du, dv));
      if (n[0] * p[0] + n[2] * p[2] < 0) n = [-n[0], -n[1], -n[2]];
      // concavity over a wider neighbourhood
      let lap: V = [0, 0, 0];
      let cnt = 0;
      for (const [a, b] of [[0, 2], [0, -2], [2, 0], [-2, 0], [0, 4], [0, -4]]) {
        lap = add(lap, sub(P(i + a, j + b), p));
        cnt++;
      }
      const conc = dot(n, lap) / cnt; // > 0 → valley
      let o = 1 - Math.min(0.32, Math.max(0, conc) * 18);
      if (extra) o *= extra(p[0], p[1], p[2]);
      ao[i * (nu + 1) + j] = o;
    }
  return ao;
}

/* ───────── the bake ───────── */

export interface DrapeBake {
  style: DrapeStyleId;
  pose: PoseId;
  skirt: Float32Array;
  pallu: Float32Array;
  skirtAO: Float32Array;
  palluAO: Float32Array;
  palluLength: number;
  shoulderI: number;
}

export interface BakeOptions {
  steps?: number;
  iterations?: number;
  onProgress?: (stage: string, f: number) => void;
}

function simulate(cloth: Cloth, steps: number, iterations: number, report?: (f: number) => void) {
  const dt = 1 / 90;
  // start from rest: resolve any initial contact before gravity acts
  cloth.gravity = 0;
  for (let q = 0; q < 12; q++) cloth.step(dt, iterations);
  cloth.prev.set(cloth.pos);
  cloth.gravity = -9.81;
  for (let q = 0; q < steps; q++) {
    // the last fifth is a calm settle
    cloth.damping = q > steps * 0.8 ? 0.9 : 0.985;
    cloth.step(dt, iterations);
    if (report && q % 20 === 0) report(q / steps);
  }
}

export function bakeDrape(style: DrapeStyleId, pose: PoseId, model: ModelData, sdf: SDF, opts: BakeOptions = {}): DrapeBake {
  const steps = opts.steps ?? 520;
  const iterations = opts.iterations ?? 12;
  const fit = fitFor(model, sdf);
  const body = [sdfCollider(sdf), floor(0)];

  const sk = buildSkirt("vibes", fit);
  sk.cloth.colliders = [...body, ...sk.cloth.colliders];
  simulate(sk.cloth, steps, iterations, (f) => opts.onProgress?.("skirt", f));

  smoothTuck(sk.cloth.pos);
  const hull = hullCollider(sk.cloth.pos, WAIST_Y + 0.025);
  const pa = buildPallu(style, "vibes", fit);
  pa.cloth.colliders = [...body, hull];
  simulate(pa.cloth, Math.round(steps * 0.8), iterations, (f) => opts.onProgress?.("pallu", f));

  // skirt shading: valleys, the tuck, the floor
  const skirtAO = bakeAO(sk.cloth.pos, SK_NU, SK_NV, (_x, y) => (y < 0.025 ? 0.86 + y * 5 : 1) * (y > WAIST_Y - 0.03 ? 0.9 : 1));
  const palluAO = bakeAO(pa.cloth.pos, PA_NS, PA_NT);
  return { style, pose, skirt: sk.cloth.pos, pallu: pa.cloth.pos, skirtAO, palluAO, palluLength: pa.length, shoulderI: pa.shoulderI };
}

/* ───────── compact binary form (public/drapes/*.bin) ───────── */

const MAGIC = 0x56424431; // "VBD1"
const Q = 16000;

export function encodeBake(b: DrapeBake): ArrayBuffer {
  const nS = b.skirt.length;
  const nP = b.pallu.length;
  const aS = b.skirtAO.length;
  const aP = b.palluAO.length;
  const header = 8 * 4;
  const buf = new ArrayBuffer(header + (nS + nP) * 2 + aS + aP + 4);
  const dv = new DataView(buf);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, nS, true);
  dv.setUint32(8, nP, true);
  dv.setUint32(12, aS, true);
  dv.setUint32(16, aP, true);
  dv.setFloat32(20, b.palluLength, true);
  dv.setUint32(24, b.shoulderI, true);
  let o = header;
  for (const arr of [b.skirt, b.pallu])
    for (let i = 0; i < arr.length; i++, o += 2) dv.setInt16(o, Math.round(arr[i] * Q), true);
  for (const arr of [b.skirtAO, b.palluAO]) for (let i = 0; i < arr.length; i++, o++) dv.setUint8(o, Math.round(Math.min(1, Math.max(0, arr[i])) * 255));
  return buf;
}

export function decodeBake(buf: ArrayBuffer, style: DrapeStyleId, pose: PoseId): DrapeBake {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error("not a drape bake");
  const nS = dv.getUint32(4, true);
  const nP = dv.getUint32(8, true);
  const aS = dv.getUint32(12, true);
  const aP = dv.getUint32(16, true);
  const palluLength = dv.getFloat32(20, true);
  const shoulderI = dv.getUint32(24, true);
  let o = 32;
  const read = (n: number) => {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++, o += 2) a[i] = dv.getInt16(o, true) / Q;
    return a;
  };
  const skirt = read(nS);
  const pallu = read(nP);
  const readAO = (n: number) => {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++, o++) a[i] = dv.getUint8(o) / 255;
    return a;
  };
  return { style, pose, skirt, pallu, skirtAO: readAO(aS), palluAO: readAO(aP), palluLength, shoulderI };
}
