"use client";

import { useEffect, useRef, useState } from "react";
import { StudioCanvas } from "@/components/three/StudioCanvas";
import type { SiteContent } from "@/lib/types";
import type { ProductView } from "@/lib/view";
import { TextileSwatch } from "../TextileSwatch";
import styles from "./home.module.css";

/**
 * "Not just a saree." — a scroll-driven story: the flat textile is recorded,
 * then is draped on the model. Scroll position is the only clock.
 */
export function Idea({ content, product }: { content: SiteContent["idea"]; product: ProductView }) {
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = section.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        const v = Math.min(1, Math.max(0, -r.top / total));
        setP(v);
        // drape follows the last 55% of the scroll
        progress.current = Math.min(1, Math.max(0, (v - 0.42) / 0.5));
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);

  const step = p < 0.3 ? 0 : p < 0.55 ? 1 : 2;
  const flat = Math.max(0, Math.min(1, 1 - (p - 0.38) / 0.2));
  const scan = Math.min(1, Math.max(0, (p - 0.22) / 0.2));

  return (
    <section ref={section} className={styles.idea} aria-label={content.headline}>
      <div className={styles.ideaSticky}>
        <div className={`wrap ${styles.ideaGrid}`}>
          <div className={styles.ideaText}>
            <span className="eyebrow">{content.eyebrow}</span>
            <h2 className="h2" style={{ marginTop: 28 }}>
              {content.headline}
            </h2>
            <ol className={styles.steps}>
              {content.steps.map((s, i) => (
                <li key={i} className={i === step ? styles.stepOn : ""}>
                  <span className="num">0{i + 1}</span>
                  <div>
                    <h3 className="h4">{s.title}</h3>
                    <p className="body">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className={`stage ${styles.ideaStage}`}>
            <StudioCanvas item={product} mode={{ kind: "scroll", progress }} fallback={<TextileSwatch textile={product.textile} folded />} />
            <div
              className={styles.flatTextile}
              style={{
                opacity: flat,
                transform: `translate(-50%, -50%) rotate(-90deg) scale(${0.9 + flat * 0.1})`,
              }}
            >
              <TextileSwatch textile={product.textile} />
              <div className={styles.scanLine} style={{ transform: `translateX(${scan * 100}%)`, opacity: scan > 0 && scan < 1 ? 1 : 0 }} />
              <div className={styles.scanMeta} style={{ opacity: scan }}>
                <span>5.50 m × 1.15 m</span>
                <span>Recorded once</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
