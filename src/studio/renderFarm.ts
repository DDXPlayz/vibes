"use client";

import * as THREE from "three";
import type { DrapeConfig, TextileRef, TextileSpec, ViewId } from "@/lib/types";
import { Studio, viewCamera, type Theme } from "./scene";
import { getTextures, hasWebGL, type Quality } from "./registry";

/**
 * The render farm: ONE hidden renderer + ONE studio that produce still
 * images of any saree from any camera. Product cards, admin thumbnails and
 * the "Generate" step all come from here. Results are cached as object URLs,
 * and in production the same code runs headless to write to object storage.
 */

export interface RenderJob {
  key: string;
  textile: TextileRef;
  fibre: { sheen: number; sheer: number };
  blouse: string;
  drape: DrapeConfig;
  view: ViewId;
  theme: Theme;
  width: number;
  height: number;
  transparent?: boolean;
  quality?: Quality;
}

let renderer: THREE.WebGLRenderer | null = null;
let studio: Studio | null = null;
const cache = new Map<string, Promise<string>>();
let chain: Promise<unknown> = Promise.resolve();

export function fibreOf(spec?: TextileSpec) {
  return { sheen: spec?.sheen ?? 0.55, sheer: spec?.sheer ?? 0 };
}

export function jobKey(j: Omit<RenderJob, "key">) {
  const d = j.drape;
  return [j.textile.id, j.view, j.theme, d.style, d.pose, d.mannequin, d.lighting, d.environment, j.width, j.height, j.transparent ? "t" : "o"].join("|");
}

async function run(job: RenderJob): Promise<string> {
  const tex = await getTextures(job.textile, job.quality ?? "draft");
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(1);
  }
  if (!studio) {
    studio = new Studio(tex, job.drape, { transparentBackground: false });
    studio.attachRenderer(renderer);
  }
  const s = studio;
  s.configure(job.drape);
  s.setTheme(job.theme);
  s.setTextile(tex, job.fibre);
  s.setBlouse(job.blouse);
  s.drape.update(1, 2.0, 0);
  const bg = s.scene.background;
  if (job.transparent) s.scene.background = null;
  renderer.setSize(job.width, job.height, false);
  const v = viewCamera(job.view, job.drape.style);
  const cam = new THREE.PerspectiveCamera(job.view === "full" ? 27 : 30, job.width / job.height, 0.05, 50);
  cam.position.set(...v.pos);
  cam.lookAt(new THREE.Vector3(...v.target));
  renderer.setClearColor(0x000000, 0);
  renderer.render(s.scene, cam);
  s.scene.background = bg;
  const blob: Blob | null = await new Promise((res) => renderer!.domElement.toBlob(res, "image/webp", 0.9));
  if (!blob) throw new Error("render failed");
  return URL.createObjectURL(blob);
}

/** Queue a render. Identical requests share one result. */
export function render(job: Omit<RenderJob, "key">): Promise<string> {
  const key = jobKey(job);
  let p = cache.get(key);
  if (p) return p;
  if (!hasWebGL()) return Promise.reject(new Error("no-webgl"));
  p = chain.then(() => new Promise<string>((res, rej) => {
    const go = () => run({ ...job, key }).then(res, rej);
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (ric) ric(go, { timeout: 300 });
    else setTimeout(go, 16);
  }));
  chain = p.catch(() => undefined);
  cache.set(key, p);
  return p;
}

/** Render to a Blob for upload (used by the admin Generate step). */
export async function renderBlob(job: Omit<RenderJob, "key">): Promise<Blob> {
  const url = await render(job);
  return fetch(url).then((r) => r.blob());
}
