"use client";

import type { TextileRef } from "@/lib/types";
import { generateTextile, surfaceFromImage, type TextileSurface } from "./textile";
import { texturesFromSurface, type FabricTextures } from "./scene";

/**
 * Client-side cache of textile surfaces and GPU textures, so the hero,
 * product cards, viewer and render farm all share one decoded copy.
 */

export type Quality = "draft" | "standard" | "high";
const WIDTH: Record<Quality, number> = { draft: 1536, standard: 2560, high: 3584 };

const surfaces = new Map<string, Promise<TextileSurface>>();
const textures = new Map<string, Promise<FabricTextures>>();

export function defaultQuality(): Quality {
  if (typeof window === "undefined") return "standard";
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const lowMem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (small || (lowMem && lowMem <= 4)) return "draft";
  return "standard";
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export function getSurface(ref: TextileRef, q: Quality = "standard"): Promise<TextileSurface> {
  const key = `${ref.id}:${q}`;
  let s = surfaces.get(key);
  if (!s) {
    s = (async () => {
      if (ref.source === "scan" && ref.scanUrl) {
        const img = await loadImage(ref.scanUrl);
        return surfaceFromImage(img, Math.min(WIDTH[q], img.width));
      }
      if (!ref.spec) throw new Error(`Textile ${ref.id} has no spec or scan`);
      // let the browser breathe between heavy canvas jobs
      await new Promise((r) => setTimeout(r, 0));
      return generateTextile(ref.id, ref.spec, WIDTH[q]);
    })();
    surfaces.set(key, s);
  }
  return s;
}

export function getTextures(ref: TextileRef, q: Quality = "standard"): Promise<FabricTextures> {
  const key = `${ref.id}:${q}`;
  let t = textures.get(key);
  if (!t) {
    t = getSurface(ref, q).then((s) => texturesFromSurface(s));
    textures.set(key, t);
  }
  return t;
}

/** Forget a textile (e.g. after an admin replaces a scan). */
export function invalidateTextile(id: string) {
  for (const k of [...surfaces.keys()]) if (k.startsWith(id + ":")) surfaces.delete(k);
  for (const k of [...textures.keys()]) if (k.startsWith(id + ":")) textures.delete(k);
}

let webgl: boolean | null = null;
export function hasWebGL() {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  return webgl;
}
