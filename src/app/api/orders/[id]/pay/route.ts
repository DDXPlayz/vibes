import { NextResponse } from "next/server";
import { mutate } from "@/server/db";
import { transitionOrder } from "@/server/inventory";

/**
 * Payment confirmation. In production this is the payment gateway's
 * webhook (Razorpay / Stripe), verified by signature; here the checkout
 * page calls it directly to complete the flow.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await mutate((db) => {
    const o = db.orders.find((x) => x.id === id);
    if (!o || o.status !== "pending") return null;
    transitionOrder(db, o, "paid");
    return o;
  });
  if (!order) return NextResponse.json({ error: "Order not found or already paid" }, { status: 404 });
  return NextResponse.json({ order });
}
