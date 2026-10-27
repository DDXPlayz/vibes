"use client";

import { useEffect, useRef, useState } from "react";
import { StudioCanvas } from "@/components/three/StudioCanvas";
import { cx } from "@/lib/format";
import type { LightingId, ViewId } from "@/lib/types";
import type { ProductView } from "@/lib/view";
import { LIGHTING, VIEWS } from "@/studio/scene";
import { RotateIcon } from "../Icons";
import { TextileSwatch } from "../TextileSwatch";
import styles from "./product.module.css";

const VIEW_ORDER: ViewId[] = ["full", "front", "three-quarter", "side", "back", "pallu", "border", "weave"];

export function ProductViewer({ product }: { product: ProductView }) {
  const [view, setView] = useState<ViewId>("full");
  const [lighting, setLighting] = useState<LightingId>(product.drape.lighting);
  const [rotate, setRotate] = useState(true);
  const [mode, setMode] = useState<"3d" | "textile">("3d");
  return (
    <div className={cx("stage", styles.viewer)}>
      {mode === "3d" ? (
        <StudioCanvas
          item={{ ...product, drape: { ...product.drape, lighting } }}
          mode={{ kind: "viewer", view, lighting, autoRotate: rotate, onInteract: () => setRotate(false) }}
          fallback={<TextileSwatch textile={product.textile} folded />}
        />
      ) : (
        <TextileInspector product={product} />
      )}
      <div className={styles.vTop}>
        <div className="seg">
          <button className={cx(mode === "3d" && "on")} onClick={() => setMode("3d")}>
            Draped
          </button>
          <button className={cx(mode === "textile" && "on")} onClick={() => setMode("textile")}>
            Textile
          </button>
        </div>
        {mode === "3d" && (
          <div className={styles.lights}>
            {(Object.keys(LIGHTING) as LightingId[]).map((l) => (
              <button key={l} className={cx("link", lighting === l && "on")} onClick={() => setLighting(l)} title={LIGHTING[l].note}>
                {LIGHTING[l].label}
              </button>
            ))}
          </div>
        )}
      </div>
      {mode === "3d" && (
        <div className={styles.vBottom}>
          <div className={styles.views} role="tablist" aria-label="Views">
            {VIEW_ORDER.map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                className={cx("chip", view === v && "on")}
                onClick={() => {
                  setView(v);
                  setRotate(false);
                }}
              >
                {VIEWS[v].label}
              </button>
            ))}
          </div>
          <button className={cx("icon-btn", styles.rot)} onClick={() => setRotate(!rotate)} aria-pressed={rotate} title={rotate ? "Stop turning" : "Turn slowly"} style={{ color: rotate ? "var(--gold)" : undefined }}>
            <RotateIcon />
          </button>
        </div>
      )}
      {mode === "3d" && <p className={cx("label", styles.hint)}>Drag to turn · scroll or pinch to look closer</p>}
    </div>
  );
}

/** The flat textile — the untouched record — with a loupe. */
function TextileInspector({ product }: { product: ProductView }) {
  const box = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLCanvasElement>(null);
  const surf = useRef<HTMLCanvasElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    import("@/studio/registry").then(({ getSurface }) => getSurface(product.textile, "high").then((s) => (surf.current = s.colour)));
  }, [product.textile]);
  const onMove = (e: React.PointerEvent) => {
    const el = box.current?.querySelector("canvas");
    const src = surf.current;
    if (!el || !src || !lens.current) return;
    const r = el.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width;
    const v = (e.clientY - r.top) / r.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return setPos(null);
    setPos({ x: e.clientX - (box.current!.getBoundingClientRect().left), y: e.clientY - box.current!.getBoundingClientRect().top });
    const g = lens.current.getContext("2d")!;
    const L = lens.current.width;
    const span = src.width * 0.035;
    g.imageSmoothingQuality = "high";
    g.drawImage(src, u * src.width - span / 2, v * src.height - span / 2, span, span, 0, 0, L, L);
  };
  return (
    <div ref={box} className={styles.inspector} onPointerMove={onMove} onPointerLeave={() => setPos(null)}>
      <div className={styles.strip}>
        <TextileSwatch textile={product.textile} quality="standard" />
      </div>
      <div className={styles.stripMarks}>
        <span>Body</span>
        <span>Pleats</span>
        <span>Pallu</span>
      </div>
      <p className="label" style={{ textAlign: "center", marginTop: 18 }}>
        {product.textile.source === "scan" ? "The original scan — unaltered" : "The textile record"} · {product.dimensions.lengthM} m × {product.dimensions.widthM} m · move to inspect
      </p>
      <canvas ref={lens} width={320} height={320} className={styles.lens} style={{ opacity: pos ? 1 : 0, left: pos?.x ?? 0, top: pos?.y ?? 0 }} />
    </div>
  );
}
