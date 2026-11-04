"use client";

import { CameraControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useTheme } from "@/hooks/useTheme";
import type { DrapeConfig, LightingId, PoseId, TextileRef, ViewId } from "@/lib/types";
import { loadBake } from "@/studio/drapes";
import { loadModel } from "@/studio/model";
import { getTextures, defaultQuality, hasWebGL, type Quality } from "@/studio/registry";
import { EDITORIAL_FOV, Studio, backdropOf, viewCamera, type FabricTextures } from "@/studio/scene";

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
/** the hero moves through her poses as it cuts between sarees */
const HERO_POSES: PoseId[] = ["poised", "turn", "ease"];
const HERO_ANGLES = [10, -18, 26];

/** Everything a dressed frame needs, loaded together so the first frame is already finished. */
function prepare(item: Dressable, q: Quality) {
  return Promise.all([getTextures(item.textile, q), loadModel(item.drape.pose), loadBake(item.drape.style, item.drape.pose).catch(() => null)]);
}

/**
 * The real-time studio. One component serves the hero, the product viewer,
 * the scroll story and the admin preview — the mode only changes how time
 * and camera are driven.
 */
export function StudioCanvas({ item, mode, quality, className, fallback, backdrop = true }: { item: Dressable; mode: StudioMode; quality?: Quality; className?: string; beam?: boolean; fallback?: React.ReactNode; backdrop?: boolean }) {
  const [tex, setTex] = useState<FabricTextures | null>(null);
  const [visible, setVisible] = useState(true);
  const [webgl, setWebgl] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const q = quality ?? defaultQuality();

  useEffect(() => setWebgl(hasWebGL()), []);
  useEffect(() => {
    let live = true;
    prepare(item, q).then(([t]) => live && setTex(t));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.textile, q]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const interactive = mode.kind === "viewer";
  const paper = backdropOf(item.drape.environment, theme);
  return (
    <div ref={box} className={className} style={{ position: "absolute", inset: 0 }}>
      {backdrop && <div aria-hidden style={{ position: "absolute", inset: 0, background: paper, transition: "background 900ms var(--ease-silk)" }} />}
      {!webgl ? (
        fallback
      ) : !tex ? (
        <div className="loading-thread" />
      ) : (
        <Canvas
          frameloop={visible ? "always" : "never"}
          dpr={q === "draft" ? [1, 1.5] : [1, 2]}
          shadows={q !== "draft" ? "percentage" : false}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping }}
          camera={{ fov: EDITORIAL_FOV, near: 0.1, far: 40, position: [0, 0.9, 5.45] }}
          style={{ animation: "fade-in 1600ms var(--ease-silk) both", touchAction: interactive ? "none" : "pan-y" }}
        >
          <Rig first={tex} item={item} mode={mode} quality={q} veil={veil} />
        </Canvas>
      )}
      {/* the editorial cut: a soft dip into the paper between sarees */}
      <div ref={veil} aria-hidden style={{ position: "absolute", inset: 0, background: paper, opacity: 0, pointerEvents: "none" }} />
    </div>
  );
}

