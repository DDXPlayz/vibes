import Link from "next/link";
import { RevealOnScroll } from "@/components/store/RevealOnScroll";
import { TextileSwatch } from "@/components/store/TextileSwatch";
import { read } from "@/server/db";
import { storefrontProducts } from "@/server/catalog";

export const metadata = { title: "Artisans" };

export default async function ArtisansPage() {
  const [artisans, products] = await Promise.all([read((db) => db.artisans), storefrontProducts()]);
  return (
    <div className="wrap section">
      <span className="eyebrow">Artisans</span>
      <h1 className="h1" style={{ marginTop: 24, maxWidth: "12ch" }}>The hands <em>behind the cloth.</em></h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "72px 40px", marginTop: 96 }}>
        {artisans.map((a, i) => {
          const pieces = products.filter((p) => p.artisan?.id === a.id);
          const p = pieces[0] ?? products[i % products.length];
          return (
            <Link key={a.id} href={`/artisans/${a.slug}`} className="stack reveal" style={{ ["--d" as string]: `${(i % 3) * 120}ms` }}>
              <div style={{ aspectRatio: "4/5", overflow: "hidden" }}>{p && <TextileSwatch textile={p.textile} region={[0.8, 0.9]} quality="standard" />}</div>
              <span className="label">{a.region}, {a.state} · since {a.since}</span>
              <h2 className="h4" style={{ fontSize: 30 }}>{a.name}</h2>
              <p className="body" style={{ marginTop: 8 }}>{a.tradition}. {pieces.length ? `${pieces.length} ${pieces.length === 1 ? "piece" : "pieces"} in the house.` : ""}</p>
            </Link>
          );
        })}
      </div>
      <RevealOnScroll />
    </div>
  );
}
