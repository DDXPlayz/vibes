/**
 * Built from her own surface: a radial body profile for the drape, a tailored
 * blouse, and hair. Everything here is derived geometry — no sculpting by hand.
 */
import type { BodyProfile, Landmarks, MeshData } from "../../src/studio/modelFormat";
import { vertexNormals, type QuadMesh } from "./geometry";

type V3 = [number, number, number];

export function profileOf(m: QuadMesh, _lm: Landmarks): BodyProfile {
  const y0 = 0;
  const dy = 0.01;
  const ny = 190;
  const nt = 96;
  const R = new Float32Array(ny * nt);
  const arm = m.attrs.arm;
  for (let i = 0; i < m.pos.length / 3; i++) {
    if (arm[i] > 0.35) continue;
    const x = m.pos[i * 3];
    const y = m.pos[i * 3 + 1];
    const z = m.pos[i * 3 + 2];
    const yi = Math.round((y - y0) / dy);
    if (yi < 0 || yi >= ny) continue;
    let th = Math.atan2(x, z);
    if (th < 0) th += Math.PI * 2;
    const ti = Math.round((th / (Math.PI * 2)) * nt) % nt;
    R[yi * nt + ti] = Math.max(R[yi * nt + ti], Math.hypot(x, z));
  }
  // fill gaps: take the max of close neighbours, then smooth lightly
  for (let pass = 0; pass < 3; pass++) {
    const src = new Float32Array(R);
    for (let yi = 0; yi < ny; yi++)
      for (let ti = 0; ti < nt; ti++) {
        if (src[yi * nt + ti] > 0) continue;
        let best = 0;
        for (let a = -1; a <= 1; a++)
          for (let b = -2; b <= 2; b++) {
            const yy = yi + a;
            if (yy < 0 || yy >= ny) continue;
            best = Math.max(best, src[yy * nt + ((ti + b + nt) % nt)]);
          }
        R[yi * nt + ti] = best;
      }
  }
  const S = new Float32Array(R);
  for (let yi = 0; yi < ny; yi++)
    for (let ti = 0; ti < nt; ti++) {
      let s = 0;
      let n = 0;
      for (let b = -1; b <= 1; b++) {
        const v = R[yi * nt + ((ti + b + nt) % nt)];
        if (v > 0) {
          s += v;
          n++;
        }
      }
      S[yi * nt + ti] = n ? s / n : 0;
    }
  return { y0, dy, ny, nt, R: S };
}

function neighbours(quads: Uint32Array, n: number) {
  const nb: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (let f = 0; f < quads.length; f += 4)
    for (let c = 0; c < 4; c++) {
      const a = quads[f + c];
      const b = quads[f + ((c + 1) % 4)];
      nb[a].add(b);
      nb[b].add(a);
    }
  return nb;
}

/**
 * Cut a garment out of the body along the zero contour of `field` (> 0 inside).
 * Faces with any inside corner are kept; each outside corner slides along its
 * edges to where the field crosses zero, so the edge is a smooth line rather
 * than a staircase of faces.
 */
function extract(m: QuadMesh, field: (i: number) => number) {
  const f = new Float64Array(m.pos.length / 3);
  for (let i = 0; i < f.length; i++) f[i] = field(i);
  const remap = new Map<number, number>();
  const quads: number[] = [];
  const inNbrs = new Map<number, Set<number>>();
  for (let q = 0; q < m.quads.length; q += 4) {
    const c = [m.quads[q], m.quads[q + 1], m.quads[q + 2], m.quads[q + 3]];
    const inside = c.filter((i) => f[i] > 0).length;
    if (inside < 2) continue;
    for (const i of c) if (!remap.has(i)) remap.set(i, remap.size);
    quads.push(...c.map((i) => remap.get(i)!));
    for (let k = 0; k < 4; k++) {
      const a = c[k];
      if (f[a] > 0) continue;
      for (const b of [c[(k + 1) % 4], c[(k + 3) % 4]])
        if (f[b] > 0) {
          if (!inNbrs.has(a)) inNbrs.set(a, new Set());
          inNbrs.get(a)!.add(b);
        }
    }
  }
  const src = [...remap.keys()];
  const moved = new Float64Array(m.pos.length);
  moved.set(m.pos);
  for (const [a, set] of inNbrs) {
    const acc = [0, 0, 0];
    for (const b of set) {
      const t = f[a] / (f[a] - f[b]);
      for (let k = 0; k < 3; k++) acc[k] += m.pos[a * 3 + k] + (m.pos[b * 3 + k] - m.pos[a * 3 + k]) * t;
    }
    for (let k = 0; k < 3; k++) moved[a * 3 + k] = acc[k] / set.size;
  }
  return { src, quads: Uint32Array.from(quads), pos: moved };
}

