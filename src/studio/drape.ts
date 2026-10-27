import * as THREE from "three";
import type { DrapeStyleId, PoseId } from "@/lib/types";
import { SKIRT, armJoints, pushOutside, pushOutsideCapsule, skirtRx, skirtRz } from "./body";

/**
 * The digital drape.
 *
 * Real-time cloth simulation of 5.5 m of silk is too expensive for a
 * storefront, so the drape is a *procedural rig*: two parametric surfaces
 * (the pleated skirt and the pallu) that are shaped by the analytic body
 * envelope and animated by a single `progress` value. The textile texture is
 * mapped 1:1 onto the flat saree length, so the physical saree's colour,
 * border, motifs and pallu land exactly where they would on a real drape —
 * nothing is redesigned.
 *
 * Saree texture layout (u along length, v across width):
 *   u 0.00–0.40  skirt wrap
 *   u 0.40–0.56  front pleats
 *   u 0.56–1.00  pallu (decorated end panel starts ≈ 0.78)
 */

export const U_SKIRT_END = 0.4;
export const U_PLEAT_END = 0.56;

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
const tri = (x: number) => 1 - 2 * Math.abs((x - Math.floor(x)) - 0.5);

interface PathKey {
  p: [number, number, number];
  /** Approximate width direction of the fabric at this point. */
  b: [number, number, number];
  w: number;
  fold: number;
  folds: number;
}

/** Each drape style is just data: a centreline for the pallu. */
export const DRAPE_STYLES: Record<DrapeStyleId, { label: string; note: string; keys: PathKey[]; shoulderS: number }> = {
  nivi: {
    label: "Nivi",
    note: "Pleated pallu over the left shoulder, falling behind.",
    shoulderS: 0.42,
    keys: [
      { p: [-0.175, 1.0, 0.09], b: [0.5, -0.86, 0], w: 0.2, fold: 0.006, folds: 7 },
      { p: [-0.11, 1.1, 0.15], b: [0.6, -0.8, 0], w: 0.17, fold: 0.008, folds: 7 },
      { p: [-0.01, 1.22, 0.16], b: [0.75, -0.66, 0], w: 0.16, fold: 0.008, folds: 7 },
      { p: [0.09, 1.36, 0.14], b: [0.86, -0.5, 0], w: 0.15, fold: 0.008, folds: 7 },
      { p: [0.145, 1.47, 0.06], b: [0.95, -0.3, 0], w: 0.14, fold: 0.007, folds: 6 },
      { p: [0.155, 1.512, -0.02], b: [0.96, -0.28, 0], w: 0.15, fold: 0.006, folds: 6 },
      { p: [0.16, 1.45, -0.115], b: [1, -0.05, -0.05], w: 0.22, fold: 0.008, folds: 6 },
      { p: [0.17, 1.22, -0.15], b: [1, 0, -0.1], w: 0.36, fold: 0.012, folds: 5 },
      { p: [0.18, 0.92, -0.2], b: [1, 0, -0.12], w: 0.46, fold: 0.016, folds: 5 },
      { p: [0.185, 0.6, -0.24], b: [1, 0, -0.14], w: 0.52, fold: 0.02, folds: 5 },
    ],
  },
  open: {
    label: "Open pallu",
    note: "Unpleated pallu spread across the bodice, falling long.",
    shoulderS: 0.44,
    keys: [
      { p: [-0.17, 1.0, 0.1], b: [0.5, -0.86, 0], w: 0.3, fold: 0.006, folds: 4 },
      { p: [-0.08, 1.12, 0.16], b: [0.6, -0.8, 0], w: 0.36, fold: 0.008, folds: 4 },
      { p: [0.02, 1.26, 0.165], b: [0.75, -0.66, 0], w: 0.36, fold: 0.008, folds: 4 },
      { p: [0.1, 1.39, 0.12], b: [0.88, -0.48, 0], w: 0.3, fold: 0.008, folds: 4 },
      { p: [0.16, 1.512, -0.01], b: [0.96, -0.28, 0], w: 0.22, fold: 0.006, folds: 5 },
      { p: [0.18, 1.44, -0.12], b: [1, -0.1, -0.1], w: 0.3, fold: 0.01, folds: 5 },
      { p: [0.2, 1.15, -0.16], b: [1, 0, -0.12], w: 0.48, fold: 0.016, folds: 5 },
      { p: [0.21, 0.75, -0.21], b: [1, 0, -0.14], w: 0.56, fold: 0.02, folds: 5 },
      { p: [0.215, 0.36, -0.25], b: [1, 0, -0.15], w: 0.6, fold: 0.024, folds: 5 },
    ],
  },
  seedha: {
    label: "Seedha pallu",
    note: "Pallu brought from the back over the right shoulder, displayed in front.",
    shoulderS: 0.42,
    keys: [
      { p: [0.17, 1.0, -0.08], b: [-0.5, -0.86, 0], w: 0.2, fold: 0.006, folds: 6 },
      { p: [0.08, 1.15, -0.13], b: [-0.6, -0.8, 0], w: 0.17, fold: 0.008, folds: 6 },
      { p: [-0.04, 1.3, -0.12], b: [-0.8, -0.6, 0], w: 0.16, fold: 0.008, folds: 6 },
      { p: [-0.14, 1.45, -0.06], b: [-0.95, -0.3, 0], w: 0.15, fold: 0.007, folds: 6 },
      { p: [-0.155, 1.512, 0.02], b: [-0.96, -0.28, 0], w: 0.16, fold: 0.006, folds: 6 },
      { p: [-0.13, 1.42, 0.14], b: [-1, -0.05, 0.12], w: 0.26, fold: 0.008, folds: 5 },
      { p: [-0.08, 1.2, 0.2], b: [-1, 0, 0.2], w: 0.42, fold: 0.012, folds: 5 },
      { p: [-0.04, 0.92, 0.23], b: [-1, 0, 0.12], w: 0.5, fold: 0.016, folds: 5 },
      { p: [-0.02, 0.62, 0.27], b: [-1, 0, 0.1], w: 0.54, fold: 0.018, folds: 5 },
    ],
  },
};

