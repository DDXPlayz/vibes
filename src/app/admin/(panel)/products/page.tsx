import { ProductsTable } from "@/components/admin/ProductsTable";
import { read } from "@/server/db";
import { toView } from "@/server/catalog";

export const metadata = { title: "Products" };

export default async function Products() {
  const rows = await read((db) => [...db.products].sort((a, b) => b.number - a.number).map((p) => ({ v: toView(db, p), sku: p.inventory.sku, qty: p.inventory.quantity, updatedAt: p.updatedAt })));
  return <ProductsTable rows={rows} />;
}
