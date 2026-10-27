"use client";

import Link from "next/link";
import { useState } from "react";
import { StudioCanvas } from "@/components/three/StudioCanvas";
import { num, price } from "@/lib/format";
import type { SiteContent } from "@/lib/types";
import type { ProductView } from "@/lib/view";
import { TextileSwatch } from "../TextileSwatch";
import styles from "./home.module.css";

export function Hero({ content, sequence }: { content: SiteContent["hero"]; sequence: ProductView[] }) {
  const [i, setI] = useState(0);
  const cur = sequence[i] ?? sequence[0];
  if (!cur) return null;
  return (
    <section className={`stage ${styles.hero}`}>
      <div className={styles.wordmark} aria-hidden>
        {content.headline}
      </div>
      <StudioCanvas
        item={sequence[0]}
        beam
        mode={{ kind: "hero", sequence, holdSeconds: content.intervalSeconds, onChange: setI }}
        fallback={<TextileSwatch textile={cur.textile} folded />}
      />
      <div className={`wrap ${styles.heroFoot}`}>
        <div className={styles.heroCopy}>
          <h1 className="sr-only">VIBES — {content.tagline}</h1>
          <p className={`serif italic ${styles.tagline}`}>{content.tagline}</p>
          <div className={styles.ctas}>
            <Link href="/collection" className="btn">
              {content.primaryCta}
            </Link>
            <Link href="/craft" className="btn btn-ghost">
              {content.secondaryCta}
            </Link>
          </div>
        </div>
        <Link href={`/saree/${cur.slug}`} className={styles.caption} key={cur.id}>
          <span className="num">No. {num(cur.number)}</span>
          <span className={styles.capName}>{cur.name}</span>
          <span className={`${styles.capSub} ${styles.capMeta}`}>
            {cur.weave} · {cur.region}
            {cur.artisan ? ` · ${cur.artisan.name}` : ""}
          </span>
          <span className={styles.capSub}>{price(cur.price)}</span>
          <span className={styles.dots} aria-hidden>
            {sequence.map((s, k) => (
              <i key={s.id} className={k === i ? styles.on : ""} />
            ))}
          </span>
        </Link>
      </div>
      <div className={styles.scrollCue} aria-hidden>
        <span />
      </div>
    </section>
  );
}
