"use client";

import { CameraControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useTheme } from "@/hooks/useTheme";
import type { DrapeConfig, LightingId, TextileRef, ViewId } from "@/lib/types";
import { getTextures, defaultQuality, hasWebGL, type Quality } from "@/studio/registry";
import { Studio, viewCamera, type FabricTextures } from "@/studio/scene";

export interface Dressable {
  id: string;
  textile: TextileRef;
  fibre: { sheen: number; sheer: number };
  blouse: string;
  drape: DrapeConfig;
}

export type StudioMode =
  | { kind: "hero"; sequence: Dressable[]; holdSeconds: number; onChange?: (index: number) => void }
  | { kind: "viewer"; view: ViewId; lighting?: LightingId; autoRotate: boolean; onInteract?: () => void }
  | { kind: "scroll"; progress: React.RefObject<number> }
  | { kind: "preview"; view: ViewId; replay?: number };

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * The real-time studio. One component serves the hero, the product viewer,
 * the scroll story and the admin preview — the mode only changes how time
 * and camera are driven.
 */
export function StudioCanvas({ item, mode, quality, className, beam, fallback }: { item: Dressable; mode: StudioMode; quality?: Quality; className?: string; beam?: boolean; fallback?: React.ReactNode }) {
  const [tex, setTex] = useState<FabricTextures | null>(null);
  const [visible, setVisible] = useState(true);
  const [webgl, setWebgl] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const q = quality ?? defaultQuality();

  useEffect(() => setWebgl(hasWebGL()), []);
  useEffect(() => {
    let live = true;
    getTextures(item.textile, q).then((t) => live && setTex(t));
    return () => {
      live = false;
    };
  }, [item.textile, q]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const interactive = mode.kind === "viewer";
  return (
    <div ref={box} className={className} style={{ position: "absolute", inset: 0 }}>
      {!webgl ? (
        fallback
      ) : !tex ? (
        <div className="loading-thread" />
      ) : (
        <Canvas
          frameloop={visible ? "always" : "never"}
          dpr={q === "draft" ? [1, 1.5] : [1, 2]}
          shadows={q === "high"}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ fov: 30, near: 0.05, far: 40, position: [0, 1, 3.9] }}
          style={{ animation: "fade-in 1600ms var(--ease-silk) both", touchAction: interactive ? "none" : "pan-y" }}
        >
          <Rig first={tex} item={item} mode={mode} beam={beam} quality={q} />
        </Canvas>
      )}
    </div>
  );
}

