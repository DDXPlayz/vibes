"use client";

import type { TextileAnalysis, TextileSpec } from "@/lib/types";
import { generateTextile, zariScore } from "./textile";

/**
 * Textile processing — runs in the browser the moment a photo is dropped.
 *
 *   photo → find the cloth (background separation) → crop → orient
 *         → find borders & pallu → measure colour, zari, pattern
 *
 * Every step is a measurement, not an edit: the processed scan is only
 * cropped, rotated and (if the pallu was photographed on the left)
 * mirrored so the pallu sits at the end. Colours are never altered, and the
 * untouched original is uploaded alongside it.
 */

export interface ScanAdjust {
  rotate: 0 | 90 | 180 | 270;
  flip: boolean;
  borderRatio?: number;
  palluStart?: number;
}

export interface ScanResult {
  processed: HTMLCanvasElement;
  analysis: TextileAnalysis;
  autoAdjust: ScanAdjust;
  timings: { step: string; ms: number }[];
}

const NAMED: [string, [number, number, number]][] = [
  ["ivory", [236, 230, 214]],
  ["white", [245, 245, 242]],
  ["beige", [205, 184, 148]],
  ["sand", [217, 192, 143]],
  ["gold", [201, 163, 86]],
  ["mustard", [200, 145, 30]],
  ["orange", [214, 110, 40]],
  ["coral", [232, 110, 90]],
  ["red", [170, 30, 35]],
  ["crimson", [142, 28, 37]],
  ["maroon", [92, 20, 36]],
  ["rose", [231, 185, 181]],
  ["pink", [220, 120, 150]],
  ["magenta", [163, 23, 90]],
  ["purple", [90, 40, 100]],
  ["aubergine", [58, 29, 63]],
  ["lilac", [190, 170, 210]],
  ["indigo", [31, 47, 92]],
  ["blue", [50, 90, 160]],
  ["teal", [20, 110, 110]],
  ["green", [40, 120, 70]],
  ["emerald", [15, 90, 74]],
  ["mint", [185, 210, 195]],
  ["olive", [110, 110, 50]],
  ["brown", [110, 70, 40]],
  ["grey", [140, 138, 133]],
  ["black", [24, 22, 22]],
];

export function nameColour(r: number, g: number, b: number) {
  let best = NAMED[0][0];
  let d = Infinity;
  for (const [n, [R, G, B]] of NAMED) {
    // weighted RGB distance (cheap perceptual approximation)
    const rm = (r + R) / 2;
    const dd = (2 + rm / 256) * (r - R) ** 2 + 4 * (g - G) ** 2 + (2 + (255 - rm) / 256) * (b - B) ** 2;
    if (dd < d) {
      d = dd;
      best = n;
    }
  }
  return best;
}

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

export function loadImageFile(file: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("That file could not be read as an image."));
    img.src = url;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Step 1: separate the cloth from the table/background. Returns crop in source pixels. */
function findCloth(img: CanvasImageSource & { width: number; height: number }) {
  const S = 360;
  const k = S / Math.max(img.width, img.height);
  const w = Math.max(8, Math.round(img.width * k));
  const h = Math.max(8, Math.round(img.height * k));
  const c = canvas(w, h);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  // background = the frame of the photograph
  const frame: number[][] = [];
  const m = Math.max(2, Math.round(Math.min(w, h) * 0.025));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (x < m || y < m || x >= w - m || y >= h - m) {
        const i = (y * w + x) * 4;
        frame.push([d[i], d[i + 1], d[i + 2]]);
      }
    }
  const med = [0, 1, 2].map((ch) => frame.map((p) => p[ch]).sort((a, b) => a - b)[frame.length >> 1]);
  const spread = Math.sqrt(frame.reduce((s, p) => s + (p[0] - med[0]) ** 2 + (p[1] - med[1]) ** 2 + (p[2] - med[2]) ** 2, 0) / frame.length);
  const thr = Math.max(30, spread * 2.4);
  const isCloth = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return Math.hypot(d[i] - med[0], d[i + 1] - med[1], d[i + 2] - med[2]) > thr;
  };
  const rows: number[] = [];
  const cols: number[] = new Array(w).fill(0);
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++)
      if (isCloth(x, y)) {
        n++;
        cols[x]++;
      }
    rows.push(n / w);
  }
  const colF = cols.map((n) => n / h);
  const span = (arr: number[]) => {
    const peak = Math.max(...arr);
    const t = peak * 0.45;
    let a = arr.findIndex((v) => v > t);
    let b = arr.length - 1 - [...arr].reverse().findIndex((v) => v > t);
    if (a < 0) [a, b] = [0, arr.length - 1];
    return [a, b];
  };
  const [y0, y1] = span(rows);
  const [x0, x1] = span(colF);
  const found = (x1 - x0) / w < 0.97 || (y1 - y0) / h < 0.97;
  // inset slightly so the selvedge shadow is not included
  const inset = 0.006;
  const cx0 = found ? x0 / w + inset : 0;
  const cy0 = found ? y0 / h + inset : 0;
  const cx1 = found ? (x1 + 1) / w - inset : 1;
  const cy1 = found ? (y1 + 1) / h - inset : 1;
  return { x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0, background: hex(med[0], med[1], med[2]), found };
}

