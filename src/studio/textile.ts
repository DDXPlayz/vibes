import type { TextileSpec, TextileAnalysis } from "@/lib/types";

/**
 * Textile surfaces.
 *
 * A textile is two images laid out flat along the saree's length:
 *   colour   — what the eye sees (for scans: the photograph itself)
 *   material — G = roughness, B = metalness (zari threads are metallic)
 *
 * For the sample archive the colour image is drawn from a TextileSpec.
 * For real products it is the processed scan; we only *derive* the
 * material mask from it. The pixels of a scan are never repainted.
 */

export interface TextileSurface {
  colour: HTMLCanvasElement;
  material: HTMLCanvasElement;
  width: number;
  height: number;
}

function rng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

let weavePattern: HTMLCanvasElement | null = null;
/** A tiny tile of thread noise, overlaid to give every surface a woven grain. */
function weaveTile() {
  if (weavePattern) return weavePattern;
  const c = makeCanvas(128, 128);
  const g = c.getContext("2d")!;
  const r = rng("weave");
  for (let x = 0; x < 128; x += 1) {
    g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${0.01 + r() * 0.025})` : `rgba(0,0,0,${0.015 + r() * 0.035})`;
    g.fillRect(x, 0, 1, 128);
  }
  for (let y = 0; y < 128; y += 1) {
    g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${0.008 + r() * 0.02})` : `rgba(0,0,0,${0.01 + r() * 0.03})`;
    g.fillRect(0, y, 128, 1);
  }
  weavePattern = c;
  return c;
}

/* ───────────── motif shapes ───────────── */

function flower(x: number, y: number, s: number) {
  const p = new Path2D();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    p.ellipse(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45, s * 0.42, s * 0.22, a, 0, Math.PI * 2);
  }
  p.moveTo(x + s * 0.18, y);
  p.arc(x, y, s * 0.18, 0, Math.PI * 2);
  return p;
}
function diamond(x: number, y: number, w: number, h: number) {
  const p = new Path2D();
  p.moveTo(x, y - h / 2);
  p.lineTo(x + w / 2, y);
  p.lineTo(x, y + h / 2);
  p.lineTo(x - w / 2, y);
  p.closePath();
  return p;
}
function kalga(x: number, y: number, s: number, flip: boolean) {
  // a restrained teardrop bud
  const d = flip ? -1 : 1;
  const p = new Path2D();
  p.moveTo(x, y - s * 0.6 * d);
  p.bezierCurveTo(x + s * 0.55, y - s * 0.1 * d, x + s * 0.4, y + s * 0.55 * d, x, y + s * 0.5 * d);
  p.bezierCurveTo(x - s * 0.45, y + s * 0.45 * d, x - s * 0.35, y - s * 0.05 * d, x, y - s * 0.6 * d);
  return p;
}
function jamdaniMotif(x: number, y: number, s: number, r: () => number) {
  // supplementary-weft motifs are built from tiny floats — we draw them as a pixel grid
  const p = new Path2D();
  const cell = Math.max(1.5, s / 7);
  const pattern = [
    "...#...",
    "..###..",
    ".#.#.#.",
    "#######",
    ".#.#.#.",
    "..###..",
    "...#...",
  ];
  const alt = r() > 0.5;
  pattern.forEach((row, j) =>
    row.split("").forEach((ch, i) => {
      if (ch === "#" || (alt && ch === "." && (i + j) % 6 === 0)) p.rect(x + (i - 3.5) * cell, y + (j - 3.5) * cell, cell * 0.9, cell * 0.9);
    }),
  );
  return p;
}
function rosette(x: number, y: number, s: number) {
  const p = new Path2D();
  for (let ring = 3; ring >= 1; ring--) {
    const rr = (s * ring) / 3;
    const n = 8 + ring * 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      p.moveTo(x + Math.cos(a) * rr + s * 0.06, y + Math.sin(a) * rr);
      p.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, s * 0.06, 0, Math.PI * 2);
    }
  }
  p.moveTo(x + s * 0.22, y);
  p.arc(x, y, s * 0.22, 0, Math.PI * 2);
  return p;
}

/* ───────────── generator ───────────── */

