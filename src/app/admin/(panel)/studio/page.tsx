import { DigitalStudio } from "@/components/admin/DigitalStudio";
import { read } from "@/server/db";
import { toView } from "@/server/catalog";

export const metadata = { title: "Digital Studio" };

export default async function StudioPage() {
  const { products, settings } = await read((db) => ({ products: db.products.map((p) => toView(db, p)), settings: db.studio }));
  return <DigitalStudio products={products} settings={settings} />;
}
