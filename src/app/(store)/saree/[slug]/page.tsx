import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/store/ProductCard";
import { RenderImage } from "@/components/store/RenderImage";
import { TextileSwatch } from "@/components/store/TextileSwatch";
import { ProductInfo } from "@/components/store/product/ProductInfo";
import { ProductViewer } from "@/components/store/product/ProductViewer";
import styles from "@/components/store/product/product.module.css";
import { num } from "@/lib/format";
import { mutate, read } from "@/server/db";
import { productBySlug, storefrontProducts } from "@/server/catalog";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const seo = await read((db) => db.products.find((p) => p.slug === slug)?.seo);
  return seo ? { title: seo.title.replace(/ \| VIBES$/, ""), description: seo.description } : {};
}


export default async function SareePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await productBySlug(slug);
  if (!p) notFound();
  // a light-weight view counter for analytics
  void mutate((db) => {
    const x = db.products.find((y) => y.id === p.id);
    if (x) x.views += 1;
  });
  const [artisan, all] = await Promise.all([read((db) => (p.artisan ? db.artisans.find((a) => a.id === p.artisan!.id) : undefined)), storefrontProducts()]);
  const related = all
    .filter((x) => x.id !== p.id)
    .map((x) => ({ x, s: (x.artisan?.id === p.artisan?.id && p.artisan ? 3 : 0) + (x.state === p.state ? 2 : 0) + x.collections.filter((c) => p.collections.some((d) => d.id === c.id)).length }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 4)
    .map((r) => r.x);
  const spec = p.textile.spec;
  const palette = spec
    ? [
        { c: spec.base, l: "Body" },
        { c: spec.border.color, l: "Border" },
        { c: spec.motif.color, l: "Motif" },
        { c: spec.pallu.color, l: "Pallu" },
        { c: spec.blouse, l: "Blouse" },
      ]
    : [];

  return (
    <article>
      <div className="wrap">
        <nav className="label" style={{ paddingTop: 20 }} aria-label="Breadcrumb">
          <Link href="/collection">Collection</Link> <span className="muted">/</span> <span className="muted">No. {num(p.number)}</span>
        </nav>
        <div className={styles.top}>
          <ProductViewer product={p} />
          <ProductInfo p={p} />
        </div>

        <section className={styles.chapter}>
          <span className="eyebrow">The textile</span>
          <div className="stack">
            <p className="lede">Recorded once, flat, thread for thread. Everything you see draped above comes from this single record of the real saree — nothing is redrawn.</p>
            <div className={styles.textileRow}>
              {[
                { r: [0.08, 0.22] as [number, number], l: "The body" },
                { r: [0.6, 0.72] as [number, number], l: "The border" },
                { r: [0.84, 0.98] as [number, number], l: "The pallu" },
              ].map((f) => (
                <figure key={f.l}>
                  <div>
                    <TextileSwatch textile={p.textile} region={f.r} quality="standard" />
                  </div>
                  <figcaption className="label">{f.l}</figcaption>
                </figure>
              ))}
            </div>
            {palette.length > 0 && (
              <div className={styles.palette}>
                {palette.map((x) => (
                  <span key={x.l}>
                    <i style={{ background: x.c }} />
                    {x.l}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={styles.chapter}>
          <span className="eyebrow">The craft</span>
          <div className="stack">
            <h2 className="h3">{p.technique}</h2>
            <p className="body">
              {p.weave} from {p.region}, {p.state}. {artisan?.story ?? ""}
            </p>
            <figure className={styles.editorial}>
              <div className={`stage ${styles.rimg}`}>
                <RenderImage product={p} view="back" width={900} height={1200} />
              </div>
              <figcaption className="label">The pallu, as it falls</figcaption>
            </figure>
          </div>
        </section>

        <section className={styles.chapter}>
          <span className="eyebrow">The story</span>
          <p className={styles.story}>{p.story}</p>
        </section>

        <section className={styles.chapter}>
          <span className="eyebrow">The details</span>
          <dl className="kv">
            <dt>Length</dt>
            <dd>{p.dimensions.lengthM} m</dd>
            <dt>Width</dt>
            <dd>{p.dimensions.widthM} m</dd>
            <dt>Blouse piece</dt>
            <dd>{p.dimensions.blousePieceM ? `${p.dimensions.blousePieceM} m, attached` : "Not included"}</dd>
            <dt>Weight</dt>
            <dd>
              {p.weightG} g {p.weightG <= 480 ? "· light" : p.weightG >= 750 ? "· substantial" : ""}
            </dd>
            <dt>Occasions</dt>
            <dd style={{ textTransform: "capitalize" }}>{p.occasions.join(", ") || "—"}</dd>
            <dt>Care</dt>
            <dd>{p.care}</dd>
            <dt>Record</dt>
            <dd>No. {num(p.number)} · {p.textile.source === "scan" ? "Scanned in store" : "Archive record"}</dd>
          </dl>
        </section>

        {artisan && (
          <section className={styles.chapter}>
            <span className="eyebrow">The artisan</span>
            <Link href={`/artisans/${artisan.slug}`} className={styles.artisanCard}>
              <div>
                <TextileSwatch textile={p.textile} region={[0.86, 0.94]} quality="standard" />
              </div>
              <div className="stack">
                <span className="label">
                  {artisan.community} · since {artisan.since}
                </span>
                <h2 className="h3">{artisan.name}</h2>
                <p className="serif italic" style={{ fontSize: 24, margin: 0, color: "var(--ink-2)" }}>“{artisan.quote}”</p>
                <span className="link">Meet the weaver →</span>
              </div>
            </Link>
          </section>
        )}

        <section className={styles.chapter}>
          <span className="eyebrow">Also from the house</span>
          <div className={styles.related}>
            {related.map((r) => (
              <ProductCard key={r.id} p={r} size="sm" />
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
