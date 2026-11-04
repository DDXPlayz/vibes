"use client";

import Link from "next/link";
import { price } from "@/lib/format";
import { canPurchase, type ProductView } from "@/lib/view";
import { RenderImage } from "./RenderImage";
import { useStore } from "./StoreProvider";

export function BagView({ products }: { products: ProductView[] }) {
  const { bag, setQuantity, removeFromBag } = useStore();
  const lines = bag.map((l) => ({ l, p: products.find((x) => x.id === l.productId) })).filter((x) => x.p);
  const subtotal = lines.reduce((s, { l, p }) => s + p!.price * l.quantity, 0);
  return (
    <div className="wrap section">
      <span className="eyebrow">Your bag</span>
      <h1 className="h2" style={{ marginTop: 20 }}>{lines.length ? <>Chosen with <em>care.</em></> : <>Nothing here, <em>yet.</em></>}</h1>
      {lines.length === 0 ? (
        <Link href="/collection" className="btn" style={{ marginTop: 40 }}>Explore the collection</Link>
      ) : (
        <div className="grid-2" style={{ marginTop: 64, gridTemplateColumns: "1.6fr 1fr", alignItems: "start" }}>
          <div style={{ borderTop: "1px solid var(--line)" }}>
            {lines.map(({ l, p }) => {
              const ok = canPurchase(p!);
              return (
                <div key={l.productId} style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 24, padding: "24px 0", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
                  <Link href={`/saree/${p!.slug}`} className="stage" style={{ aspectRatio: "3/4", position: "relative" }}>
                    <RenderImage product={p!} view="full" width={240} height={320} />
                  </Link>
                  <div style={{ display: "grid", gap: 4 }}>
                    <span className="serif" style={{ fontSize: 26 }}>{p!.name}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{p!.weave} · {p!.region}</span>
                    {!ok && <span className="badge reserved">No longer available</span>}
                    {p!.inventoryModel !== "unique" && ok && (
                      <label className="row" style={{ gap: 8, fontSize: 13 }}>
                        Quantity
                        <select className="select" style={{ width: 60 }} value={l.quantity} onChange={(e) => setQuantity(l.productId, +e.target.value)}>
                          {Array.from({ length: Math.max(1, p!.available) }, (_, i) => i + 1).map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button className="link" style={{ justifySelf: "start", marginTop: 8 }} onClick={() => removeFromBag(l.productId)}>Remove</button>
                  </div>
                  <span className="serif" style={{ fontSize: 22 }}>{price(p!.price * l.quantity)}</span>
                </div>
              );
            })}
          </div>
          <aside className="stack" style={{ position: "sticky", top: 100, padding: 32, background: "var(--surface)" }}>
            <span className="label">Summary</span>
            <dl className="kv">
              <dt>Subtotal</dt><dd>{price(subtotal)}</dd>
              <dt>Shipping</dt><dd>Complimentary, insured</dd>
              <dt>Total</dt><dd className="serif" style={{ fontSize: 22 }}>{price(subtotal)}</dd>
            </dl>
            <Link href="/checkout" className="btn btn-block">Checkout</Link>
            <p className="muted" style={{ fontSize: 12 }}>One-of-one pieces are held for you for 30 minutes once you begin checkout.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
