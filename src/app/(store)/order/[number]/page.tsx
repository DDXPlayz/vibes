import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { price } from "@/lib/format";
import { read } from "@/server/db";

export const metadata = { title: "Thank you" };

export default async function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const order = await read((db) => db.orders.find((o) => o.number === number));
  if (!order) notFound();
  return (
    <div className="wrap section" style={{ textAlign: "center", maxWidth: 760 }}>
      <hr className="rule-gold" style={{ margin: "0 auto" }} />
      <h1 className="h2" style={{ marginTop: 40 }}>
        It is <em>yours.</em>
      </h1>
      <p className="lede" style={{ margin: "28px auto" }}>
        Order {order.number} is confirmed. We will wrap it in muslin, write down where it came from, and send it to {order.address.city}.
      </p>
      <dl className="kv" style={{ textAlign: "left", marginTop: 48 }}>
        {order.lines.map((l) => (
          <Fragment key={l.productId}>
            <dt>{l.quantity} ×</dt>
            <dd>{l.name} — {price(l.price * l.quantity)}</dd>
          </Fragment>
        ))}
        <dt>Total</dt>
        <dd>{price(order.total)}</dd>
        <dt>Status</dt>
        <dd style={{ textTransform: "capitalize" }}>{order.status}</dd>
      </dl>
      <p className="serif italic gold" style={{ fontSize: 30, marginTop: 64 }}>Love your legacy.</p>
      <Link href="/collection" className="link" style={{ marginTop: 24 }}>Return to the collection</Link>
    </div>
  );
}
