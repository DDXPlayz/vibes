import { normalizeDrape } from "@/lib/drapeConfig";
import { AddSaree } from "@/components/admin/AddSaree";
import { read } from "@/server/db";

export const metadata = { title: "Add a saree" };

export default async function NewProduct() {
  const { artisans, collections, defaults } = await read((db) => ({ artisans: db.artisans, collections: db.collections, defaults: normalizeDrape(db.studio.defaults) }));
  return <AddSaree artisans={artisans} collections={collections} defaults={defaults} />;
}
