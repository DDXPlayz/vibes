import { notFound } from "next/navigation";
import { ProductCard } from "@/components/store/ProductCard";
import { TextileSwatch } from "@/components/store/TextileSwatch";
import { read } from "@/server/db";
import { mediaUrl } from "@/server/storage";
import { storefrontProducts } from "@/server/catalog";

export default async function ArtisanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await read((db) => db.artisans.find((x) => x.slug === slug));
  if (!a) notFound();
  const pieces = (await storefrontProducts()).filter((p) => p.artisan?.id === a.id);
  const portrait = mediaUrl(a.portraitKey);
  return (
    <div className="wrap section">
      <div className="grid-2" style={{ alignItems: "end" }}>
        <div className="stack">
          <span className="eyebrow">{a.community}</span>
          <h1 className="h1">{a.name}</h1>
          <p className="label">{a.region}, {a.state} · weaving since {a.since}</p>
        </div>
        <p className="serif italic" style={{ fontSize: "clamp(26px, 3vw, 40px)", lineHeight: 1.25, margin: 0, color: "var(--ink-2)" }}>“{a.quote}”</p>
      </div>
      <div className="grid-2" style={{ marginTop: 96, alignItems: "start" }}>
        <div style={{ aspectRatio: "4/5", overflow: "hidden", position: "relative" }}>
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            pieces[0] && <TextileSwatch textile={pieces[0].textile} region={[0.78, 0.9]} quality="standard" />
          )}
        </div>
        <div className="stack">
          <p className="lede">{a.bio}</p>
          <p className="body">{a.story}</p>
          <dl className="kv" style={{ marginTop: 32 }}>
            <dt>Tradition</dt><dd>{a.tradition}</dd>
            <dt>Techniques</dt><dd>{a.techniques.join(" · ")}</dd>
            <dt>Region</dt><dd>{a.region}, {a.state}</dd>
          </dl>
        </div>
      </div>
      {pieces.length > 0 && (
        <section style={{ marginTop: 140 }}>
          <span className="eyebrow">From this loom</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 40, marginTop: 40 }}>
            {pieces.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