/** Draw the crop, rotated/flipped, into a canvas no wider than maxW. */
export function orientCrop(img: CanvasImageSource & { width: number; height: number }, crop: { x: number; y: number; w: number; h: number }, adj: Pick<ScanAdjust, "rotate" | "flip">, maxW = 4096) {
  const sw = crop.w * img.width;
  const sh = crop.h * img.height;
  const rot = adj.rotate % 180 !== 0;
  let ow = rot ? sh : sw;
  let oh = rot ? sw : sh;
  const k = Math.min(1, maxW / ow);
  ow = Math.round(ow * k);
  oh = Math.round(oh * k);
  const c = canvas(ow, oh);
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.translate(ow / 2, oh / 2);
  if (adj.flip) g.scale(-1, 1);
  g.rotate((adj.rotate * Math.PI) / 180);
  const dw = sw * k;
  const dh = sh * k;
  g.drawImage(img, crop.x * img.width, crop.y * img.height, sw, sh, -dw / 2, -dh / 2, dw, dh);
  return c;
}

/** Measurements on an oriented textile (length horizontal). */
function measure(c: HTMLCanvasElement) {
  const W = 480;
  const H = Math.max(40, Math.round((W * c.height) / c.width));
  const s = canvas(W, H);
  const g = s.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(c, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const px = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return [d[i], d[i + 1], d[i + 2]];
  };
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  // row profile (across the width) over the body region (first 60% of length)
  const rowMean: number[][] = [];
  for (let y = 0; y < H; y++) {
    const acc = [0, 0, 0];
    let n = 0;
    for (let x = Math.round(W * 0.05); x < W * 0.6; x += 2) {
      const p = px(x, y);
      acc[0] += p[0];
      acc[1] += p[1];
      acc[2] += p[2];
      n++;
    }
    rowMean.push(acc.map((v) => v / n));
  }
  const bodyRow = rowMean.slice(Math.round(H * 0.4), Math.round(H * 0.6));
  const bodyRef = [0, 1, 2].map((ch) => bodyRow.reduce((s2, r) => s2 + r[ch], 0) / bodyRow.length);
  const rowD = rowMean.map((r) => dist(r, bodyRef));
  const rowMax = Math.max(...rowD, 1);
  const borderFrom = (order: number[]) => {
    let i = 0;
    for (; i < order.length * 0.3; i++) if (rowD[order[i]] < rowMax * 0.32 && rowD[order[i]] < 40) break;
    return i;
  };
  const top = borderFrom([...Array(H).keys()]);
  const bottom = borderFrom([...Array(H).keys()].reverse());
  const borderRatio = Math.min(0.25, (top + bottom) / 2 / H);

  // column profile (along the length) — the pallu looks different from the body
  const colFeat: number[] = [];
  const bodyCols: number[][] = [];
  const colMean: number[][] = [];
  for (let x = 0; x < W; x++) {
    const acc = [0, 0, 0];
    let n = 0;
    for (let y = Math.round(H * 0.3); y < H * 0.7; y += 2) {
      const p = px(x, y);
      acc[0] += p[0];
      acc[1] += p[1];
      acc[2] += p[2];
      n++;
    }
    colMean.push(acc.map((v) => v / n));
  }
  for (let x = Math.round(W * 0.3); x < W * 0.6; x++) bodyCols.push(colMean[x]);
  const bodyColRef = [0, 1, 2].map((ch) => bodyCols.reduce((s2, r) => s2 + r[ch], 0) / bodyCols.length);
  for (let x = 0; x < W; x++) colFeat.push(dist(colMean[x], bodyColRef));
  // smooth
  const sm = colFeat.map((_, i) => {
    let s2 = 0;
    let n = 0;
    for (let k = -6; k <= 6; k++) {
      const j = i + k;
      if (j >= 0 && j < W) {
        s2 += colFeat[j];
        n++;
      }
    }
    return s2 / n;
  });
  const avg = (a: number, b: number) => sm.slice(a, b).reduce((s2, v) => s2 + v, 0) / Math.max(1, b - a);
  const leftScore = avg(0, Math.round(W * 0.15));
  const rightScore = avg(Math.round(W * 0.85), W);
  const palluSide: "start" | "end" = leftScore > rightScore * 1.15 ? "start" : "end";
  // walk from the end toward the middle until the profile looks like the body again
  const bodyLevel = avg(Math.round(W * 0.3), Math.round(W * 0.6));
  const thr = bodyLevel + (Math.max(leftScore, rightScore) - bodyLevel) * 0.35;
  let palluStart = 0.8;
  if (Math.max(leftScore, rightScore) > bodyLevel * 1.6 + 6) {
    if (palluSide === "end") {
      let x = W - 1;
      while (x > W * 0.5 && sm[x] > thr) x--;
      palluStart = x / W;
    } else {
      let x = 0;
      while (x < W * 0.5 && sm[x] > thr) x++;
      palluStart = 1 - x / W;
    }
  }
  palluStart = Math.min(0.92, Math.max(0.6, palluStart));

  // dominant colours: k-means on a sample
  const sample: number[][] = [];
  for (let i = 0; i < 4000; i++) {
    const x = Math.floor(Math.random() * W);
    const y = Math.floor(Math.random() * H);
    sample.push(px(x, y));
  }
  const K = 5;
  let cents = sample.filter((_, i) => i % Math.floor(sample.length / K) === 0).slice(0, K).map((p) => [...p]);
  let assign = new Array(sample.length).fill(0);
  for (let it = 0; it < 10; it++) {
    assign = sample.map((p) => {
      let bi = 0;
      let bd = Infinity;
      cents.forEach((c2, ci) => {
        const dd = dist(p, c2);
        if (dd < bd) {
          bd = dd;
          bi = ci;
        }
      });
      return bi;
    });
    cents = cents.map((c2, ci) => {
      const mem = sample.filter((_, i) => assign[i] === ci);
      if (!mem.length) return c2;
      return [0, 1, 2].map((ch) => mem.reduce((s2, p) => s2 + p[ch], 0) / mem.length);
    });
  }
  const shares = cents.map((_, ci) => assign.filter((a) => a === ci).length / sample.length);
  const merged: { hex: string; share: number; name: string }[] = [];
  cents
    .map((c2, i) => ({ c: c2, share: shares[i] }))
    .sort((a, b) => b.share - a.share)
    .forEach(({ c: c2, share }) => {
      const name = nameColour(c2[0], c2[1], c2[2]);
      const ex = merged.find((m) => m.name === name);
      if (ex) ex.share += share;
      else if (share > 0.02) merged.push({ hex: hex(c2[0], c2[1], c2[2]), share, name });
    });

  // zari coverage
  let z = 0;
  for (let i = 0; i < d.length; i += 16) z += zariScore(d[i], d[i + 1], d[i + 2]);
  const zariCoverage = z / (d.length / 16);

  // pattern: directional texture energy in the body field
  let ex = 0;
  let ey = 0;
  let n = 0;
  const y0 = Math.round(H * (borderRatio + 0.05));
  const y1 = Math.round(H * (1 - borderRatio - 0.05));
  for (let y = y0; y < y1 - 1; y++)
    for (let x = Math.round(W * 0.05); x < W * 0.6; x++) {
      const a = px(x, y);
      ex += dist(a, px(x + 1, y));
      ey += dist(a, px(x, y + 1));
      n++;
    }
  ex /= Math.max(1, n);
  ey /= Math.max(1, n);
  const energy = (ex + ey) / 2;
  let pattern: TextileAnalysis["pattern"] = "plain";
  let conf = 0.6;
  if (energy < 6) {
    pattern = "plain";
    conf = 0.8;
  } else if (ey > ex * 1.8) {
    pattern = "stripes";
    conf = Math.min(0.9, 0.5 + (ey / ex - 1.8) * 0.2);
  } else if (ex > ey * 1.8) {
    pattern = "ikat";
    conf = 0.5;
  } else if (energy > 22) {
    pattern = "dense-motif";
    conf = 0.65;
  } else if (energy > 12 && Math.abs(ex - ey) / energy < 0.15) {
    pattern = "checks";
    conf = 0.45;
  } else {
    pattern = "sparse-buti";
    conf = 0.6;
  }
  return { borderRatio, palluStart, palluSide, dominantColours: merged.slice(0, 5), zariCoverage, pattern, patternConfidence: conf };
}