const SK_U = 220;
const SK_V = 64;
const PA_S = 170;
const PA_T = 30;

const THETA_START = 0.25;
const SPAN = Math.PI * 2 + 0.42; // the pleats overlap the tucked-in start
const PLEAT_FRAC = 1 - 0.8 / SPAN;

export class DrapeRig {
  readonly group = new THREE.Group();
  readonly skirt: THREE.Mesh;
  readonly pallu: THREE.Mesh;
  progress = 1;
  private style: DrapeStyleId;
  private pose: PoseId;
  private centre: THREE.Vector3[] = [];
  private tangent: THREE.Vector3[] = [];
  private across: THREE.Vector3[] = [];
  private normal: THREE.Vector3[] = [];
  private width: number[] = [];
  private foldAmp: number[] = [];
  private foldN: number[] = [];
  private arms: { a: THREE.Vector3; b: THREE.Vector3; r: number }[] = [];
  private lastKey = "";

  constructor(material: THREE.Material, style: DrapeStyleId = "nivi", pose: PoseId = "classic") {
    this.style = style;
    this.pose = pose;
    this.skirt = new THREE.Mesh(grid(SK_U, SK_V), material);
    this.pallu = new THREE.Mesh(grid(PA_S, PA_T), material);
    this.skirt.name = "skirt";
    this.pallu.name = "pallu";
    for (const m of [this.skirt, this.pallu]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
    this.writeSkirtUVs();
    this.writePalluUVs();
    this.group.add(this.skirt, this.pallu);
    this.configure(style, pose);
  }

  configure(style: DrapeStyleId, pose: PoseId) {
    this.style = style;
    this.pose = pose;
    this.arms = armJoints(pose).flatMap((j) => [
      { a: j.sh, b: j.elbow, r: 0.062 },
      { a: j.elbow, b: j.wrist, r: 0.045 },
    ]);
    this.buildPath();
    this.lastKey = "";
  }

  setMaterial(material: THREE.Material) {
    this.skirt.material = material;
    this.pallu.material = material;
  }

  private buildPath() {
    const def = DRAPE_STYLES[this.style];
    const pts = def.keys.map((k) => new THREE.Vector3(...k.p));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    // key positions as cumulative chord fractions
    const chord = [0];
    for (let i = 1; i < pts.length; i++) chord.push(chord[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = chord[chord.length - 1];
    const kf = chord.map((c) => c / total);
    const lerpKey = (s: number, f: (k: PathKey) => number) => {
      for (let i = 1; i < kf.length; i++) {
        if (s <= kf[i]) {
          const t = (s - kf[i - 1]) / (kf[i] - kf[i - 1]);
          const e = t * t * (3 - 2 * t);
          return f(def.keys[i - 1]) * (1 - e) + f(def.keys[i]) * e;
        }
      }
      return f(def.keys[def.keys.length - 1]);
    };
    this.centre = [];
    this.tangent = [];
    this.across = [];
    this.normal = [];
    this.width = [];
    this.foldAmp = [];
    this.foldN = [];
    for (let i = 0; i <= PA_S; i++) {
      const s = i / PA_S;
      const c = curve.getPointAt(s);
      const t = curve.getTangentAt(s).normalize();
      const b0 = new THREE.Vector3(lerpKey(s, (k) => k.b[0]), lerpKey(s, (k) => k.b[1]), lerpKey(s, (k) => k.b[2]));
      const b = b0.sub(t.clone().multiplyScalar(b0.dot(t))).normalize();
      const n = new THREE.Vector3().crossVectors(t, b).normalize();
      if (n.x * c.x + n.z * c.z < 0) n.negate();
      this.centre.push(c);
      this.tangent.push(t);
      this.across.push(b);
      this.normal.push(n);
      this.width.push(lerpKey(s, (k) => k.w));
      this.foldAmp.push(lerpKey(s, (k) => k.fold));
      this.foldN.push(lerpKey(s, (k) => k.folds));
    }
  }

  private writeSkirtUVs() {
    const uv = this.skirt.geometry.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i <= SK_V; i++) {
      for (let j = 0; j <= SK_U; j++) {
        const f = j / SK_U;
        const u = f < PLEAT_FRAC ? (f / PLEAT_FRAC) * U_SKIRT_END : U_SKIRT_END + ((f - PLEAT_FRAC) / (1 - PLEAT_FRAC)) * (U_PLEAT_END - U_SKIRT_END);
        // the top ~12% of the width is tucked into the waist, so the upper border is hidden
        uv.setXY(i * (SK_U + 1) + j, u, (i / SK_V) * 0.88);
      }
    }
    uv.needsUpdate = true;
  }

  private writePalluUVs() {
    const uv = this.pallu.geometry.getAttribute("uv") as THREE.BufferAttribute;
    for (let k = 0; k <= PA_T; k++) {
      for (let i = 0; i <= PA_S; i++) {
        uv.setXY(k * (PA_S + 1) + i, U_PLEAT_END + (i / PA_S) * (1 - U_PLEAT_END), k / PA_T);
      }
    }
    uv.needsUpdate = true;
  }

  /**
   * progress: 0 = bare mannequin, 1 = fully draped and settled.
   * time: seconds, used for the gentle idle sway of the pallu.
   */
  update(progress: number, time: number, sway = 1) {
    const p = Math.min(1, Math.max(0, progress));
    const key = `${p.toFixed(4)}|${this.style}|${this.pose}`;
    const skirtDirty = key !== this.lastKey;
    this.lastKey = key;
    if (skirtDirty) this.updateSkirt(p);
    this.updatePallu(p, time, sway);
    this.progress = p;
  }

  private updateSkirt(p: number) {
    const geo = this.skirt.geometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const wrap = smooth(0.0, 0.4, p);
    const pleat = smooth(0.34, 0.58, p);
    const drop = smooth(0.0, 0.12, p);
    for (let i = 0; i <= SK_V; i++) {
      const v = i / SK_V;
      // the hem drops in as the wrap begins
      const y = SKIRT.top - (1 - v) * (SKIRT.top - SKIRT.hem) * (0.35 + 0.65 * drop);
      const down = 1 - v;
      const rx = skirtRx(y);
      const rz = skirtRz(y);
      for (let j = 0; j <= SK_U; j++) {
        let f = j / SK_U;
        let lift = 0;
        if (f > wrap) {
          f = wrap;
        } else if (wrap < 1 && f > wrap - 0.06) {
          lift = ((f - (wrap - 0.06)) / 0.06) ** 2 * 0.035 * (1 - wrap);
        }
        const th = THETA_START + f * SPAN;
        let r = 0;
        // inner layer under the pleats sits slightly inside
        if (f < 0.1) r -= 0.006 * (1 - f / 0.1);
        r += 0.011 * down ** 1.4 * Math.sin(th * 5 + 1.3) + 0.005 * down * Math.sin(th * 11 + 0.4) + 0.003 * down * Math.sin(th * 23 + 2.1);
        if (f >= PLEAT_FRAC) {
          const phi = (f - PLEAT_FRAC) / (1 - PLEAT_FRAC);
          const edge = smooth(0, 0.06, phi) * smooth(1, 0.94, phi);
          r += 0.01 + pleat * edge * (0.004 + 0.03 * down) * (0.3 + 0.7 * down) * tri(phi * 10) + pleat * 0.012 * down;
        }
        r += lift;
        const s = Math.sin(th);
        const c = Math.cos(th);
        pos.setXYZ(i * (SK_U + 1) + j, s * (rx + r), y, c * (rz + r));
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    this.skirt.visible = p > 0.001;
  }

  private tmp = new THREE.Vector3();
  private updatePallu(p: number, time: number, sway: number) {
    const geo = this.pallu.geometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const reveal = smooth(0.48, 0.84, p);
    const fallT = smooth(0.7, 1.0, p);
    // damped settle — the fabric overshoots very slightly and comes to rest
    const settle = fallT >= 1 ? 1 : 1 - (1 - fallT) ** 2 * Math.cos(fallT * Math.PI * 1.5);
    const lift = (1 - settle) * 1.25;
    const sh = Math.round(DRAPE_STYLES[this.style].shoulderS * PA_S);
    const pivot = this.centre[sh];
    const seedha = this.style === "seedha";
    const v = this.tmp;
    for (let i = 0; i <= PA_S; i++) {
      const s = i / PA_S;
      const si = Math.min(i, Math.floor(reveal * PA_S));
      const c = this.centre[si];
      const b = this.across[si];
      const n = this.normal[si];
      const w = this.width[si] * (i > si ? 0.3 : 1);
      const tail = Math.max(0, (si - sh) / (PA_S - sh));
      const amp = this.foldAmp[si] * (1 + 0.15 * Math.sin(time * 0.9 + s * 4) * tail * sway);
      // idle sway angle grows toward the end of the pallu
      const swayA = sway * tail * tail * (0.035 * Math.sin(time * 0.55 + 0.6) + 0.012 * Math.sin(time * 1.3 + s * 3));
      const ang = (si > sh ? lift * tail ** 0.6 + swayA : 0);
      for (let k = 0; k <= PA_T; k++) {
        const t = k / PA_T;
        const off = (t - 0.5) * w;
        const fold = amp * Math.sin(t * Math.PI * this.foldN[si] + s * 2.0) * (0.6 + 0.4 * Math.sin(s * 9.0 + t * 3));
        v.set(c.x + b.x * off + n.x * fold, c.y + b.y * off + n.y * fold, c.z + b.z * off + n.z * fold);
        if (ang !== 0) {
          // rotate about the shoulder pivot around x — the pallu "falls"
          const dy = v.y - pivot.y;
          const dz = v.z - pivot.z;
          const dir = seedha ? -1 : 1;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang) * dir;
          v.y = pivot.y + dy * ca - dz * sa;
          v.z = pivot.z + dy * sa + dz * ca;
        }
        pushOutside(v, 0.012);
        for (const a of this.arms) pushOutsideCapsule(v, a.a, a.b, a.r);
        pos.setXYZ(k * (PA_S + 1) + i, v.x, v.y, v.z);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    this.pallu.visible = reveal > 0.002;
  }

  dispose() {
    this.skirt.geometry.dispose();
    this.pallu.geometry.dispose();
  }
}

function grid(nu: number, nv: number) {
  const geo = new THREE.BufferGeometry();
  const count = (nu + 1) * (nv + 1);
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  const idx: number[] = [];
  for (let i = 0; i < nv; i++)
    for (let j = 0; j < nu; j++) {
      const a = i * (nu + 1) + j;
      const b = a + nu + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  geo.setIndex(idx);
  return geo;
}