interface Painter {
  g: CanvasRenderingContext2D;
  m: CanvasRenderingContext2D;
  fill(path: Path2D, colour: string, zari?: boolean, alpha?: number): void;
  rect(x: number, y: number, w: number, h: number, colour: string, zari?: boolean, alpha?: number): void;
}

// zari: metallic but woven — a satin glint, not a mirror
const ZARI_MASK = "rgb(0, 108, 255)";

function painter(g: CanvasRenderingContext2D, m: CanvasRenderingContext2D): Painter {
  return {
    g,
    m,
    fill(path, colour, zari = false, alpha = 1) {
      g.globalAlpha = alpha;
      g.fillStyle = colour;
      g.fill(path);
      g.globalAlpha = 1;
      if (zari) {
        m.fillStyle = ZARI_MASK;
        m.fill(path);
      }
    },
    rect(x, y, w, h, colour, zari = false, alpha = 1) {
      g.globalAlpha = alpha;
      g.fillStyle = colour;
      g.fillRect(x, y, w, h);
      g.globalAlpha = 1;
      if (zari) {
        m.fillStyle = ZARI_MASK;
        m.fillRect(x, y, w, h);
      }
    },
  };
}

/** Ikat: the dyed-before-weaving blur, made by painting a shape several times with jitter. */
function ikat(P: Painter, path: (dx: number) => Path2D, colour: string, r: () => number, blur: number) {
  for (let i = 0; i < 5; i++) P.fill(path((r() - 0.5) * blur), colour, false, 0.32);
}

