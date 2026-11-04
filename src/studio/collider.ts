import type { Collider } from "./cloth";
import type { MeshData } from "./modelFormat";

/**
 * What the cloth collides with: her body (a signed distance field built from
 * the model mesh), the floor, and the finished skirt (for the pallu).
 */

type V3 = { x: number; y: number; z: number };

/** A capsule whose radius tapers from ra (at a) to rb (at b). */
export function taperedCapsule(a: V3, b: V3, ra: number, rb: number): Collider {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const ab2 = abx * abx + aby * aby + abz * abz;
  const minY = Math.min(a.y, b.y) - Math.max(ra, rb) - 0.03;
  const maxY = Math.max(a.y, b.y) + Math.max(ra, rb) + 0.03;
  return (p, i, m) => {
    const k = 3 * i;
    const y = p[k + 1];
    if (y < minY || y > maxY) return false;
    const px = p[k] - a.x;
    const py = y - a.y;
    const pz = p[k + 2] - a.z;
    const t = Math.min(1, Math.max(0, (px * abx + py * aby + pz * abz) / ab2));
    const dx = px - abx * t;
    const dy = py - aby * t;
    const dz = pz - abz * t;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const r = ra + (rb - ra) * t + m;
    if (d >= r || d < 1e-7) return false;
    const s = r / d;
    p[k] = a.x + abx * t + dx * s;
    p[k + 1] = a.y + aby * t + dy * s;
    p[k + 2] = a.z + abz * t + dz * s;
    return true;
  };
}

export function sphere(c: V3, r: number): Collider {
  return taperedCapsule(c, { x: c.x, y: c.y + 1e-4, z: c.z }, r, r);
}

export function floor(level = 0): Collider {
  return (p, i, m) => {
    const k = 3 * i + 1;
    if (p[k] >= level + m) return false;
    p[k] = level + m;
    return true;
  };
}

/**
 * The outer surface of a finished skirt as a height × angle radius map, so
 * the pallu can lie on the skirt instead of passing through it.
 */
export function hullCollider(positions: Float32Array, top: number): Collider {
  const NY = 120;
  const NT = 96;
  const R = new Float32Array(NY * NT);
  const yAt = (y: number) => Math.min(NY - 1, Math.max(0, Math.round((y / top) * (NY - 1))));
  const tAt = (th: number) => ((Math.round(((th + Math.PI) / (2 * Math.PI)) * NT) % NT) + NT) % NT;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (y > top) continue;
    const b = yAt(y) * NT + tAt(Math.atan2(x, z));
    R[b] = Math.max(R[b], Math.hypot(x, z));
  }
  // dilate so gaps between grid samples are closed
  const D = new Float32Array(R);
  for (let yi = 0; yi < NY; yi++)
    for (let ti = 0; ti < NT; ti++) {
      let v = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dt = -2; dt <= 2; dt++) {
          const yy = Math.min(NY - 1, Math.max(0, yi + dy));
          v = Math.max(v, R[yy * NT + ((ti + dt + NT) % NT)]);
        }
      D[yi * NT + ti] = v;
    }
  return (p, i, m) => {
    const k = 3 * i;
    const y = p[k + 1];
    if (y > top || y < 0) return false;
    const x = p[k];
    const z = p[k + 2];
    const r = D[yAt(y) * NT + tAt(Math.atan2(x, z))];
    if (r === 0) return false;
    const d = Math.hypot(x, z);
    const want = r + m;
    if (d >= want || d < 1e-6) return false;
    p[k] = (x / d) * want;
    p[k + 2] = (z / d) * want;
    return true;
  };
}

/* ───────── the model's body as a signed distance field ───────── */

export interface SDF {
  min: [number, number, number];
  h: number;
  n: [number, number, number];
  d: Float32Array;
}

/**
 * Signed distance to her body surface on a 6 mm grid. Computed in a narrow
 * band around the surface from dense surface samples (sign from the sample's
 * normal), then the far field is flood-filled from outside, so anything deep
 * inside reads as inside.
 */
