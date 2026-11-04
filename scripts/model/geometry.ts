/** Mesh utilities for the offline model build: Catmull–Clark subdivision and normals. */

export interface QuadMesh {
  pos: Float64Array; // xyz
  quads: Uint32Array; // 4 indices per face
  /** per-vertex scalar channels carried through subdivision (e.g. skin weights per region) */
  attrs: Record<string, Float64Array>;
}

const ekey = (a: number, b: number) => (a < b ? a * 4194304 + b : b * 4194304 + a);

/** One level of Catmull–Clark subdivision (quads in, quads out; boundaries kept crisp-but-smooth). */
export function subdivide(m: QuadMesh): QuadMesh {
  const nV = m.pos.length / 3;
  const nF = m.quads.length / 4;
  const edges = new Map<number, { a: number; b: number; f: number[]; id: number }>();
  const edgeList: { a: number; b: number; f: number[]; id: number }[] = [];
  for (let f = 0; f < nF; f++)
    for (let c = 0; c < 4; c++) {
      const a = m.quads[f * 4 + c];
      const b = m.quads[f * 4 + ((c + 1) % 4)];
      const k = ekey(a, b);
      let e = edges.get(k);
      if (!e) {
        e = { a, b, f: [], id: edgeList.length };
        edges.set(k, e);
        edgeList.push(e);
      }
      e.f.push(f);
    }
  const nE = edgeList.length;
  const total = nV + nE + nF;
  const out = new Float64Array(total * 3);
  const chans = Object.keys(m.attrs);
  const attrs: Record<string, Float64Array> = Object.fromEntries(chans.map((c) => [c, new Float64Array(total)]));
  // face points: [nV + nE + f]
  const facePt = (f: number) => nV + nE + f;
  for (let f = 0; f < nF; f++) {
    const o = facePt(f) * 3;
    for (let c = 0; c < 4; c++) {
      const v = m.quads[f * 4 + c];
      for (let a = 0; a < 3; a++) out[o + a] += m.pos[v * 3 + a] / 4;
      for (const ch of chans) attrs[ch][facePt(f)] += m.attrs[ch][v] / 4;
    }
  }
  // edge points: [nV + e]
  const boundaryNbrs: number[][] = Array.from({ length: nV }, () => []);
  for (const e of edgeList) {
    const o = (nV + e.id) * 3;
    for (const ch of chans) attrs[ch][nV + e.id] = (m.attrs[ch][e.a] + m.attrs[ch][e.b]) / 2;
    if (e.f.length === 2) {
      for (let a = 0; a < 3; a++) out[o + a] = (m.pos[e.a * 3 + a] + m.pos[e.b * 3 + a] + out[facePt(e.f[0]) * 3 + a] + out[facePt(e.f[1]) * 3 + a]) / 4;
    } else {
      for (let a = 0; a < 3; a++) out[o + a] = (m.pos[e.a * 3 + a] + m.pos[e.b * 3 + a]) / 2;
      boundaryNbrs[e.a].push(e.b);
      boundaryNbrs[e.b].push(e.a);
    }
  }
  // vertex points
  const fSum = new Float64Array(nV * 3);
  const fCnt = new Uint32Array(nV);
  for (let f = 0; f < nF; f++)
    for (let c = 0; c < 4; c++) {
      const v = m.quads[f * 4 + c];
      for (let a = 0; a < 3; a++) fSum[v * 3 + a] += out[facePt(f) * 3 + a];
      fCnt[v]++;
    }
  const rSum = new Float64Array(nV * 3);
  const rCnt = new Uint32Array(nV);
  for (const e of edgeList)
    for (const v of [e.a, e.b]) {
      for (let a = 0; a < 3; a++) rSum[v * 3 + a] += (m.pos[e.a * 3 + a] + m.pos[e.b * 3 + a]) / 2;
      rCnt[v]++;
    }
  for (let v = 0; v < nV; v++) {
    for (const ch of chans) attrs[ch][v] = m.attrs[ch][v];
    const o = v * 3;
    if (boundaryNbrs[v].length >= 2) {
      const [p, q] = boundaryNbrs[v];
      for (let a = 0; a < 3; a++) out[o + a] = (6 * m.pos[o + a] + m.pos[p * 3 + a] + m.pos[q * 3 + a]) / 8;
      continue;
    }
    const n = fCnt[v];
    if (!n) {
      for (let a = 0; a < 3; a++) out[o + a] = m.pos[o + a];
      continue;
    }
    for (let a = 0; a < 3; a++) out[o + a] = (fSum[o + a] / n + (2 * rSum[o + a]) / rCnt[v] + (n - 3) * m.pos[o + a]) / n;
  }
  const quads = new Uint32Array(nF * 16);
  const edgeId = (a: number, b: number) => nV + edges.get(ekey(a, b))!.id;
  for (let f = 0; f < nF; f++) {
    const q = [0, 1, 2, 3].map((c) => m.quads[f * 4 + c]);
    for (let c = 0; c < 4; c++) {
      const prev = q[(c + 3) % 4];
      const cur = q[c];
      const next = q[(c + 1) % 4];
      quads.set([cur, edgeId(cur, next), facePt(f), edgeId(prev, cur)], (f * 4 + c) * 4);
    }
  }
  return { pos: out, quads, attrs };
}

export function vertexNormals(pos: Float64Array, quads: Uint32Array) {
  const n = new Float64Array(pos.length);
  const tri = (a: number, b: number, c: number) => {
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      n[i * 3] += nx;
      n[i * 3 + 1] += ny;
      n[i * 3 + 2] += nz;
    }
  };
  for (let f = 0; f < quads.length; f += 4) {
    tri(quads[f], quads[f + 1], quads[f + 2]);
    tri(quads[f], quads[f + 2], quads[f + 3]);
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  return n;
}

/** Laplacian smoothing of a scalar channel over the mesh (for soft region masks). */
export function smoothChannel(values: Float64Array, quads: Uint32Array, iterations: number) {
  const nV = values.length;
  const nb: Set<number>[] = Array.from({ length: nV }, () => new Set());
  for (let f = 0; f < quads.length; f += 4)
    for (let c = 0; c < 4; c++) {
      const a = quads[f + c];
      const b = quads[f + ((c + 1) % 4)];
      nb[a].add(b);
      nb[b].add(a);
    }
  let cur = values;
  for (let it = 0; it < iterations; it++) {
    const next = new Float64Array(nV);
    for (let v = 0; v < nV; v++) {
      let s = cur[v];
      for (const u of nb[v]) s += cur[u];
      next[v] = s / (nb[v].size + 1);
    }
    cur = next;
  }
  return cur;
}