export function generateTextile(id: string, spec: TextileSpec, width = 3072): TextileSurface {
  const W = width;
  const H = Math.round(width / 4.8);
  const colour = makeCanvas(W, H);
  const material = makeCanvas(W, H);
  const g = colour.getContext("2d")!;
  const m = material.getContext("2d")!;
  const r = rng(id);
  const P = painter(g, m);
  const rough = Math.round((0.92 - spec.sheen * 0.42) * 255);
  m.fillStyle = `rgb(0, ${rough}, 0)`;
  m.fillRect(0, 0, W, H);

  // base cloth
  g.fillStyle = spec.base;
  g.fillRect(0, 0, W, H);
  if (spec.baseShot) {
    g.globalAlpha = 0.22;
    g.fillStyle = spec.baseShot;
    for (let x = 0; x < W; x += 2) g.fillRect(x, 0, 1, H);
    g.globalAlpha = 1;
  }
  // slow tonal variation — hand-dyed yarn is never perfectly even
  for (let i = 0; i < 40; i++) {
    const x = r() * W;
    const grd = g.createLinearGradient(x - 200, 0, x + 200, 0);
    const a = 0.025 + r() * 0.04;
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(0.5, r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(x - 200, 0, 400, H);
  }

  const bw = Math.round(spec.border.width * H);
  const palluX = Math.round(spec.pallu.start * W);
  const fieldTop = bw;
  const fieldBottom = H - bw;
  const S = H * 0.05 * spec.motif.scale;

  /* field motifs */
  const field = (x0: number, x1: number, kind: TextileSpec["motif"]["kind"], col: string, zari: boolean, dens: number, scale: number) => {
    const s = H * 0.05 * scale;
    const step = s * (3.6 - dens * 2.2);
    switch (kind) {
      case "buti":
        for (let y = fieldTop + step * 0.6, row = 0; y < fieldBottom - s * 0.5; y += step, row++)
          for (let x = x0 + (row % 2 ? step / 2 : 0) + step * 0.3; x < x1 - s; x += step) {
            const which = (Math.floor(x / step) + row) % 3;
            const path = which === 0 ? flower(x, y, s * 0.55) : which === 1 ? kalga(x, y, s * 0.6, row % 2 === 0) : diamond(x, y, s * 0.55, s * 0.8);
            P.fill(path, col, zari);
          }
        break;
      case "jamdani":
        for (let y = fieldTop + step * 0.7, row = 0; y < fieldBottom - s; y += step * 1.15, row++)
          for (let x = x0 + (row % 2 ? step * 0.6 : 0) + step * 0.4; x < x1 - s; x += step * 1.2) P.fill(jamdaniMotif(x, y, s * 1.1, r), col, zari, 0.92);
        break;
      case "jaal": {
        g.save();
        g.beginPath();
        g.rect(x0, fieldTop, x1 - x0, fieldBottom - fieldTop);
        g.clip();
        m.save();
        m.beginPath();
        m.rect(x0, fieldTop, x1 - x0, fieldBottom - fieldTop);
        m.clip();
        const lat = new Path2D();
        const lw = Math.max(1.2, s * 0.06);
        for (let d = -H; d < x1 - x0 + H; d += step) {
          lat.rect(0, 0, 0, 0);
          const a = new Path2D();
          a.moveTo(x0 + d, fieldTop);
          a.lineTo(x0 + d + H, fieldBottom + H - (fieldBottom - fieldTop));
          g.strokeStyle = col;
          g.lineWidth = lw;
          g.stroke(a);
          const b = new Path2D();
          b.moveTo(x0 + d + H, fieldTop);
          b.lineTo(x0 + d, fieldBottom);
          g.stroke(b);
          if (zari) {
            m.strokeStyle = ZARI_MASK;
            m.lineWidth = lw;
            m.stroke(a);
            m.stroke(b);
          }
        }
        for (let y = fieldTop, row = 0; y < fieldBottom; y += step / 2, row++)
          for (let x = x0 + (row % 2 ? step / 2 : 0); x < x1; x += step) P.fill(flower(x, y, s * 0.3), col, zari);
        g.restore();
        m.restore();
        break;
      }
      case "stripes": {
        let y = fieldTop + s * 0.4;
        let i = 0;
        while (y < fieldBottom) {
          const h = Math.max(1.5, s * (i % 3 === 0 ? 0.22 : 0.08));
          P.rect(x0, y, x1 - x0, h, col, zari && i % 3 === 0, 0.9);
          y += s * (0.6 + (i % 4) * 0.25);
          i++;
        }
        break;
      }
      case "checks": {
        const lw = Math.max(1.5, s * 0.1);
        for (let y = fieldTop + step / 2; y < fieldBottom; y += step) P.rect(x0, y, x1 - x0, lw, col, zari, 0.8);
        for (let x = x0 + step / 2; x < x1; x += step) P.rect(x, fieldTop, lw, fieldBottom - fieldTop, col, zari, 0.8);
        break;
      }
      case "ikat-chevron": {
        const band = step * 0.9;
        for (let x = x0; x < x1; x += band * 2) {
          ikat(
            P,
            (dx) => {
              const p = new Path2D();
              const amp = band * 0.5;
              p.moveTo(x + dx, fieldTop);
              for (let y = fieldTop; y <= fieldBottom; y += band * 0.5) p.lineTo(x + dx + ((Math.round((y - fieldTop) / (band * 0.5)) % 2) ? amp : 0), y);
              for (let y = fieldBottom; y >= fieldTop; y -= band * 0.5) p.lineTo(x + dx + band * 0.6 + ((Math.round((y - fieldTop) / (band * 0.5)) % 2) ? amp : 0), y);
              p.closePath();
              return p;
            },
            col,
            r,
            s * 0.35,
          );
        }
        break;
      }
      case "ikat-diamond": {
        for (let y = fieldTop + step * 0.5, row = 0; y < fieldBottom; y += step * 0.8, row++)
          for (let x = x0 + (row % 2 ? step / 2 : 0); x < x1; x += step) {
            ikat(P, (dx) => diamond(x + dx, y, step * 0.62, step * 0.7), col, r, s * 0.3);
            P.fill(diamond(x, y, step * 0.18, step * 0.2), spec.base, false, 0.9);
          }
        break;
      }
      default:
        break;
    }
  };

  field(0, palluX - bw * 1.4, spec.motif.kind, spec.motif.color, spec.motif.zari, spec.motif.density, spec.motif.scale);

  /* pallu */
  const pc = spec.pallu.color;
  const pz = spec.pallu.zari;
  const palluField = (x0: number, x1: number) => {
    const h = fieldBottom - fieldTop;
    switch (spec.pallu.kind) {
      case "dense-buti":
        field(x0, x1, "buti", pc, pz, 0.95, spec.motif.scale * 1.15);
        break;
      case "stripes": {
        let x = x0;
        let i = 0;
        while (x < x1) {
          const w = S * (i % 3 === 0 ? 1.2 : 0.35);
          P.rect(x, fieldTop, w, h, i % 2 ? pc : spec.border.color, pz && i % 2 === 1, 0.95);
          x += w + S * (0.5 + (i % 3) * 0.4);
          i++;
        }
        break;
      }
      case "medallion": {
        const big = h * 0.2;
        for (let x = x0 + big * 1.3; x < x1 - big; x += big * 2.6)
          for (let y = fieldTop + big * 1.2, row = 0; y < fieldBottom - big * 0.6; y += big * 2.4, row++) P.fill(rosette(x + (row % 2 ? big * 1.3 : 0), y, big), pc, pz);
        field(x0, x1, "buti", pc, pz, 0.4, spec.motif.scale * 0.6);
        break;
      }
      case "ikat-grid":
        field(x0, x1, "ikat-diamond", pc, false, 0.7, spec.motif.scale * 1.4);
        break;
      case "temple": {
        const tw = h * 0.12;
        for (let y = fieldTop + tw; y < fieldBottom; y += tw * 1.6)
          for (let x = x0 + tw; x < x1 - tw; x += tw * 1.1) {
            const p = new Path2D();
            p.moveTo(x, y - tw * 0.7);
            p.lineTo(x + tw * 0.45, y + tw * 0.3);
            p.lineTo(x - tw * 0.45, y + tw * 0.3);
            p.closePath();
            P.fill(p, pc, pz);
          }
        break;
      }
      case "narrative": {
        const cols = 3;
        const rows = 5;
        const pw = (x1 - x0) / cols;
        const ph = h / rows;
        for (let i = 0; i < cols; i++)
          for (let j = 0; j < rows; j++) {
            const px = x0 + i * pw;
            const py = fieldTop + j * ph;
            const frame = new Path2D();
            frame.rect(px + pw * 0.06, py + ph * 0.08, pw * 0.88, ph * 0.84);
            g.strokeStyle = pc;
            g.lineWidth = Math.max(1.5, S * 0.08);
            g.stroke(frame);
            // abstracted figures: an arch and two standing forms
            const arch = new Path2D();
            arch.moveTo(px + pw * 0.2, py + ph * 0.8);
            arch.lineTo(px + pw * 0.2, py + ph * 0.4);
            arch.quadraticCurveTo(px + pw * 0.5, py + ph * 0.05, px + pw * 0.8, py + ph * 0.4);
            arch.lineTo(px + pw * 0.8, py + ph * 0.8);
            g.stroke(arch);
            for (const fx of [0.4, 0.6]) {
              const f = new Path2D();
              f.arc(px + pw * fx, py + ph * 0.38, ph * 0.06, 0, Math.PI * 2);
              f.rect(px + pw * fx - ph * 0.05, py + ph * 0.46, ph * 0.1, ph * 0.3);
              P.fill(f, pc, pz);
            }
          }
        break;
      }
      case "plain":
      default:
        for (let x = x0; x < x1; x += S * 0.5) P.rect(x, fieldTop, 1.5, h, pc, false, 0.18);
        break;
    }
  };

  // pallu ground
  P.rect(palluX, 0, W - palluX, H, spec.pallu.kind === "plain" ? pc : spec.base, false, spec.pallu.kind === "plain" ? 0.85 : 1);
  if (spec.pallu.kind !== "plain" && spec.pallu.kind !== "narrative") P.rect(palluX, 0, W - palluX, H, pc, false, 0.08);
  palluField(palluX + bw * 1.3, W - bw * 0.9);
  // cross borders framing the pallu
  for (const cx of [palluX, W - bw * 0.65]) {
    P.rect(cx, 0, bw * 0.7, H, spec.border.color, spec.border.zari);
    P.rect(cx + bw * 0.12, 0, Math.max(1.5, bw * 0.06), H, spec.border.accent ?? spec.base, false, 0.8);
    P.rect(cx + bw * 0.52, 0, Math.max(1.5, bw * 0.06), H, spec.border.accent ?? spec.base, false, 0.8);
  }

  /* borders along both long edges */
  const drawBorder = (y0: number, flip: boolean) => {
    const bc = spec.border.color;
    const acc = spec.border.accent ?? spec.base;
    const z = spec.border.zari;
    P.rect(0, y0, palluX, bw, bc, z);
    const inner = flip ? y0 : y0 + bw;
    const dirIn = flip ? -1 : 1; // direction into the field
    switch (spec.border.style) {
      case "temple": {
        const tw = bw * 0.5;
        for (let x = 0; x < palluX; x += tw) {
          const p = new Path2D();
          const base = flip ? y0 : y0 + bw;
          p.moveTo(x, base);
          p.lineTo(x + tw / 2, base + dirIn * tw * 0.9);
          p.lineTo(x + tw, base);
          p.closePath();
          P.fill(p, bc, z);
        }
        P.rect(0, y0 + bw * 0.35, palluX, Math.max(1.5, bw * 0.05), acc, false, 0.9);
        break;
      }
      case "zari-band":
        for (let i = 0; i < 6; i++) P.rect(0, y0 + bw * (0.12 + i * 0.14), palluX, Math.max(1, bw * 0.03), acc, false, 0.35);
        break;
      case "stripes":
        P.rect(0, y0, palluX, bw, spec.base, false, 1);
        for (let i = 0; i < 5; i++) P.rect(0, y0 + bw * (0.08 + i * 0.19), palluX, bw * (i % 2 ? 0.06 : 0.11), bc, z);
        break;
      case "ikat":
        for (let x = 0; x < palluX; x += bw * 0.9)
          ikat(P, (dx) => diamond(x + dx, y0 + bw / 2, bw * 0.7, bw * 0.6), acc, r, bw * 0.12);
        break;
      case "buti-band":
        for (let x = bw * 0.4; x < palluX; x += bw * 0.8) P.fill(flower(x, y0 + bw / 2, bw * 0.28), acc, !z);
        break;
      default:
        P.rect(0, inner + (flip ? bw * 0.06 : -bw * 0.12), palluX, Math.max(1.5, bw * 0.05), acc, false, 0.8);
    }
    // the thin selvedge line at the very edge
    P.rect(0, flip ? y0 + bw - 2 : y0, W, 2, acc, false, 0.6);
  };
  drawBorder(0, false);
  drawBorder(H - bw, true);

  // fringe at the pallu end
  for (let y = 0; y < H; y += 3) P.rect(W - 6, y, 6, 1.6, spec.base, false, 0.7);

  // woven grain over everything
  g.globalAlpha = 1;
  g.fillStyle = g.createPattern(weaveTile(), "repeat")!;
  g.fillRect(0, 0, W, H);

  return { colour, material, width: W, height: H };
}

/* ───────────── scans ───────────── */

/** Build the surface for a real scan: the image is used as-is, only analysed for zari. */
export function surfaceFromImage(img: CanvasImageSource & { width: number; height: number }, width = 3072): TextileSurface {
  const H = Math.round((width * img.height) / img.width);
  const colour = makeCanvas(width, H);
  const g = colour.getContext("2d")!;
  g.drawImage(img, 0, 0, width, H);
  const material = makeCanvas(width, H);
  const m = material.getContext("2d")!;
  const src = g.getImageData(0, 0, width, H);
  const out = m.createImageData(width, H);
  for (let i = 0; i < src.data.length; i += 4) {
    const z = zariScore(src.data[i], src.data[i + 1], src.data[i + 2]);
    out.data[i] = 0;
    out.data[i + 1] = Math.round((0.78 - z * 0.36) * 255);
    out.data[i + 2] = Math.round(z * 255);
    out.data[i + 3] = 255;
  }
  m.putImageData(out, 0, 0);
  return { colour, material, width, height: H };
}

/** 0..1 — how much a pixel looks like gold/silver metallic thread. */
export function zariScore(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  let h = 0;
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min)) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const gold = h > 32 && h < 58 && s > 0.28 && s < 0.75 && v > 0.55 ? 1 : 0;
  return gold;
}

export type { TextileAnalysis };
