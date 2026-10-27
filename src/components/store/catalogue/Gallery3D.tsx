"use client";

import { Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useTheme } from "@/hooks/useTheme";
import { price } from "@/lib/format";
import type { ProductView } from "@/lib/view";
import { MANNEQUIN_FINISHES, createMannequin } from "@/studio/body";
import { DrapeRig } from "@/studio/drape";
import { getTextures } from "@/studio/registry";
import { FabricMaterial } from "@/studio/scene";

const SPACING = 1.5;

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
      <Canvas dpr={[1, 1.6]} camera={{ fov: 32, position: [0, 1.15, 4.6] }} gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}>
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
  const figures = useMemo(
    () =>
      products.map((p, i) => {
        const m = createMannequin(p.drape.pose);
        const mat = new FabricMaterial({ map: new THREE.Texture(), material: new THREE.Texture() }, p.fibre.sheen, p.fibre.sheer);
        const rig = new DrapeRig(mat, p.drape.style, p.drape.pose);
        rig.update(1, 0, 0);
        m.group.add(rig.group);
        m.blouse.color.set(p.blouse);
        m.group.position.set(i * SPACING, 0, 0);
        m.group.rotation.y = -0.25;
        m.group.visible = false;
        return { p, m, mat, rig };
      }),
    [products],
  );

  useEffect(() => {
    let live = true;
    figures.forEach((f) =>
      getTextures(f.p.textile, "draft").then((t) => {
        if (!live) return;
        f.mat.setTextures(t);
        f.mat.needsUpdate = true;
        f.m.group.visible = true;
      }),
    );
    return () => {
      live = false;
      figures.forEach((f) => f.rig.dispose());
    };
  }, [figures]);

  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = theme === "dark" ? 0.25 : 0.5;
    pm.dispose();
    return () => env.dispose();
  }, [gl, scene, theme]);

  useEffect(() => {
    figures.forEach((f) => {
      const fin = MANNEQUIN_FINISHES[f.p.drape.mannequin];
      f.m.skin.color.set(theme === "dark" ? fin.dark : fin.light);
      f.m.plinth.color.set(theme === "dark" ? "#1f1c19" : "#ddd5c8");
    });
  }, [figures, theme]);

  useFrame((_, dt) => {
    const x = camera.position.x + (target.current - camera.position.x) * Math.min(1, dt * 3);
    camera.position.x = x;
    camera.lookAt(x, 0.88, 0);
    figures.forEach((f, i) => {
      const want = hover === i ? 0.35 : -0.25;
      f.m.group.rotation.y += (want - f.m.group.rotation.y) * Math.min(1, dt * 1.5);
    });
  });

  const dark = theme === "dark";
  return (
    <>
      <hemisphereLight args={[dark ? "#fff1df" : "#fff6ea", "#3a332c", dark ? 0.35 : 0.9]} />
      <directionalLight position={[-2, 4, 3]} intensity={dark ? 2.2 : 1.8} color="#ffe6c4" />
      <directionalLight position={[3, 2, -3]} intensity={1.2} color="#ffe8c8" />
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
          <Html position={[i * SPACING, -0.12, 0.6]} center distanceFactor={4.5} style={{ pointerEvents: "none" }}>
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
