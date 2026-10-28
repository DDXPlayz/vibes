import * as THREE from "three";
import type { DrapeStyleId, PoseId } from "@/lib/types";
import { PA_NS, PA_NT, SK_NU, SK_NV, WAIST_Y, WRAP_COLS, initialDrape, palluUV, skirtLayout, skirtUV, type DrapeBake } from "./drapeBake";
import { getBakeSync, loadBake } from "./drapes";

/**
 * The digital drape.
 *
 * The cloth is simulated offline (src/studio/drapeBake.ts) — gravity, the
 * body, friction, a rectangle of fabric gathered at the tuck — once per drape
 * style × pose. At runtime the rig *plays* that settled cloth: the drape-in
 * animation, the woven transition and a soft pallu sway all start from the
 * simulated shape, so what you see at rest is the physics, not a formula.
 *
 * The textile is mapped at true physical scale along the saree's length, so
 * the real saree's border, body and pallu land exactly where they would.
 */

export const DRAPE_STYLES: Record<DrapeStyleId, { label: string; note: string }> = {
  nivi: { label: "Nivi", note: "Pleated pallu over the left shoulder, falling behind." },
  open: { label: "Open pallu", note: "Unpleated pallu spread across the bodice, falling long." },
  seedha: { label: "Seedha pallu", note: "Pallu brought from the back over the right shoulder, displayed in front." },
};

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

const LAYOUT = skirtLayout();
const SKIRT_UV = skirtUV(LAYOUT);

export class DrapeRig {
  readonly group = new THREE.Group();
  readonly skirt: THREE.Mesh;
  readonly pallu: THREE.Mesh;
  progress = 1;
  private style: DrapeStyleId;
  private pose: PoseId;
  private bake!: DrapeBake;
  private pleatFlat = new Float32Array(0);
  private pivot = new THREE.Vector3();
  private lastKey = "";
  private lastPallu = "";

