import { CollectionsManager } from "@/components/admin/Managers";
import { read } from "@/server/db";

export const metadata = { title: "Collections" };

export default async function Collections() {
  const data = await read((db) => ({
    collections: [...db.collections].sort((a, b) => a.order - b.order),
    products: db.products.map((p) => ({ value: p.id, label: p.name })),
    counts: Object.fromEntries(db.collections.map((c) => [c.id, db.products.filter((p) => p.collectionIds.includes(c.id)).length])),
  }));
  return <CollectionsManager {...data} />;
}
