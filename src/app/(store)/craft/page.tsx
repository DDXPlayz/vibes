import Link from "next/link";
import { RenderImage } from "@/components/store/RenderImage";
import { TextileSwatch } from "@/components/store/TextileSwatch";
import { RevealOnScroll } from "@/components/store/RevealOnScroll";
import { read } from "@/server/db";
import { storefrontProducts } from "@/server/catalog";

export const metadata = { title: "The craft" };

const TECHNIQUES = [
  { name: "Kadwa", where: "Varanasi", body: "Each motif woven as its own island — the weft turned back at its edge rather than floated across. Slower by weeks; cleaner forever." },
  { name: "Korvai", where: "Kanchipuram", body: "Border and body in different colours, interlocked by hand at every pass of the shuttle. Two weavers, one loom." },
  { name: "Jamdani", where: "Bengal", body: "Motifs placed by hand with bamboo picks, the pattern held in memory, on cotton fine enough to read through." },
  { name: "Ikat", where: "Patan · Pochampally · Odisha", body: "The yarn is tied and dyed before weaving. The feathered edge where dye crept beneath the tie is the proof of hand." },
  { name: "Zari", where: "Across India", body: "Metallic thread — silver wrapped around silk, often gilded. Real zari tarnishes gently and is valued by weight." },
];

export default async function CraftPage() {
  const [products, stories] = await Promise.all([storefrontProducts(), read((db) => db.stories.filter((s) => s.published))]);
  const hero = products.find((p) => p.id === "p-007") ?? products[0];
  return (
    <div>
      <section className="wrap section" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "var(--s-8)", alignItems: "center" }}>
        <div className="stack">
          <span className="eyebrow">The craft</span>
          <h1 className="h1">Made by hands that <em>remember.</em></h1>
          <p className="lede">Every saree in our house is handwoven. Most will never be made again. This is how they come to be — and how we keep their story attached to the cloth.</p>
        </div>
        <div className="stage" style={{ aspectRatio: "4/5", position: "relative" }}>
          {hero && <RenderImage product={hero} view="pallu" width={800} height={1000} priority />}
        </div>
      </section>
      <section className="wrap section-tight">
        {TECHNIQUES.map((t, i) => (
          <div key={t.name} className="reveal" style={{ display: "grid", gridTemplateColumns: "80px 1fr 1.4fr", gap: "var(--s-6)", padding: "40px 0", borderTop: "1px solid var(--line)", alignItems: "baseline" }}>
            <span className="num">0{i + 1}</span>
            <div>
              <h2 className="h3">{t.name}</h2>
              <span className="label">{t.where}</span>
            </div>
            <p className="body" style={{ fontSize: 17 }}>{t.body}</p>
          </div>
        ))}
      </section>
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <span className="eyebrow">Notes from the loom</span>
          <div className="grid-2" style={{ marginTop: 48 }}>
            {stories.map((s) => {
              const p = products.find((x) => s.productIds.includes(x.id));
              return (
                <article key={s.id} className="stack reveal">
                  <div style={{ aspectRatio: "16/9", overflow: "hidden" }}>{p && <TextileSwatch textile={p.textile} region={[0.8, 0.98]} quality="standard" />}</div>
                  <h3 className="h3">{s.title}</h3>
                  <p className="lede" style={{ fontSize: 20 }}>{s.excerpt}</p>
                  <p className="body">{s.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <section className="wrap section" id="care">
        <div className="grid-2">
          <div className="stack">
            <span className="eyebrow">Caring for handloom</span>
            <h2 className="h2">To last <em>generations.</em></h2>
          </div>
          <dl className="kv">
            <dt>Silk</dt><dd>Dry clean. Air it in shade after each wear. Never hang for long — fold.</dd>
            <dt>Zari</dt><dd>Wrap in muslin, away from perfume and humidity. Refold along new lines every few months.</dd>
            <dt>Cotton</dt><dd>Cold hand wash, separately, the first few times. Dry in shade, iron while damp.</dd>
            <dt>Storage</dt><dd>Muslin or cotton, never plastic. A few neem leaves, not mothballs.</dd>
          </dl>
        </div>
        <Link href="/artisans" className="btn btn-ghost" style={{ marginTop: 64 }}>Meet the weavers</Link>
      </section>
      <RevealOnScroll />
    </div>
  );
}
