"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useReveal } from "@/hooks/useReveal";
import { cx } from "@/lib/format";
import type { Artisan, Collection, SiteContent } from "@/lib/types";
import type { ProductView } from "@/lib/view";
import { ArrowIcon } from "../Icons";
import { ProductCard } from "../ProductCard";
import { RenderImage } from "../RenderImage";
import { TextileSwatch } from "../TextileSwatch";
import styles from "./home.module.css";

export function Reveal() {
  useReveal();
  return null;
}

/* ───────── The collection — an asymmetric gallery hang ───────── */
export function CollectionGallery({ headline, products }: { headline: string; products: ProductView[] }) {
  return (
    <section className="section">
      <div className="wrap">
        <div className={styles.secHead}>
          <span className="eyebrow reveal">The collection</span>
          <h2 className="h2 reveal" style={{ ["--d" as string]: "120ms" }}>
            {headline === "The collection" ? (
              <>
                Each one, <em>the only one.</em>
              </>
            ) : (
              headline
            )}
          </h2>
          <Link href="/collection" className="link reveal" style={{ ["--d" as string]: "240ms" }}>
            View all <ArrowIcon />
          </Link>
        </div>
        <div className={styles.hang}>
          {products.map((p, i) => (
            <div key={p.id} className={cx("reveal", styles.hangItem, styles[`h${i % 8}`])} style={{ ["--d" as string]: `${(i % 3) * 140}ms` }}>
              <ProductCard p={p} size={i % 8 === 0 || i % 8 === 5 ? "lg" : "md"} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Craft ───────── */
export function Craft({ content, artisans, products }: { content: SiteContent["craft"]; artisans: Artisan[]; products: ProductView[] }) {
  const macro = products[0];
  const img = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = () => {
      const el = img.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const t = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      el.style.setProperty("--py", `${t * -60}px`);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <section className={cx("section", styles.craft)} id="craft">
      <div className="wrap">
        <div className={styles.craftGrid}>
          <div ref={img} className={cx("reveal", styles.macro)}>
            {macro && <RenderImage product={macro} view="pallu" width={900} height={1125} />}
            <span className={styles.macroCap}>{macro ? `${macro.weave}, ${macro.region} — the pallu` : ""}</span>
          </div>
          <div className={styles.craftText}>
            <span className="eyebrow reveal">The craft</span>
            <h2 className="h2 reveal">{content.headline}</h2>
            <p className="lede reveal">{content.body}</p>
            <Link href="/craft" className="link reveal">
              Read about the craft <ArrowIcon />
            </Link>
          </div>
        </div>
        <div className={styles.artisans}>
          {artisans.map((a, i) => {
            const piece = products.find((p) => p.artisan?.id === a.id);
            return (
              <Link href={`/artisans/${a.slug}`} key={a.id} className={cx("reveal", styles.artisan)} style={{ ["--d" as string]: `${i * 140}ms` }}>
                <div className={styles.artisanImg}>{piece && <TextileSwatch textile={piece.textile} region={[0.78, 0.92]} quality="standard" />}</div>
                <span className="label">{a.region}, {a.state}</span>
                <h3 className="h4">{a.name}</h3>
                <p className="serif italic" style={{ fontSize: 19, color: "var(--ink-2)", margin: 0 }}>“{a.quote}”</p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────── Digital draping — the pipeline as a timeline ───────── */
const PIPE = [
  { k: "Scan", t: "One photograph of the flat saree", d: "Laid on the cutting table, photographed once in even light. The original file is kept untouched — it is the record." },
  { k: "Texture", t: "Colour, weave and zari, separated", d: "The studio finds the borders and pallu, measures colour, and marks the zari so gold behaves like metal under light." },
  { k: "Drape", t: "Pleated and draped digitally", d: "The textile is mapped onto a single, consistent mannequin — pleats, wrap and pallu, in the Nivi or Seedha style." },
  { k: "Studio", t: "Lit like the gallery", d: "The same lighting rigs for every piece, so colour is comparable from one saree to the next." },
  { k: "Collection", t: "Every view, in minutes", d: "Front, back, pallu, border, weave — and an interactive 3D view. No photoshoot, no retouching, nothing redrawn." },
];

export function DrapingTimeline({ content, product }: { content: SiteContent["draping"]; product: ProductView }) {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setStep((s) => (s + 1) % PIPE.length), 4200);
    return () => clearInterval(t);
  }, [auto]);
  return (
    <section className={cx("section", styles.draping)}>
      <div className="wrap">
        <div className={styles.secHead}>
          <span className="eyebrow reveal">Digital draping</span>
          <h2 className="h2 reveal">{content.headline}</h2>
          <p className="body reveal">{content.body}</p>
        </div>
        <div className={styles.pipe}>
          <ol className={styles.pipeSteps}>
            {PIPE.map((s, i) => (
              <li key={s.k}>
                <button
                  className={cx(styles.pipeBtn, i === step && styles.pipeOn)}
                  onClick={() => {
                    setAuto(false);
                    setStep(i);
                  }}
                >
                  <span className="num">0{i + 1}</span>
                  <span className={styles.pipeK}>{s.k}</span>
                  <span className={styles.pipeBar}>{i === step && auto && <i />}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.pipeView}>
            <div className={cx("stage", styles.pipeStage)}>
              <PipeVisual step={step} product={product} />
            </div>
            <div className={styles.pipeCopy} key={step}>
              <h3 className="h3">{PIPE[step].t}</h3>
              <p className="body">{PIPE[step].d}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PipeVisual({ step, product }: { step: number; product: ProductView }) {
  return (
    <div className={styles.pv}>
      <div className={cx(styles.pvLayer, step === 0 && styles.pvOn)}>
        <div className={styles.pvScan}>
          <TextileSwatch textile={product.textile} />
          <span className={styles.pvSweep} />
          <span className={cx("label", styles.pvTag)}>original.jpg · untouched</span>
        </div>
      </div>
      <div className={cx(styles.pvLayer, step === 1 && styles.pvOn)}>
        <div className={styles.pvChannels}>
          {[
            { r: [0.1, 0.3] as [number, number], l: "Body" },
            { r: [0.4, 0.48] as [number, number], l: "Border" },
            { r: [0.82, 0.98] as [number, number], l: "Pallu" },
          ].map((c) => (
            <figure key={c.l}>
              <TextileSwatch textile={product.textile} region={c.r} />
              <figcaption className="label">{c.l}</figcaption>
            </figure>
          ))}
          <div className={styles.palette}>
            {[product.textile.spec?.base, product.textile.spec?.border.color, product.textile.spec?.motif.color, product.blouse].filter(Boolean).map((c, i) => (
              <span key={i} style={{ background: c }} title={c} />
            ))}
          </div>
        </div>
      </div>
      <div className={cx(styles.pvLayer, step === 2 && styles.pvOn)}>
        <RenderImage product={product} view="full" width={520} height={693} />
      </div>
      <div className={cx(styles.pvLayer, step === 3 && styles.pvOn)}>
        <div className={styles.pvLights}>
          {(["gallery", "daylight", "dusk"] as const).map((l) => (
            <figure key={l}>
              <RenderImage product={{ ...product, drape: { ...product.drape, lighting: l } }} view="three-quarter" width={300} height={420} />
              <figcaption className="label">{l}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className={cx(styles.pvLayer, step === 4 && styles.pvOn)}>
        <div className={styles.pvViews}>
          {(["front", "three-quarter", "side", "back", "pallu", "border"] as const).map((v) => (
            <figure key={v}>
              <RenderImage product={product} view={v} width={240} height={320} />
              <figcaption className="label">{v.replace("-", " ")}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────── Collection stories ───────── */
export function Stories({ headline, collections, products }: { headline: string; collections: Collection[]; products: ProductView[] }) {
  const [hover, setHover] = useState(0);
  const kinds: Record<string, string> = { region: "Region", weave: "Weave", technique: "Technique", colour: "Colour", story: "Story", community: "Community" };
  const cover = (c: Collection) => products.find((p) => p.id === c.coverProductId) ?? products.find((p) => p.collections.some((x) => x.id === c.id));
  const active = collections[hover];
  const ap = active && cover(active);
  return (
    <section className="section">
      <div className="wrap">
        <div className={styles.secHead}>
          <span className="eyebrow reveal">{headline}</span>
          <h2 className="h2 reveal">
            By region, by hand, <em>by story.</em>
          </h2>
        </div>
        <div className={styles.stories}>
          <ul className={styles.storyList}>
            {collections.map((c, i) => (
              <li key={c.id} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)}>
                <Link href={`/collections/${c.slug}`} className={cx(styles.storyRow, i === hover && styles.storyOn)}>
                  <span className="label">{kinds[c.kind]}</span>
                  <span className={styles.storyName}>{c.name}</span>
                  <span className={cx("serif italic", styles.storyTag)}>{c.tagline}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className={cx("stage", styles.storyStage)}>{ap && <RenderImage key={ap.id} product={ap} view="three-quarter" width={600} height={800} />}</div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Legacy ───────── */
export function Legacy({ content }: { content: SiteContent["legacy"] }) {
  return (
    <section className={styles.legacy}>
      <div className="wrap">
        <hr className="rule-gold reveal" style={{ margin: "0 auto" }} />
        <h2 className="h1 reveal" style={{ marginTop: 48 }}>{content.headline}</h2>
        <p className="lede reveal" style={{ margin: "40px auto 0" }}>{content.body}</p>
        <p className={cx("serif italic reveal", styles.legacySign)}>Love your legacy.</p>
        <Link href="/collection" className="btn btn-gold reveal">Begin yours</Link>
      </div>
    </section>
  );
}
