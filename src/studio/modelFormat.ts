/**
 * The Vibes model file (public/model/{pose}.bin): the posed woman, her blouse
 * and hair, a few landmarks, and a radial profile of her body that the drape
 * builder uses. Written offline by scripts/build-model.ts, read by the browser
 * and by the drape bake.
 *
 * Layout: u32 magic, u32 headerBytes, JSON header (padded to 4), then the
 * arrays the header lists, each 4-byte aligned.
 */

export const MODEL_POSES = ["poised", "ease", "turn"] as const;
export type ModelPoseId = (typeof MODEL_POSES)[number];

type V3 = [number, number, number];

export interface Landmarks {
  neck: V3;
  head: V3;
  chin: V3;
  shoulderL: V3;
  shoulderR: V3;
  elbowL: V3;
  elbowR: V3;
  wristL: V3;
  wristR: V3;
  hipL: V3;
  hipR: V3;
  kneeL: V3;
  kneeR: V3;
  ankleL: V3;
  ankleR: V3;
  spine: V3;
}

/** Max radius of the torso & legs (arms excluded) per height and angle; θ = 0 is front, +π/2 her left. */
export interface BodyProfile {
  y0: number;
  dy: number;
  ny: number;
  nt: number;
  R: Float32Array;
}

export interface MeshData {
  pos: Float32Array | Float64Array;
  normal: Float32Array | Float64Array;
  index: Uint16Array | Uint32Array;
  uv?: Float32Array;
  /** extra per-vertex scalars, e.g. the blouse's arm/hem channels */
  attrs?: Record<string, Float32Array>;
}

export interface ModelData {
  id: ModelPoseId;
  body: MeshData;
  blouse: MeshData;
  hair: MeshData;
  landmarks: Landmarks;
  profile: BodyProfile;
  height: number;
}

const MAGIC = 0x56424d31; // "VBM1"
const Q = 16000;

type Chunk = { name: string; kind: "i16pos" | "i8n" | "u16" | "u32" | "f32"; data: ArrayLike<number> };

function chunks(m: ModelData): { header: Record<string, unknown>; list: Chunk[] } {
  const list: Chunk[] = [];
  const mesh = (key: string, d: MeshData) => {
    list.push({ name: `${key}.pos`, kind: "i16pos", data: d.pos });
    list.push({ name: `${key}.normal`, kind: "i8n", data: d.normal });
    list.push({ name: `${key}.index`, kind: d.pos.length / 3 > 65535 ? "u32" : "u16", data: d.index });
    if (d.uv) list.push({ name: `${key}.uv`, kind: "f32", data: d.uv });
    for (const [a, v] of Object.entries(d.attrs ?? {})) list.push({ name: `${key}.attr.${a}`, kind: "f32", data: v });
  };
  mesh("body", m.body);
  mesh("blouse", m.blouse);
  mesh("hair", m.hair);
  list.push({ name: "profile.R", kind: "f32", data: m.profile.R });
  const header = { id: m.id, height: m.height, landmarks: m.landmarks, profile: { y0: m.profile.y0, dy: m.profile.dy, ny: m.profile.ny, nt: m.profile.nt } };
  return { header, list };
}

const BYTES = { i16pos: 2, i8n: 1, u16: 2, u32: 4, f32: 4 } as const;
const pad4 = (n: number) => (n + 3) & ~3;