/** The whole pipeline. `adjust` lets the admin override any detection. */
export async function processScan(img: HTMLImageElement | HTMLCanvasElement, adjust?: Partial<ScanAdjust>): Promise<ScanResult> {
  const timings: { step: string; ms: number }[] = [];
  let t = performance.now();
  const tick = (step: string) => {
    const now = performance.now();
    timings.push({ step, ms: Math.round(now - t) });
    t = now;
  };
  const cloth = findCloth(img);
  tick("Find the cloth");
  // the length of a saree is always the long side
  const tall = cloth.h * img.height > cloth.w * img.width;
  let rotate: ScanAdjust["rotate"] = adjust?.rotate ?? (tall ? 270 : 0);
  let oriented = orientCrop(img, cloth, { rotate, flip: false }, 1200);
  tick("Orient");
  let m = measure(oriented);
  let flip = adjust?.flip ?? m.palluSide === "start";
  if (adjust?.rotate === undefined && flip && !adjust?.flip) {
    // pallu on the left → rotate the other way rather than mirror the cloth
    rotate = ((rotate + 180) % 360) as ScanAdjust["rotate"];
    flip = false;
    oriented = orientCrop(img, cloth, { rotate, flip }, 1200);
    m = measure(oriented);
  }
  tick("Find borders & pallu");
  const processed = orientCrop(img, cloth, { rotate, flip }, 4096);
  tick("Prepare texture");
  const aspect = processed.width / processed.height;
  const widthM = 1.15;
  const analysis: TextileAnalysis = {
    dominantColours: m.dominantColours,
    borderRatio: adjust?.borderRatio ?? m.borderRatio,
    palluStart: adjust?.palluStart ?? m.palluStart,
    palluSide: "end",
    zariCoverage: m.zariCoverage,
    pattern: m.pattern,
    patternConfidence: m.patternConfidence,
    aspect,
    estimatedLengthM: Math.round(aspect * widthM * 10) / 10,
    estimatedWidthM: widthM,
    crop: { x: cloth.x, y: cloth.y, w: cloth.w, h: cloth.h },
  };
  return { processed, analysis, autoAdjust: { rotate, flip }, timings };
}