function Rig({ first, item, mode, beam, quality }: { first: FabricTextures; item: Dressable; mode: StudioMode; beam?: boolean; quality: Quality }) {
  const { scene, gl, camera, pointer } = useThree();
  const { theme } = useTheme();
  const controls = useRef<CameraControls>(null);
  const studio = useMemo(() => {
    const s = new Studio(first, item.drape, { scene, transparentBackground: true, beam, shadows: quality === "high" });
    s.setBlouse(item.blouse);
    s.fabric.setFibre(item.fibre.sheen, item.fibre.sheer);
    s.drape.update(mode.kind === "viewer" || mode.kind === "preview" ? 1 : 0, 0);
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);
  useEffect(() => () => studio.dispose(), [studio]);
  useEffect(() => studio.attachRenderer(gl), [studio, gl]);
  useEffect(() => studio.setTheme(theme), [studio, theme]);

  // viewer/preview: follow the product + configuration
  const itemKey = `${item.id}|${item.drape.style}|${item.drape.pose}|${item.drape.mannequin}|${item.drape.lighting}|${item.drape.environment}`;
  useEffect(() => {
    if (mode.kind === "hero") return;
    let live = true;
    studio.configure(item.drape);
    studio.setBlouse(item.blouse);
    getTextures(item.textile, quality).then((t) => live && studio.setTextile(t, item.fibre));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio, itemKey, item.textile, item.blouse, item.fibre]);

  const lighting = mode.kind === "viewer" ? mode.lighting : undefined;
  useEffect(() => {
    if (lighting) studio.setLighting(lighting);
  }, [studio, lighting]);

  // camera presets
  const view = mode.kind === "viewer" || mode.kind === "preview" ? mode.view : "full";
  useEffect(() => {
    const v = viewCamera(view, item.drape.style);
    if (controls.current) {
      controls.current.setLookAt(...v.pos, ...v.target, true);
    } else {
      camera.position.set(...v.pos);
      camera.lookAt(...v.target);
    }
  }, [view, item.drape.style, camera]);

  // replay the drape (admin preview)
  const replay = mode.kind === "preview" ? mode.replay ?? 0 : 0;
  const t0 = useRef(0);
  const clock = useRef(0);
  useEffect(() => {
    if (replay > 0) t0.current = clock.current;
  }, [replay]);

  /* hero sequencing */
  const hero = useRef({ index: 0, phase: "drape" as "drape" | "hold" | "sweep", start: 0, next: null as FabricTextures | null, loading: false, fromBlouse: new THREE.Color(), toBlouse: new THREE.Color() });
  const rot = useRef(0);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    clock.current = t;
    const fig = studio.figure;
    if (mode.kind === "hero") {
      const h = hero.current;
      const seq = mode.sequence;
      const DRAPE = 9;
      if (h.phase === "drape") {
        const p = Math.min(1, (t - h.start) / DRAPE);
        studio.drape.update(ease(p), t);
        if (p >= 1) {
          h.phase = "hold";
          h.start = t;
        }
      } else {
        studio.drape.update(1, t);
      }
      if (h.phase === "hold" && seq.length > 1) {
        const nextIdx = (h.index + 1) % seq.length;
        if (!h.next && !h.loading) {
          h.loading = true;
          getTextures(seq[nextIdx].textile, quality).then((tx) => {
            h.next = tx;
            h.loading = false;
          });
        }
        if (t - h.start > mode.holdSeconds && h.next) {
          studio.fabric.beginTransition(h.next);
          h.fromBlouse.copy(studio.mannequin.blouse.color);
          h.toBlouse.set(seq[nextIdx].blouse);
          h.phase = "sweep";
          h.start = t;
          h.index = nextIdx;
          mode.onChange?.(nextIdx);
        }
      }
      if (h.phase === "sweep") {
        const p = Math.min(1, (t - h.start) / 4.2);
        studio.fabric.setSweep(ease(p) * 1.08);
        studio.mannequin.blouse.color.lerpColors(h.fromBlouse, h.toBlouse, ease(Math.min(1, Math.max(0, p * 1.6 - 0.5))));
        if (p >= 1) {
          studio.fabric.finishTransition();
          const f = seq[h.index].fibre;
          studio.fabric.setFibre(f.sheen, f.sheer);
          h.next = null;
          h.phase = "hold";
          h.start = t;
        }
      }
      // slow, front-weighted turn + a breath of parallax
      fig.rotation.y = Math.sin(t * 0.11) * 0.85;
      camera.position.x += (pointer.x * 0.2 - camera.position.x) * 0.02;
      camera.position.y += (1.02 + pointer.y * 0.06 - camera.position.y) * 0.02;
      camera.position.z = 5.1;
      camera.lookAt(0, 0.84, 0);
    } else if (mode.kind === "scroll") {
      studio.drape.update(mode.progress.current ?? 0, t);
      fig.rotation.y = -0.35 + (mode.progress.current ?? 0) * 0.7 + Math.sin(t * 0.2) * 0.05;
    } else if (mode.kind === "preview") {
      const p = replay > 0 ? Math.min(1, (t - t0.current) / 7) : 1;
      studio.drape.update(ease(p), t);
      fig.rotation.y = 0;
    } else {
      studio.drape.update(1, t);
      if (mode.autoRotate) rot.current += dt * 0.16;
      else rot.current += (Math.round(rot.current / (Math.PI * 2)) * Math.PI * 2 - rot.current) * Math.min(1, dt * 2.5);
      fig.rotation.y = rot.current;
    }
  });

  return mode.kind === "viewer" ? (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={0.45}
      maxDistance={5.2}
      minPolarAngle={0.35}
      maxPolarAngle={Math.PI / 1.9}
      smoothTime={0.6}
      draggingSmoothTime={0.18}
      onStart={() => mode.onInteract?.()}
    />
  ) : null;
}
