import { InventoryTable } from "@/components/admin/InventoryTable";
import { read } from "@/server/db";

export const metadata = { title: "Inventory" };

export default async function Inventory() {
  const rows = await read((db) => db.products.map((p) => ({ id: p.id, number: p.number, name: p.name, weave: p.weave, status: p.status, inventory: p.inventory })).sort((a, b) => a.number - b.number));
  return <InventoryTable rows={rows} />;
}
