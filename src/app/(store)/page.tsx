import { Hero } from "@/components/store/home/Hero";
import { Idea } from "@/components/store/home/Idea";
import { CollectionGallery, Craft, DrapingTimeline, Legacy, Reveal, Stories } from "@/components/store/home/Sections";
import { read } from "@/server/db";
import { siteContent, storefrontProducts } from "@/server/catalog";

export default async function Home() {
  const [content, products, { artisans, collections }] = await Promise.all([
    siteContent(),
    storefrontProducts(),
    read((db) => ({ artisans: db.artisans, collections: db.collections })),
  ]);
  const pick = (ids: string[]) => ids.map((id) => products.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const heroSeq = pick(content.hero.productIds);
  const featured = pick(content.collection.productIds);
  const craftArtisans = content.craft.artisanIds.map((id) => artisans.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a);
  const storyCollections = content.stories.collectionIds.map((id) => collections.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
  const ideaProduct = heroSeq[1] ?? products[0];

  return (
    <>
      {heroSeq.length > 0 && <Hero content={content.hero} sequence={heroSeq} />}
      {ideaProduct && <Idea content={content.idea} product={ideaProduct} />}
      <CollectionGallery headline={content.collection.headline} products={featured} />
      <Craft content={content.craft} artisans={craftArtisans} products={products} />
      {heroSeq[0] && <DrapingTimeline content={content.draping} product={heroSeq[0]} />}
      <Stories headline={content.stories.headline} collections={storyCollections} products={products} />
      <Legacy content={content.legacy} />
      <Reveal />
    </>
  );
}
