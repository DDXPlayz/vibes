/**
 * A small position-based cloth solver.
 *
 * Woven silk barely stretches but folds and gathers easily, so every
 * constraint has two stiffnesses: strong against stretching, weak against
 * compression. That asymmetry is what lets a straight rectangle of fabric
 * gather at the waist, fall into soft flutes and break over the feet.
 *
 * The solver runs offline (see scripts/bake-drapes.ts): one bake per drape
 * style × pose, reused for every saree. It has no DOM or three.js dependency.
 */

export interface Collider {
  /** Move particle i (x,y,z at pos[3i..]) out of the obstacle; return true on contact. */
  (pos: Float32Array, i: number, margin: number): boolean;
}

export class Cloth {
  readonly n: number;
  readonly pos: Float32Array;
  readonly prev: Float32Array;
  readonly invMass: Float32Array;
  /** Per-particle collision margin: lets stacked layers keep their order. */
  readonly margin: Float32Array;
  private ci: number[] = [];
  private rest: number[] = [];
  private kS: number[] = [];
  private kC: number[] = [];
  private tether: number[] = [];
  private tetherLen: number[] = [];
  colliders: Collider[] = [];
  gravity = -9.81;
  damping = 0.985;
  friction = 0.55;

  constructor(initial: Float32Array) {
    this.n = initial.length / 3;
    this.pos = new Float32Array(initial);
    this.prev = new Float32Array(initial);
    this.invMass = new Float32Array(this.n).fill(1);
    this.margin = new Float32Array(this.n).fill(0.004);
  }

  pin(i: number) {
    this.invMass[i] = 0;
  }

  dist(i: number, j: number) {
    const p = this.pos;
    return Math.hypot(p[3 * j] - p[3 * i], p[3 * j + 1] - p[3 * i + 1], p[3 * j + 2] - p[3 * i + 2]);
  }

  /** Distance constraint with separate stretch / compression stiffness (0..1). */
  link(i: number, j: number, rest: number, stretch: number, compress: number) {
    this.ci.push(i, j);
    this.rest.push(rest);
    this.kS.push(stretch);
    this.kC.push(compress);
  }

  /** Long-range attachment: i may never be further than `len` from anchor a. */
  tie(i: number, a: number, len: number) {
    this.tether.push(i, a);
    this.tetherLen.push(len);
  }

  step(dt: number, iterations: number) {
    const { pos, prev, invMass, n } = this;
    const g = this.gravity * dt * dt;
    const damp = this.damping;
    for (let i = 0; i < n; i++) {
      if (invMass[i] === 0) continue;
      const k = 3 * i;
      for (let a = 0; a < 3; a++) {
        const v = (pos[k + a] - prev[k + a]) * damp;
        prev[k + a] = pos[k + a];
        pos[k + a] += v;
      }
      pos[k + 1] += g;
    }
    const ci = this.ci;
    const m = this.rest.length;
    for (let it = 0; it < iterations; it++) {
      for (let c = 0; c < m; c++) {
        const i = ci[2 * c];
        const j = ci[2 * c + 1];
        const wi = invMass[i];
        const wj = invMass[j];
        const ws = wi + wj;
        if (ws === 0) continue;
        const dx = pos[3 * j] - pos[3 * i];
        const dy = pos[3 * j + 1] - pos[3 * i + 1];
        const dz = pos[3 * j + 2] - pos[3 * i + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-9) continue;
        const diff = len - this.rest[c];
        const k = diff > 0 ? this.kS[c] : this.kC[c];
        if (k === 0) continue;
        const s = (k * diff) / (len * ws);
        pos[3 * i] += wi * s * dx;
        pos[3 * i + 1] += wi * s * dy;
        pos[3 * i + 2] += wi * s * dz;
        pos[3 * j] -= wj * s * dx;
        pos[3 * j + 1] -= wj * s * dy;
        pos[3 * j + 2] -= wj * s * dz;
      }
      this.applyTethers();
      if (it % 2 === 1 || it === iterations - 1) this.collide();
    }
  }

  private applyTethers() {
    const { pos, invMass } = this;
    const t = this.tether;
    for (let c = 0; c < this.tetherLen.length; c++) {
      const i = t[2 * c];
      if (invMass[i] === 0) continue;
      const a = t[2 * c + 1];
      const dx = pos[3 * i] - pos[3 * a];
      const dy = pos[3 * i + 1] - pos[3 * a + 1];
      const dz = pos[3 * i + 2] - pos[3 * a + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const max = this.tetherLen[c];
      if (len > max) {
        const s = max / len;
        pos[3 * i] = pos[3 * a] + dx * s;
        pos[3 * i + 1] = pos[3 * a + 1] + dy * s;
        pos[3 * i + 2] = pos[3 * a + 2] + dz * s;
      }
    }
  }

  private collide() {
    const { pos, prev, invMass, margin, n, friction } = this;
    for (let i = 0; i < n; i++) {
      if (invMass[i] === 0) continue;
      const k = 3 * i;
      const bx = pos[k];
      const by = pos[k + 1];
      const bz = pos[k + 2];
      let hit = false;
      for (const c of this.colliders) if (c(pos, i, margin[i])) hit = true;
      if (!hit) continue;
      // Coulomb-style friction: of this step's motion, cancel most of the part
      // that slides along the surface — cloth resting on the body stays put.
      let nx = pos[k] - bx;
      let ny = pos[k + 1] - by;
      let nz = pos[k + 2] - bz;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl < 1e-9) continue;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const dx = pos[k] - prev[k];
      const dy = pos[k + 1] - prev[k + 1];
      const dz = pos[k + 2] - prev[k + 2];
      const dn = dx * nx + dy * ny + dz * nz;
      pos[k] -= (dx - dn * nx) * friction;
      pos[k + 1] -= (dy - dn * ny) * friction;
      pos[k + 2] -= (dz - dn * nz) * friction;
    }
  }
}
