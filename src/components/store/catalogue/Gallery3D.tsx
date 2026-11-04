"use client";

import { Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { loadBake } from "@/studio/drapes";
import { createHuman, setSkinTone } from "@/studio/human";
import { getModelSync, loadModel } from "@/studio/model";
import { useTheme } from "@/hooks/useTheme";
import { price } from "@/lib/format";
import type { ProductView } from "@/lib/view";
import { DrapeRig } from "@/studio/drape";
import { getTextures } from "@/studio/registry";
import { FabricMaterial } from "@/studio/scene";

const SPACING = 1.3;

/**
 * The 3D room: the filtered collection standing in a quiet gallery.
 * Drag or scroll sideways to walk along; click a piece to open it.
 */
export function Gallery3D({ products }: { products: ProductView[] }) {
  const target = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; t: number } | null>(null);
  const max = (products.length - 1) * SPACING;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) && !e.shiftKey) return;
      e.preventDefault();
      target.current = Math.max(0, Math.min(max, target.current + (e.deltaX || e.deltaY) * 0.004));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [max]);

  return (
    <div
      ref={box}
      style={{ position: "absolute", inset: 0, cursor: "grab", touchAction: "pan-y" }}
      onPointerDown={(e) => (drag.current = { x: e.clientX, t: target.current })}
      onPointerMove={(e) => {
        if (!drag.current) return;
        target.current = Math.max(0, Math.min(max, drag.current.t - (e.clientX - drag.current.x) * 0.006));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
    >
      <Canvas dpr={[1, 1.6]} camera={{ fov: 22, position: [0, 1.0, 5.2] }} gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}>
        <Room products={products} target={target} />
      </Canvas>
      <div className="label" style={{ position: "absolute", top: 16, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
        Drag to walk the room · click a saree to open it
      </div>
    </div>
  );
}

function Room({ products, target }: { products: ProductView[]; target: React.RefObject<number> }) {
  const { gl, scene, camera } = useThree();
  const { theme } = useTheme();
  const router = useRouter();
  const [hover, setHover] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all(products.flatMap((p) => [loadModel(p.drape.pose), loadBake(p.drape.style, p.drape.pose).catch(() => null)])).then(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [products]);
  const figures = useMemo(
    () =>
      !loaded
        ? []
        : products.map((p, i) => {
            const model = getModelSync(p.drape.pose)!;
            const human = createHuman(model);
            setSkinTone(human, p.drape.mannequin);
            human.blouse.color.set(p.blouse);
            const mat = new FabricMaterial({ map: new THREE.Texture(), material: new THREE.Texture() }, p.fibre.sheen, p.fibre.sheer, THREE.DoubleSide);
            const rig = new DrapeRig(mat, p.drape.style, p.drape.pose);
            rig.update(1, 0, 0);
            const g = new THREE.Group();
            g.add(human.group, rig.group);
            g.position.set(i * SPACING, 0, 0);
            g.rotation.y = -0.25;
            g.visible = false;
            return { p, m: { group: g }, mat, rig };
          }),
    [products, loaded],
  );

  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = theme === "dark" ? 0.25 : 0.5;
    pm.dispose();
    return () => env.dispose();
  }, [gl, scene, theme]);

  useFrame((state, dt) => {
    // drapes arrive from their bakes asynchronously; update() is a no-op once settled
    figures.forEach((f) => f.rig.update(1, state.clock.elapsedTime, 0));
    const x = camera.position.x + (target.current - camera.position.x) * Math.min(1, dt * 3);
    camera.position.x = x;
    camera.lookAt(x, 0.82, 0);
    figures.forEach((f, i) => {
      const want = hover === i ? 0.35 : -0.25;
      f.m.group.rotation.y += (want - f.m.group.rotation.y) * Math.min(1, dt * 1.5);
    });
  });

  const dark = theme === "dark";
  return (
    <>
      <hemisphereLight args={[dark ? "#fff1df" : "#fff6ea", "#3a332c", dark ? 0.35 : 0.7]} />
      <directionalLight position={[-2.5, 3.5, 3]} intensity={dark ? 2.4 : 2.1} color="#fff0de" />
      <directionalLight position={[3, 2, -3]} intensity={1.4} color="#fff4e8" />
      {figures.map((f, i) => (
        <group key={f.p.id}>
          <primitive
            object={f.m.group}
            onPointerOver={(e: { stopPropagation: () => void }) => {
              e.stopPropagation();
              setHover(i);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHover(null);
              document.body.style.cursor = "";
            }}
            onClick={() => router.push(`/saree/${f.p.slug}`)}
          />
          <Html position={[i * SPACING, -0.08, 0.55]} center distanceFactor={4.5} style={{ pointerEvents: "none" }}>
            <div style={{ textAlign: "center", width: 220, opacity: hover === i ? 1 : 0.75, transition: "opacity .6s" }}>
              <div className="serif" style={{ fontSize: 26, lineHeight: 1.1, color: "var(--ink)" }}>{f.p.name}</div>
              <div className="label" style={{ marginTop: 4 }}>
                {f.p.weave} · {f.p.availability === "sold" ? "Archive" : price(f.p.price)}
              </div>
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}
