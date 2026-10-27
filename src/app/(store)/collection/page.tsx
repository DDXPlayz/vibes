import { Catalogue } from "@/components/store/catalogue/Catalogue";
import { read } from "@/server/db";
import { storefrontProducts } from "@/server/catalog";

export const metadata = { title: "The collection" };

export default async function CollectionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [products, collections] = await Promise.all([storefrontProducts(), read((db) => db.collections.sort((a, b) => a.order - b.order).map((c) => ({ slug: c.slug, name: c.name })))]);
  return <Catalogue products={products} collections={collections} initial={{ q: sp.q, availability: sp.availability, collection: sp.collection, view: sp.view }} />;
}