export function canvasToBlob(c: HTMLCanvasElement, type = "image/jpeg", q = 0.92): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), type, q));
}

/* ───────────── demo: a "phone photo" of a saree on the cutting table ───────────── */

const SAMPLE_SPECS: TextileSpec[] = [
  {
    base: "#6b1b2a",
    border: { color: "#c9a35a", style: "temple", width: 0.12, zari: true, accent: "#3f0f18" },
    motif: { kind: "buti", color: "#c9a35a", zari: true, scale: 0.8, density: 0.45 },
    pallu: { kind: "dense-buti", color: "#c9a35a", zari: true, start: 0.8 },
    blouse: "#c9a35a",
    sheen: 0.85,
    sheer: 0,
  },
  {
    base: "#203a5c",
    border: { color: "#d9c9a3", style: "ikat", width: 0.1, zari: false, accent: "#b84a2e" },
    motif: { kind: "ikat-diamond", color: "#d9c9a3", zari: false, scale: 0.9, density: 0.55 },
    pallu: { kind: "ikat-grid", color: "#b84a2e", zari: false, start: 0.79 },
    blouse: "#b84a2e",
    sheen: 0.4,
    sheer: 0,
  },
  {
    base: "#e9e2d0",
    border: { color: "#2f5d50", style: "stripes", width: 0.09, zari: false, accent: "#e9e2d0" },
    motif: { kind: "jamdani", color: "#2f5d50", zari: false, scale: 1, density: 0.4 },
    pallu: { kind: "stripes", color: "#2f5d50", zari: false, start: 0.82 },
    blouse: "#2f5d50",
    sheen: 0.12,
    sheer: 0.3,
  },
];

/** Builds a realistic test photograph: textile on a table, at an angle, pallu toward the camera. */
export function samplePhoto(i = Math.floor(Math.random() * SAMPLE_SPECS.length)) {
  const spec = SAMPLE_SPECS[i % SAMPLE_SPECS.length];
  const t = generateTextile(`sample-${i}`, spec, 2400);
  const W = 1500;
  const H = 2600;
  const c = canvas(W, H);
  const g = c.getContext("2d")!;
  // a stone-coloured cutting table with soft light falloff
  const grd = g.createRadialGradient(W * 0.45, H * 0.4, 100, W / 2, H / 2, H * 0.75);
  grd.addColorStop(0, "#d9d2c6");
  grd.addColorStop(1, "#b8b0a3");
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < 4000; k++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},0.03)`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  // the saree photographed lengthwise, pallu at the top of the frame
  const tw = H * 0.86;
  const th = tw / 4.8;
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-Math.PI / 2 + 0.004);
  g.shadowColor = "rgba(0,0,0,0.25)";
  g.shadowBlur = 30;
  g.shadowOffsetY = 8;
  g.drawImage(t.colour, -tw / 2, -th / 2, tw, th);
  g.restore();
  return c;
}
