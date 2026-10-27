import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/store/ProductCard";
import { RenderImage } from "@/components/store/RenderImage";
import { read } from "@/server/db";
import { storefrontProducts } from "@/server/catalog";

export default async function CollectionStory({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await read((db) => db.collections.find((x) => x.slug === slug));
  if (!c) notFound();
  const all = await storefrontProducts();
  const pieces = all.filter((p) => p.collections.some((x) => x.id === c.id));
  const cover = all.find((p) => p.id === c.coverProductId) ?? pieces[0];
  return (
    <div>
      <section className="wrap section" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: "var(--s-8)", alignItems: "center" }}>
        <div className="stack">
          <span className="eyebrow">{c.kind} · {pieces.length} pieces</span>
          <h1 className="h1">{c.name}</h1>
          <p className="serif italic" style={{ fontSize: 30, margin: 0, color: "var(--purple)" }}>{c.tagline}</p>
          <p className="lede">{c.description}</p>
          <Link href={`/collection?collection=${c.slug}`} className="link">Filter the collection →</Link>
        </div>
        <div className="stage" style={{ aspectRatio: "3/4", position: "relative" }}>{cover && <RenderImage product={cover} view="three-quarter" width={720} height={960} priority />}</div>
      </section>
      <section className="wrap section-tight">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 40 }}>
          {pieces.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>
    </div>
  );
}
