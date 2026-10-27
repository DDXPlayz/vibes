"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { price } from "@/lib/format";
import type { ProductView } from "@/lib/view";
import { useStore } from "./StoreProvider";

/**
 * Checkout foundation: address → hold (server reserves the pieces) → pay.
 * The pay step stands in for the payment gateway and calls the same
 * confirmation endpoint a gateway webhook would.
 */
export function Checkout({ products }: { products: ProductView[] }) {
  const router = useRouter();
  const { bag, clearBag } = useStore();
  const [step, setStep] = useState<"details" | "pay">("details");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<{ id: string; number: string; total: number } | null>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", line1: "", city: "", state: "", pincode: "", note: "" });
  const lines = bag.map((l) => ({ l, p: products.find((x) => x.id === l.productId) })).filter((x) => x.p);
  const total = lines.reduce((s, { l, p }) => s + p!.price * l.quantity, 0);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const place = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lines: bag.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        customer: { name: f.name, email: f.email, phone: f.phone },
        address: { line1: f.line1, city: f.city, state: f.state, pincode: f.pincode },
        note: f.note,
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setError(j.error);
    setOrder(j.order);
    setStep("pay");
  };
  const pay = async () => {
    if (!order) return;
    setBusy(true);
    const r = await fetch(`/api/orders/${order.id}/pay`, { method: "POST" });
    setBusy(false);
    if (!r.ok) return setError((await r.json()).error);
    clearBag();
    router.push(`/order/${order.number}`);
  };

  if (!lines.length && !order)
    return (
      <div className="wrap section">
        <h1 className="h2">Your bag is empty.</h1>
      </div>
    );

  return (
    <div className="wrap section">
      <span className="eyebrow">Checkout · {step === "details" ? "1 of 2" : "2 of 2"}</span>
      <div className="grid-2" style={{ marginTop: 40, gridTemplateColumns: "1.4fr 1fr", alignItems: "start" }}>
        {step === "details" ? (
          <form onSubmit={place} className="stack" style={{ maxWidth: 620 }}>
            <h1 className="h3">Where should it go?</h1>
            <div className="grid-2" style={{ gap: 24 }}>
              <label className="field"><span>Full name</span><input className="input" required value={f.name} onChange={set("name")} autoComplete="name" /></label>
              <label className="field"><span>Phone</span><input className="input" required value={f.phone} onChange={set("phone")} autoComplete="tel" /></label>
            </div>
            <label className="field"><span>Email</span><input className="input" type="email" required value={f.email} onChange={set("email")} autoComplete="email" /></label>
            <label className="field"><span>Address</span><input className="input" required value={f.line1} onChange={set("line1")} autoComplete="street-address" /></label>
            <div className="grid-2" style={{ gap: 24, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label className="field"><span>City</span><input className="input" required value={f.city} onChange={set("city")} /></label>
              <label className="field"><span>State</span><input className="input" required value={f.state} onChange={set("state")} /></label>
              <label className="field"><span>PIN code</span><input className="input" required inputMode="numeric" pattern="\d{6}" value={f.pincode} onChange={set("pincode")} /></label>
            </div>
            <label className="field"><span>A note for us (optional)</span><textarea className="textarea" value={f.note} onChange={set("note")} placeholder="A gift? A date it must arrive by?" /></label>
            {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
            <button className="btn" disabled={busy}>{busy ? "Holding your pieces…" : "Continue to payment"}</button>
          </form>
        ) : (
          <div className="stack" style={{ maxWidth: 560 }}>
            <h1 className="h3">Your pieces are held.</h1>
            <p className="body">Order {order?.number} is reserved for you. Complete payment to make it yours.</p>
            <div style={{ padding: 28, border: "1px solid var(--line-2)" }} className="stack">
              <span className="label">Payment</span>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>UPI, cards and net banking are handled by our payment partner. In this prototype the button below confirms payment directly.</p>
              <button className="btn btn-gold btn-block" onClick={pay} disabled={busy}>{busy ? "Confirming…" : `Pay ${price(order?.total ?? total)}`}</button>
            </div>
            {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
          </div>
        )}
        <aside className="stack" style={{ padding: 32, background: "var(--surface)" }}>
          <span className="label">Your order</span>
          {lines.map(({ l, p }) => (
            <div key={l.productId} className="row" style={{ justifyContent: "space-between" }}>
              <span className="serif" style={{ fontSize: 20 }}>{p!.name}{l.quantity > 1 ? ` × ${l.quantity}` : ""}</span>
              <span>{price(p!.price * l.quantity)}</span>
            </div>
          ))}
          <hr className="rule" />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="label">Total</span>
            <span className="serif" style={{ fontSize: 24 }}>{price(total)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
