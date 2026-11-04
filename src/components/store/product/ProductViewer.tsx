"use client";

import { useEffect, useRef, useState } from "react";
import { StudioCanvas } from "@/components/three/StudioCanvas";
import { cx } from "@/lib/format";
import type { LightingId, ViewId } from "@/lib/types";
import type { ProductView } from "@/lib/view";
import { LIGHTING } from "@/studio/scene";
import { TextileSwatch } from "../TextileSwatch";
import styles from "./product.module.css";

/** Fashion sells the saree; the textile explains it. */
type Mode = "fashion" | "textile";

const FASHION_VIEWS: { id: ViewId; label: string }[] = [
  { id: "full", label: "Front" },
  { id: "side", label: "Side" },
  { id: "back", label: "Back" },
  { id: "pallu", label: "Pallu" },
  { id: "border", label: "Border" },
];
const LIGHT_ORDER: LightingId[] = ["gallery", "daylight", "dusk"];

export function ProductViewer({ product }: { product: ProductView }) {
  const [mode, setMode] = useState<Mode>("fashion");
  const [view, setView] = useState<ViewId>("full");
  const [lighting, setLighting] = useState<LightingId>(product.drape.lighting);
  const [touched, setTouched] = useState(false);
  return (
    <div className={cx("stage", styles.viewer)}>
      {mode === "fashion" ? (
        <>
          <StudioCanvas
            item={{ ...product, drape: { ...product.drape, lighting } }}
            mode={{ kind: "viewer", view, lighting, autoRotate: false, onInteract: () => setTouched(true) }}
            fallback={<TextileSwatch textile={product.textile} folded />}
          />
          <nav className={styles.views} aria-label="Views">
            {FASHION_VIEWS.map((v) => (
              <button key={v.id} className={cx(styles.viewLink, view === v.id && styles.viewOn)} onClick={() => setView(v.id)} aria-pressed={view === v.id}>
                {v.label}
              </button>
            ))}
          </nav>
          <button
            className={styles.light}
            onClick={() => setLighting(LIGHT_ORDER[(LIGHT_ORDER.indexOf(lighting) + 1) % LIGHT_ORDER.length])}
            title={LIGHTING[lighting].note}
          >
            Light · {LIGHTING[lighting].label}
          </button>
          <p className={cx(styles.hint, touched && styles.hintGone)}>Drag to turn · scroll to look closer</p>
        </>
      ) : (
        <TextileMode product={product} />
      )}
      <div className={styles.modes} role="tablist" aria-label="Presentation">
        <button role="tab" aria-selected={mode === "fashion"} className={cx(mode === "fashion" && styles.modeOn)} onClick={() => setMode("fashion")}>
          Fashion
        </button>
        <button role="tab" aria-selected={mode === "textile"} className={cx(mode === "textile" && styles.modeOn)} onClick={() => setMode("textile")}>
          Textile
        </button>
      </div>
    </div>
  );
}

/** The saree laid flat: the record itself, its parts, and the facts of its making. */
function TextileMode({ product: p }: { product: ProductView }) {
  const strip = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLCanvasElement>(null);
  const surf = useRef<HTMLCanvasElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    import("@/studio/registry").then(({ getSurface }) => getSurface(p.textile, "high").then((s) => (surf.current = s.colour)));
  }, [p.textile]);
  const onMove = (e: React.PointerEvent) => {
    const el = strip.current;
    const src = surf.current;
    if (!el || !src || !lens.current) return;
    const r = el.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width;
    const v = (e.clientY - r.top) / r.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return setPos(null);
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    const g = lens.current.getContext("2d")!;
    const span = src.width * 0.03;
    g.imageSmoothingQuality = "high";
    g.drawImage(src, u * src.width - span / 2, v * src.height - span / 2, span, span, 0, 0, lens.current.width, lens.current.height);
  };
  const spec = p.textile.spec;
  const parts: { label: string; r: [number, number] }[] = [
    { label: "Border", r: [0.3, 0.36] },
    { label: "Body", r: [0.1, 0.2] },
    { label: "Motif", r: [0.46, 0.5] },
    { label: "Pallu", r: [0.84, 0.98] },
  ];
  return (
    <div className={styles.textile}>
      <div className={styles.tStripWrap}>
        <div ref={strip} className={styles.tStrip} onPointerMove={onMove} onPointerLeave={() => setPos(null)}>
          <TextileSwatch textile={p.textile} quality="standard" />
          <canvas ref={lens} width={320} height={320} className={styles.lens} style={{ opacity: pos ? 1 : 0, left: pos?.x ?? 0, top: pos?.y ?? 0 }} />
        </div>
        <div className={styles.tScale}>
          <span>0 m</span>
          <span>{p.textile.source === "scan" ? "The original scan, unaltered" : "The textile record"} · move over it to inspect</span>
          <span>{p.dimensions.lengthM} m</span>
        </div>
      </div>
      <div className={styles.tParts}>
        {parts.map((x) => (
          <figure key={x.label}>
            <div>
              <TextileSwatch textile={p.textile} region={x.r} quality="standard" />
            </div>
            <figcaption className="label">{x.label}</figcaption>
          </figure>
        ))}
      </div>
      <dl className={styles.tFacts}>
        <div>
          <dt>Material</dt>
          <dd>{p.fabric}</dd>
        </div>
        <div>
          <dt>Weave</dt>
          <dd>{p.weave}</dd>
        </div>
        <div>
          <dt>Technique</dt>
          <dd>{p.technique}</dd>
        </div>
        <div>
          <dt>Dimensions</dt>
          <dd>
            {p.dimensions.lengthM} × {p.dimensions.widthM} m{p.dimensions.blousePieceM ? ` + ${p.dimensions.blousePieceM} m blouse piece` : ""}
          </dd>
        </div>
        <div>
          <dt>Weight</dt>
          <dd>{p.weightG} g</dd>
        </div>
        <div>
          <dt>Origin</dt>
          <dd>
            {p.region}, {p.state}
          </dd>
        </div>
        {spec && (
          <div>
            <dt>Zari</dt>
            <dd>{spec.border.zari || spec.motif.zari || spec.pallu.zari ? "Woven metallic thread" : "None"}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
