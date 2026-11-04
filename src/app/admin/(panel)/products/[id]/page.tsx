import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { read } from "@/server/db";
import { toView } from "@/server/catalog";
import { currentSession } from "@/server/auth";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await currentSession();
  const data = await read((db) => {
    const p = db.products.find((x) => x.id === id);
    if (!p) return null;
    return { product: p, view: toView(db, p), textile: db.textiles.find((t) => t.id === p.textileId) ?? null, artisans: db.artisans, collections: db.collections, orders: db.orders.filter((o) => o.lines.some((l) => l.productId === id)).length };
  });
  if (!data) notFound();
  return <ProductEditor {...data} role={session?.role ?? "staff"} />;
}