  constructor(material: THREE.Material, style: DrapeStyleId = "nivi", pose: PoseId = "classic") {
    this.style = style;
    this.pose = pose;
    this.skirt = new THREE.Mesh(grid(SK_NU, SK_NV), material);
    this.pallu = new THREE.Mesh(grid(PA_NS, PA_NT), material);
    this.skirt.name = "skirt";
    this.pallu.name = "pallu";
    (this.skirt.geometry.getAttribute("uv") as THREE.BufferAttribute).set(SKIRT_UV);
    for (const m of [this.skirt, this.pallu]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
    this.group.add(this.skirt, this.pallu);
    this.configure(style, pose);
  }

  /** Switch style/pose. Uses a baked drape when loaded, the unsimulated shape until then. */
  configure(style: DrapeStyleId, pose: PoseId) {
    this.style = style;
    this.pose = pose;
    const ready = getBakeSync(style, pose);
    this.apply(ready ?? initialDrape(style, pose));
    if (!ready)
      loadBake(style, pose)
        .then((b) => {
          if (this.style === style && this.pose === pose) this.apply(b);
        })
        .catch(() => undefined);
  }

  setMaterial(material: THREE.Material) {
    this.skirt.material = material;
    this.pallu.material = material;
  }

  private apply(b: DrapeBake) {
    this.bake = b;
    const uv = this.pallu.geometry.getAttribute("uv") as THREE.BufferAttribute;
    uv.set(palluUV(b.palluLength));
    uv.needsUpdate = true;
    setAO(this.skirt.geometry, b.skirtAO);
    setAO(this.pallu.geometry, b.palluAO);
    // the pleats before they are formed: the same cloth, smoothed flat across each pleat
    const flat = new Float32Array(b.skirt);
    const W = 4;
    for (let i = 0; i <= SK_NV; i++)
      for (let j = WRAP_COLS; j <= SK_NU; j++) {
        const acc = [0, 0, 0];
        let n = 0;
        for (let q = -W; q <= W; q++) {
          const jj = Math.min(SK_NU, Math.max(WRAP_COLS - 2, j + q));
          const o = (i * (SK_NU + 1) + jj) * 3;
          acc[0] += b.skirt[o];
          acc[1] += b.skirt[o + 1];
          acc[2] += b.skirt[o + 2];
          n++;
        }
        const o = (i * (SK_NU + 1) + j) * 3;
        flat[o] = acc[0] / n;
        flat[o + 1] = acc[1] / n;
        flat[o + 2] = acc[2] / n;
      }
    this.pleatFlat = flat;
    // the shoulder pin is the pivot the pallu falls from
    const p = this.pivot.set(0, 0, 0);
    for (let k = 0; k <= PA_NT; k++) {
      const o = (k * (PA_NS + 1) + b.shoulderI) * 3;
      p.x += b.pallu[o];
      p.y += b.pallu[o + 1];
      p.z += b.pallu[o + 2];
    }
    p.multiplyScalar(1 / (PA_NT + 1));
    this.lastKey = "";
    this.lastPallu = "";
  }

  /**
   * progress: 0 = bare mannequin, 1 = fully draped and settled.
   * time: seconds, for the gentle sway of the pallu. sway = 0 holds it still.
   */
  update(progress: number, time: number, sway = 1) {
    const p = Math.min(1, Math.max(0, progress));
    const key = `${p.toFixed(4)}|${this.style}|${this.pose}`;
    if (key !== this.lastKey) this.updateSkirt(p);
    const pk = `${key}|${sway ? time.toFixed(2) : "still"}`;
    if (pk !== this.lastPallu) this.updatePallu(p, time, sway);
    this.lastKey = key;
    this.lastPallu = pk;
    this.progress = p;
  }

  private updateSkirt(p: number) {
    const geo = this.skirt.geometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const out = pos.array as Float32Array;
    const F = this.bake.skirt;
    if (p >= 1) {
      out.set(F);
    } else {
      const flat = this.pleatFlat;
      const wrap = smooth(0, 0.42, p) * SK_NU;
      const pleat = smooth(0.36, 0.62, p);
      const drop = 0.35 + 0.65 * smooth(0.0, 0.14, p);
      const jw = Math.floor(wrap);
      for (let i = 0; i <= SK_NV; i++)
        for (let j = 0; j <= SK_NU; j++) {
          const src = Math.min(j, jw);
          const o = (i * (SK_NU + 1) + src) * 3;
          const lerp = src >= WRAP_COLS ? pleat : 1;
          let x = flat[o] + (F[o] - flat[o]) * lerp;
          let y = flat[o + 1] + (F[o + 1] - flat[o + 1]) * lerp;
          let z = flat[o + 2] + (F[o + 2] - flat[o + 2]) * lerp;
          // the edge still travelling round the body lifts away from it, as if being drawn
          const edge = jw < SK_NU ? Math.max(0, 1 - (jw - j) / 10) : 0;
          if (edge > 0) {
            const lift = 1 + edge * edge * 0.12 * (1 - p);
            x *= lift;
            z *= lift;
          }
          y = WAIST_Y - (WAIST_Y - y) * drop;
          const d = (i * (SK_NU + 1) + j) * 3;
          out[d] = x;
          out[d + 1] = y;
          out[d + 2] = z;
        }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    this.skirt.visible = p > 0.001;
  }

  private updatePallu(p: number, time: number, sway: number) {
    const geo = this.pallu.geometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const out = pos.array as Float32Array;
    const F = this.bake.pallu;
    const sh = this.bake.shoulderI;
    const reveal = smooth(0.5, 0.84, p);
    const fallT = smooth(0.7, 1.0, p);
    // damped settle — the cloth swings just past rest and comes back, once
    const settle = fallT >= 1 ? 1 : 1 - (1 - fallT) ** 2 * Math.cos(fallT * Math.PI * 1.5);
    const lift = (1 - settle) * 1.2;
    const dir = this.style === "seedha" ? -1 : 1;
    const pv = this.pivot;
    const lastI = Math.floor(reveal * PA_NS);
    for (let i = 0; i <= PA_NS; i++) {
      const si = Math.min(i, lastI);
      const tail = Math.max(0, (si - sh) / (PA_NS - sh));
      // sway only ever moves the cloth away from the body, so it never needs collision
      const breathe = sway * tail * tail * (0.016 * (0.5 + 0.5 * Math.sin(time * 0.5 + 0.6)) + 0.005 * (0.5 + 0.5 * Math.sin(time * 1.25 + si * 0.05)));
      const ang = si > sh ? lift * Math.pow(tail, 0.6) + breathe : 0;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang) * dir;
      for (let k = 0; k <= PA_NT; k++) {
        const o = (k * (PA_NS + 1) + si) * 3;
        let x = F[o];
        let y = F[o + 1];
        let z = F[o + 2];
        if (ang !== 0) {
          const dy = y - pv.y;
          const dz = z - pv.z;
          y = pv.y + dy * ca - dz * sa;
          z = pv.z + dy * sa + dz * ca;
        }
        if (i > lastI) {
          // not yet laid: gathered into the travelling end
          const c = (Math.round(PA_NT / 2) * (PA_NS + 1) + si) * 3;
          x = x * 0.3 + F[c] * 0.7;
          y = y * 0.3 + F[c + 1] * 0.7;
          z = z * 0.3 + F[c + 2] * 0.7;
        }
        const d = (k * (PA_NS + 1) + i) * 3;
        out[d] = x;
        out[d + 1] = y;
        out[d + 2] = z;
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

function setAO(geo: THREE.BufferGeometry, ao: Float32Array) {
  const c = geo.getAttribute("color") as THREE.BufferAttribute;
  const a = c.array as Float32Array;
  for (let i = 0; i < ao.length; i++) a[3 * i] = a[3 * i + 1] = a[3 * i + 2] = ao[i];
  c.needsUpdate = true;
}

function grid(nu: number, nv: number) {
  const geo = new THREE.BufferGeometry();
  const count = (nu + 1) * (nv + 1);
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
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