/** Rings of distance (in edges) from the open boundary of a quad mesh. */
function edgeDistance(quads: Uint32Array, n: number) {
  const count = new Map<string, number>();
  for (let f = 0; f < quads.length; f += 4)
    for (let c = 0; c < 4; c++) {
      const a = quads[f + c];
      const b = quads[f + ((c + 1) % 4)];
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  const d = new Float32Array(n).fill(99);
  let frontier: number[] = [];
  for (const [k, c] of count)
    if (c === 1)
      for (const i of k.split(",").map(Number)) {
        if (d[i] !== 0) frontier.push(i);
        d[i] = 0;
      }
  const nb = neighbours(quads, n);
  for (let r = 1; r < 8 && frontier.length; r++) {
    const next: number[] = [];
    for (const i of frontier)
      for (const j of nb[i])
        if (d[j] > r) {
          d[j] = r;
          next.push(j);
        }
    frontier = next;
  }
  return d;
}

/** Offset along the normal, then smooth outward-only so cloth bridges hollows instead of dipping into them. */
function shell(base: Float64Array, normals: Float64Array, src: number[], quads: Uint32Array, offset: (i: number) => number, iterations: number) {
  const n = src.length;
  const pos = new Float64Array(n * 3);
  const nrm = new Float64Array(n * 3);
  src.forEach((i, k) => {
    const o = offset(i);
    for (let a = 0; a < 3; a++) {
      nrm[k * 3 + a] = normals[i * 3 + a];
      pos[k * 3 + a] = base[i * 3 + a] + normals[i * 3 + a] * o;
    }
  });
  const nb = neighbours(quads, n);
  for (let it = 0; it < iterations; it++) {
    const prev = new Float64Array(pos);
    for (let k = 0; k < n; k++) {
      if (!nb[k].size) continue;
      const avg = [0, 0, 0];
      for (const j of nb[k]) for (let a = 0; a < 3; a++) avg[a] += prev[j * 3 + a] / nb[k].size;
      const d = [avg[0] - prev[k * 3], avg[1] - prev[k * 3 + 1], avg[2] - prev[k * 3 + 2]];
      const out = d[0] * nrm[k * 3] + d[1] * nrm[k * 3 + 1] + d[2] * nrm[k * 3 + 2];
      if (out > 0) for (let a = 0; a < 3; a++) pos[k * 3 + a] += d[a] * 0.7;
    }
  }
  return pos;
}

/** Smooth only the open edges, along themselves: necklines and hems become clean tailored curves. */
function smoothBoundary(pos: Float64Array, quads: Uint32Array, iterations: number) {
  const count = new Map<string, number>();
  for (let f = 0; f < quads.length; f += 4)
    for (let c = 0; c < 4; c++) {
      const a = quads[f + c];
      const b = quads[f + ((c + 1) % 4)];
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
  const nb = new Map<number, number[]>();
  for (const [k, c] of count) {
    if (c !== 1) continue;
    const [a, b] = k.split(",").map(Number);
    nb.set(a, [...(nb.get(a) ?? []), b]);
    nb.set(b, [...(nb.get(b) ?? []), a]);
  }
  for (let it = 0; it < iterations; it++) {
    const prev = new Float64Array(pos);
    for (const [v, list] of nb) {
      if (list.length !== 2) continue;
      for (let a = 0; a < 3; a++) pos[v * 3 + a] = prev[v * 3 + a] * 0.5 + ((prev[list[0] * 3 + a] + prev[list[1] * 3 + a]) / 2) * 0.5;
    }
  }
}

const tris = (quads: Uint32Array) => {
  const out = new Uint32Array((quads.length / 4) * 6);
  for (let f = 0, o = 0; f < quads.length; f += 4, o += 6) out.set([quads[f], quads[f + 1], quads[f + 2], quads[f], quads[f + 2], quads[f + 3]], o);
  return out;
};

/**
 * A cropped choli: fitted, ending just under the bust, with a scooped front
 * neckline, a deeper back, and sleeves that stop above the elbow.
 */
export function buildBlouse(m: QuadMesh, normals: Float64Array, lm: Landmarks, profile: BodyProfile): MeshData {
  const { arm, head } = m.attrs;
  // bust height: the fullest point of the front profile between ribs and collarbone
  let bustY = 1.25;
  let bestR = 0;
  for (let yi = Math.round(1.05 / profile.dy); yi < Math.round(1.45 / profile.dy); yi++) {
    const t = Math.round((0.32 / (Math.PI * 2)) * profile.nt);
    const r = profile.R[yi * profile.nt + t];
    if (r > bestR) {
      bestR = r;
      bustY = yi * profile.dy;
    }
  }
  const hemY = bustY - 0.075;
  const N = lm.neck;
  const sleeve = (i: number): number => {
    const x = m.pos[i * 3];
    const sh = x > 0 ? lm.shoulderL : lm.shoulderR;
    const el = x > 0 ? lm.elbowL : lm.elbowR;
    const dir = [el[0] - sh[0], el[1] - sh[1], el[2] - sh[2]];
    const L = Math.hypot(dir[0], dir[1], dir[2]);
    const t = ((m.pos[i * 3] - sh[0]) * dir[0] + (m.pos[i * 3 + 1] - sh[1]) * dir[1] + (m.pos[i * 3 + 2] - sh[2]) * dir[2]) / L;
    return L * 0.6 - t;
  };
  // signed distance-like field: > 0 inside the blouse
  const field = (i: number) => {
    const x = m.pos[i * 3];
    const y = m.pos[i * 3 + 1];
    const z = m.pos[i * 3 + 2];
    const c = Math.cos(Math.atan2(x - N[0], z - N[2]));
    const top = N[1] - (0.02 + 0.095 * Math.max(0, c) ** 1.2 + 0.125 * Math.max(0, -c) ** 2);
    let v = Math.min(top - y, y - hemY, 0.3 - head[i] * 0.3);
    // sleeves: blend into the arm-length cut where the arm takes over
    const w = Math.min(1, Math.max(0, (arm[i] - 0.35) / 0.3));
    if (w > 0) v = v * (1 - w) + Math.min(sleeve(i), y - hemY + 0.2) * w;
    return v;
  };
  const { src, quads, pos: cut } = extract(m, field);
  const pos = shell(cut, normals, src, quads, (i) => 0.0032 + 0.0015 * Math.min(1, arm[i]), 14);
  smoothBoundary(pos, quads, 10);
  const normal = vertexNormals(pos, quads);
  return {
    pos,
    normal,
    index: tris(quads),
    attrs: { arm: Float32Array.from(src.map((i) => arm[i])), edge: edgeDistance(quads, src.length) },
  };
}

/** Sleek hair drawn back into a low chignon at the nape. */
export function buildHair(m: QuadMesh, normals: Float64Array, lm: Landmarks): MeshData {
  const { head } = m.attrs;
  let topY = 0;
  for (let i = 1; i < m.pos.length; i += 3) topY = Math.max(topY, m.pos[i]);
  // head centre: the average of strongly head-weighted vertices above the jaw
  const c: V3 = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < m.pos.length / 3; i++)
    if (head[i] > 0.9 && m.pos[i * 3 + 1] > lm.chin[1] + 0.06) {
      for (let a = 0; a < 3; a++) c[a] += m.pos[i * 3 + a];
      n++;
    }
  for (let a = 0; a < 3; a++) c[a] /= n || 1;
  const field = (i: number) => {
    const x = m.pos[i * 3] - c[0];
    const y = m.pos[i * 3 + 1];
    const z = m.pos[i * 3 + 2] - c[2];
    const back = (1 - Math.cos(Math.atan2(x, z))) / 2; // 0 front … 1 back
    // a soft, slightly irregular hairline: higher at the temples, low at the nape
    const temple = Math.sin(Math.atan2(x, z)) ** 2 * (1 - back);
    const hairline = topY - (0.06 + 0.075 * back + 0.07 * back * back - 0.012 * temple);
    return Math.min(y - hairline, (head[i] - 0.6) * 0.2);
  };
  const { src, quads, pos: cut } = extract(m, field);
  // more volume at the crown, lying flat at the hairline
  const pos = shell(cut, normals, src, quads, (i) => 0.004 + 0.008 * Math.min(1, Math.max(0, (m.pos[i * 3 + 1] - (topY - 0.12)) / 0.12)), 10);
  const uv = new Float32Array(src.length * 2);
  for (let k = 0; k < src.length; k++) {
    uv[k * 2] = (Math.atan2(pos[k * 3] - c[0], pos[k * 3 + 2] - c[2]) / (Math.PI * 2) + 1) % 1;
    uv[k * 2 + 1] = pos[k * 3 + 1] * 4;
  }
  // the chignon: a soft ellipsoid at the nape
  const back: V3 = [c[0], topY - 0.17, c[2] - 0.085];
  const rad: V3 = [0.052, 0.04, 0.034];
  const LAT = 18;
  const LON = 32;
  const bunPos: number[] = [];
  const bunUv: number[] = [];
  const bunIdx: number[] = [];
  for (let a = 0; a <= LAT; a++)
    for (let b = 0; b <= LON; b++) {
      const th = (a / LAT) * Math.PI;
      const ph = (b / LON) * Math.PI * 2;
      // a slight twist of the coil
      const tw = 1 + 0.06 * Math.sin(ph * 3 + th * 2);
      bunPos.push(back[0] + Math.sin(th) * Math.cos(ph) * rad[0] * tw, back[1] + Math.cos(th) * rad[1] * tw, back[2] - Math.sin(th) * Math.sin(ph) * rad[2] * tw);
      bunUv.push(b / LON + a * 0.04, a / LAT);
    }
  const base = src.length;
  for (let a = 0; a < LAT; a++)
    for (let b = 0; b < LON; b++) {
      const i = base + a * (LON + 1) + b;
      bunIdx.push(i, i + LON + 1, i + 1, i + 1, i + LON + 1, i + LON + 2);
    }
  const allPos = new Float64Array([...pos, ...bunPos]);
  const allUv = new Float32Array([...uv, ...bunUv]);
  const allIdx = new Uint32Array([...tris(quads), ...bunIdx]);
  // normals: shell from the surface, bun analytically from its centre
  const nrm = new Float64Array(allPos.length);
  nrm.set(vertexNormals(pos, quads));
  for (let k = base; k < allPos.length / 3; k++) {
    const d = [(allPos[k * 3] - back[0]) / rad[0], (allPos[k * 3 + 1] - back[1]) / rad[1], (allPos[k * 3 + 2] - back[2]) / rad[2]];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    nrm.set([d[0] / l, d[1] / l, d[2] / l], k * 3);
  }
  return { pos: allPos, normal: nrm, index: allIdx, uv: allUv };
}