export function encodeModel(m: ModelData): ArrayBuffer {
  const { header, list } = chunks(m);
  const desc = list.map((c) => ({ name: c.name, kind: c.kind, length: c.data.length }));
  const json = new TextEncoder().encode(JSON.stringify({ ...header, chunks: desc }));
  const headerBytes = pad4(json.length);
  let size = 8 + headerBytes;
  for (const c of list) size += pad4(c.data.length * BYTES[c.kind]);
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, headerBytes, true);
  new Uint8Array(buf, 8, json.length).set(json);
  let o = 8 + headerBytes;
  for (const c of list) {
    const d = c.data;
    for (let i = 0; i < d.length; i++) {
      if (c.kind === "i16pos") dv.setInt16(o + i * 2, Math.round(d[i] * Q), true);
      else if (c.kind === "i8n") dv.setInt8(o + i, Math.round(Math.max(-1, Math.min(1, d[i])) * 127));
      else if (c.kind === "u16") dv.setUint16(o + i * 2, d[i], true);
      else if (c.kind === "u32") dv.setUint32(o + i * 4, d[i], true);
      else dv.setFloat32(o + i * 4, d[i], true);
    }
    o += pad4(d.length * BYTES[c.kind]);
  }
  return buf;
}

export function decodeModel(buf: ArrayBuffer): ModelData {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error("not a Vibes model file");
  const headerBytes = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, headerBytes)).replace(/\0+$/, ""));
  let o = 8 + headerBytes;
  const got: Record<string, ArrayLike<number>> = {};
  for (const c of header.chunks as { name: string; kind: keyof typeof BYTES; length: number }[]) {
    let arr: Float32Array | Uint16Array | Uint32Array;
    if (c.kind === "i16pos") {
      const s = new Int16Array(buf.slice(o, o + c.length * 2));
      arr = new Float32Array(c.length);
      for (let i = 0; i < c.length; i++) arr[i] = s[i] / Q;
    } else if (c.kind === "i8n") {
      const s = new Int8Array(buf, o, c.length);
      arr = new Float32Array(c.length);
      for (let i = 0; i < c.length; i++) arr[i] = s[i] / 127;
    } else if (c.kind === "u16") arr = new Uint16Array(buf.slice(o, o + c.length * 2));
    else if (c.kind === "u32") arr = new Uint32Array(buf.slice(o, o + c.length * 4));
    else arr = new Float32Array(buf.slice(o, o + c.length * 4));
    got[c.name] = arr;
    o += pad4(c.length * BYTES[c.kind]);
  }
  const mesh = (key: string): MeshData => {
    const attrs: Record<string, Float32Array> = {};
    for (const k of Object.keys(got)) if (k.startsWith(`${key}.attr.`)) attrs[k.slice(key.length + 6)] = got[k] as Float32Array;
    return {
      pos: got[`${key}.pos`] as Float32Array,
      normal: got[`${key}.normal`] as Float32Array,
      index: got[`${key}.index`] as Uint16Array,
      uv: got[`${key}.uv`] as Float32Array | undefined,
      attrs,
    };
  };
  return {
    id: header.id,
    height: header.height,
    landmarks: header.landmarks,
    profile: { ...header.profile, R: got["profile.R"] as Float32Array },
    body: mesh("body"),
    blouse: mesh("blouse"),
    hair: mesh("hair"),
  };
}

/** Profile lookup with bilinear interpolation (θ wraps). */
export function profileR(p: BodyProfile, y: number, theta: number) {
  const fy = Math.min(p.ny - 1.001, Math.max(0, (y - p.y0) / p.dy));
  let ft = ((theta / (Math.PI * 2)) % 1) * p.nt;
  if (ft < 0) ft += p.nt;
  const y0 = Math.floor(fy);
  const t0 = Math.floor(ft) % p.nt;
  const t1 = (t0 + 1) % p.nt;
  const a = fy - y0;
  const b = ft - Math.floor(ft);
  const R = p.R;
  const at = (yy: number, tt: number) => R[yy * p.nt + tt];
  return (at(y0, t0) * (1 - b) + at(y0, t1) * b) * (1 - a) + (at(y0 + 1, t0) * (1 - b) + at(y0 + 1, t1) * b) * a;
}

/** Quads → triangles. */
export function quadsToTris(quads: Uint32Array) {
  const out = new Uint32Array((quads.length / 4) * 6);
  for (let f = 0, o = 0; f < quads.length; f += 4, o += 6) out.set([quads[f], quads[f + 1], quads[f + 2], quads[f], quads[f + 2], quads[f + 3]], o);
  return out;
}