export function bodySDF(body: MeshData, h = 0.006, band = 0.03): SDF {
  const P = body.pos;
  const Nn = body.normal;
  const I = body.index;
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3)
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], P[i + a]);
      hi[a] = Math.max(hi[a], P[i + a]);
    }
  lo = lo.map((v) => v - band - 2 * h);
  hi = hi.map((v) => v + band + 2 * h);
  const n = [0, 1, 2].map((a) => Math.ceil((hi[a] - lo[a]) / h) + 1) as [number, number, number];
  const FAR = 1e9;
  const d = new Float32Array(n[0] * n[1] * n[2]).fill(FAR);
  const r = Math.ceil(band / h);
  const splat = (px: number, py: number, pz: number, nx: number, ny: number, nz: number) => {
    const ix = Math.round((px - lo[0]) / h);
    const iy = Math.round((py - lo[1]) / h);
    const iz = Math.round((pz - lo[2]) / h);
    for (let z = Math.max(0, iz - r); z <= Math.min(n[2] - 1, iz + r); z++)
      for (let y = Math.max(0, iy - r); y <= Math.min(n[1] - 1, iy + r); y++)
        for (let x = Math.max(0, ix - r); x <= Math.min(n[0] - 1, ix + r); x++) {
          const dx = lo[0] + x * h - px;
          const dy = lo[1] + y * h - py;
          const dz = lo[2] + z * h - pz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > band) continue;
          const k = (z * n[1] + y) * n[0] + x;
          if (dist < Math.abs(d[k])) d[k] = dx * nx + dy * ny + dz * nz >= 0 ? dist : -dist;
        }
  };
  // vertices and triangle centres: about 3-4 mm apart on the subdivided body
  for (let i = 0; i < P.length; i += 3) splat(P[i], P[i + 1], P[i + 2], Nn[i], Nn[i + 1], Nn[i + 2]);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const nx = Nn[a] + Nn[b] + Nn[c], ny = Nn[a + 1] + Nn[b + 1] + Nn[c + 1], nz = Nn[a + 2] + Nn[b + 2] + Nn[c + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    splat((P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3, nx / l, ny / l, nz / l);
  }
  // flood the untouched far field from the outside; whatever is left is inside
  const outside = new Uint8Array(d.length);
  const stack: number[] = [0];
  outside[0] = 1;
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % n[0];
    const y = Math.floor(k / n[0]) % n[1];
    const z = Math.floor(k / (n[0] * n[1]));
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const xx = x + dx, yy = y + dy, zz = z + dz;
      if (xx < 0 || yy < 0 || zz < 0 || xx >= n[0] || yy >= n[1] || zz >= n[2]) continue;
      const kk = (zz * n[1] + yy) * n[0] + xx;
      if (outside[kk] || (d[kk] !== FAR && d[kk] < h)) continue;
      outside[kk] = 1;
      if (d[kk] === FAR) stack.push(kk);
    }
  }
  for (let k = 0; k < d.length; k++) if (d[k] === FAR) d[k] = outside[k] ? band : -band;
  return { min: lo as [number, number, number], h, n, d };
}

export function sampleSDF(s: SDF, x: number, y: number, z: number) {
  const fx = (x - s.min[0]) / s.h, fy = (y - s.min[1]) / s.h, fz = (z - s.min[2]) / s.h;
  if (fx < 0 || fy < 0 || fz < 0 || fx >= s.n[0] - 1 || fy >= s.n[1] - 1 || fz >= s.n[2] - 1) return 1;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
  const tx = fx - x0, ty = fy - y0, tz = fz - z0;
  const nx = s.n[0], nxy = s.n[0] * s.n[1];
  const k = z0 * nxy + y0 * nx + x0;
  const D = s.d;
  const c00 = D[k] * (1 - tx) + D[k + 1] * tx;
  const c10 = D[k + nx] * (1 - tx) + D[k + nx + 1] * tx;
  const c01 = D[k + nxy] * (1 - tx) + D[k + nxy + 1] * tx;
  const c11 = D[k + nxy + nx] * (1 - tx) + D[k + nxy + nx + 1] * tx;
  return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz;
}

/** Push cloth out of her body along the field's gradient. */
export function sdfCollider(s: SDF): Collider {
  const e = s.h * 0.5;
  return (p, i, m) => {
    const k = 3 * i;
    let x = p[k], y = p[k + 1], z = p[k + 2];
    let hit = false;
    for (let it = 0; it < 3; it++) {
      const d = sampleSDF(s, x, y, z);
      if (d >= m) break;
      hit = true;
      let gx = sampleSDF(s, x + e, y, z) - sampleSDF(s, x - e, y, z);
      let gy = sampleSDF(s, x, y + e, z) - sampleSDF(s, x, y - e, z);
      let gz = sampleSDF(s, x, y, z + e) - sampleSDF(s, x, y, z - e);
      const gl = Math.hypot(gx, gy, gz);
      if (gl < 1e-9) break;
      gx /= gl;
      gy /= gl;
      gz /= gl;
      const push = m - d;
      x += gx * push;
      y += gy * push;
      z += gz * push;
    }
    if (hit) {
      p[k] = x;
      p[k + 1] = y;
      p[k + 2] = z;
    }
    return hit;
  };
}