function Rig({ first, item, mode, quality, veil }: { first: FabricTextures; item: Dressable; mode: StudioMode; quality: Quality; veil: React.RefObject<HTMLDivElement | null> }) {
  const { scene, gl, camera } = useThree();
  const { theme } = useTheme();
  const controls = useRef<CameraControls>(null);
  // created in an effect (not during render), so React's double-invoked setup never leaves a ghost studio behind
  const [studio, setStudio] = useState<Studio | null>(null);
  useEffect(() => {
    const s = new Studio(first, item.drape, { scene, transparentBackground: true, shadows: quality !== "draft" });
    s.setBlouse(item.blouse);
    s.setTextile(first, item.fibre);
    s.drape.update(mode.kind === "scroll" ? 0 : 1, 0);
    s.attachRenderer(gl);
    setStudio(s);
    return () => {
      s.dispose();
      setStudio(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, gl]);
  useEffect(() => studio?.setTheme(theme), [studio, theme]);

  // viewer / preview: follow the product and its studio settings
  const itemKey = `${item.id}|${item.drape.style}|${item.drape.pose}|${item.drape.mannequin}|${item.drape.lighting}|${item.drape.environment}|${item.blouse}`;
  useEffect(() => {
    if (mode.kind === "hero" || !studio) return;
    let live = true;
    prepare(item, quality).then(([t]) => {
      if (!live) return;
      studio.configure(item.drape);
      studio.setBlouse(item.blouse);
      studio.setTextile(t, item.fibre);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio, itemKey, item.textile, item.fibre]);

  const lighting = mode.kind === "viewer" ? mode.lighting : undefined;
  useEffect(() => {
    if (lighting) studio?.setLighting(lighting);
  }, [studio, lighting]);

  // camera presets
  const view = mode.kind === "viewer" || mode.kind === "preview" ? mode.view : "full";
  useEffect(() => {
    const v = viewCamera(view, item.drape.style);
    if (controls.current) controls.current.setLookAt(...v.pos, ...v.target, true);
    else {
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

  /* the hero: hold, dip, cut to the next saree in a new pose and angle */
  const hero = useRef({ index: 0, phase: "hold" as "hold" | "out" | "in", start: 0, ready: false, loading: false, cut: 0 });

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    clock.current = t;
    if (!studio) return;
    if (mode.kind === "hero") {
      const h = hero.current;
      const seq = mode.sequence;
      studio.drape.update(1, t);
      const nextIdx = (h.index + 1) % seq.length;
      const nextItem = (): Dressable => {
        const n = seq[nextIdx];
        return { ...n, drape: { ...n.drape, pose: HERO_POSES[(h.cut + 1) % HERO_POSES.length] } };
      };
      if (h.phase === "hold" && seq.length > 1) {
        if (!h.ready && !h.loading) {
          h.loading = true;
          prepare(nextItem(), quality).then(() => {
            h.ready = true;
            h.loading = false;
          });
        }
        if (t - h.start > mode.holdSeconds && h.ready) {
          h.phase = "out";
          h.start = t;
        }
      } else if (h.phase === "out") {
        const p = Math.min(1, (t - h.start) / 0.9);
        if (veil.current) veil.current.style.opacity = String(ease(p));
        if (p >= 1) {
          const n = nextItem();
          h.index = nextIdx;
          h.cut++;
          h.ready = false;
          studio.configure(n.drape);
          studio.setBlouse(n.blouse);
          getTextures(n.textile, quality).then((tx) => studio.setTextile(tx, n.fibre));
          mode.onChange?.(nextIdx);
          h.phase = "in";
          h.start = t;
        }
      } else if (h.phase === "in") {
        const p = Math.min(1, (t - h.start - 0.25) / 1.3);
        if (veil.current) veil.current.style.opacity = String(1 - ease(Math.max(0, p)));
        if (p >= 1) {
          h.phase = "hold";
          h.start = t;
        }
      }
      // the camera breathes: a slow drift round her and an imperceptible push-in
      const since = h.phase === "hold" ? t - h.start : 0;
      const base = HERO_ANGLES[h.cut % HERO_ANGLES.length];
      const az = ((base + Math.sin(t * 0.05) * 5 + since * 0.35) * Math.PI) / 180;
      const dist = 5.6 - Math.min(0.35, since * 0.012);
      const portrait = state.size.width / state.size.height < 0.85;
      const target = new THREE.Vector3(0, portrait ? 0.71 : 0.733, 0);
      camera.position.set(Math.sin(az) * dist, 0.9, Math.cos(az) * dist);
      camera.lookAt(target);
    } else if (mode.kind === "scroll") {
      studio.drape.update(mode.progress.current ?? 0, t);
      studio.figure.rotation.y = -0.3 + (mode.progress.current ?? 0) * 0.6;
    } else if (mode.kind === "preview") {
      const p = replay > 0 ? Math.min(1, (t - t0.current) / 7) : 1;
      studio.drape.update(ease(p), t);
    } else {
      studio.drape.update(1, t);
      if (mode.autoRotate && controls.current) controls.current.azimuthAngle += 0.0016;
    }
  });

  return mode.kind === "viewer" || mode.kind === "preview" ? (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={0.8}
      maxDistance={6.2}
      minPolarAngle={Math.PI / 2 - 0.32}
      maxPolarAngle={Math.PI / 2 + 0.08}
      smoothTime={0.7}
      draggingSmoothTime={0.2}
      // drag turns her, scroll moves closer; no panning — the composition stays composed
      mouseButtons={{ left: 1, middle: 0, right: 0, wheel: 16 }}
      touches={{ one: 64, two: 1024, three: 0 }}
      onStart={() => mode.kind === "viewer" && mode.onInteract?.()}
    />
  ) : null;
}
