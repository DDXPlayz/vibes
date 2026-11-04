import { OrdersTable } from "@/components/admin/OrdersTable";
import { read } from "@/server/db";

export const metadata = { title: "Orders" };

export default async function Orders({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o } = await searchParams;
  const orders = await read((db) => [...db.orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).map((x) => ({ ...x, customer: db.customers.find((c) => c.id === x.customerId) ?? null })));
  return <OrdersTable orders={orders} open={o} />;
}
