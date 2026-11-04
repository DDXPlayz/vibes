"use client";

import { useState } from "react";
import { date, price } from "@/lib/format";
import type { Customer, Order } from "@/lib/types";
import { SaveStatus, api, useSaver } from "./ui";

const FLOW: Order["status"][] = ["pending", "paid", "shipped", "delivered"];

export function OrdersTable({ orders, open }: { orders: (Order & { customer: Customer | null })[]; open?: string }) {
  const [sel, setSel] = useState<string | undefined>(open ?? orders[0]?.id);
  const saver = useSaver();
  const o = orders.find((x) => x.id === sel);
  return (
    <div>
      <div className="adm-head">
        <div>
          <h1 className="adm-h1">Orders</h1>
          <p>Marking an order paid moves its sarees out of stock; cancelling returns them.</p>
        </div>
      </div>
      <div className="adm-split" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)" }}>
        <div className="adm-card adm-table-wrap" style={{ padding: 0 }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((x) => (
                <tr key={x.id} className="click" onClick={() => setSel(x.id)} style={x.id === sel ? { background: "var(--purple-wash)" } : undefined}>
                  <td>{x.number}</td>
                  <td>{x.customer?.name}</td>
                  <td>{price(x.total)}</td>
                  <td><span className={`adm-pill ${x.status}`}>{x.status}</span></td>
                  <td className="adm-note">{date(x.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {o && (
          <div className="adm-card" style={{ position: "sticky", top: 84 }}>
            <div className="row">
              <h2 style={{ margin: 0 }}>{o.number}</h2>
              <span className="spacer" />
              <SaveStatus state={saver.state} error={saver.error} />
            </div>
            <dl className="kv" style={{ marginTop: 16 }}>
              {o.lines.map((l) => (
                <div key={l.productId} style={{ display: "contents" }}>
                  <dt>{l.quantity} ×</dt>
                  <dd>{l.name} · {price(l.price * l.quantity)}</dd>
                </div>
              ))}
              <dt>Total</dt>
              <dd>{price(o.total)}</dd>
              <dt>Customer</dt>
              <dd>{o.customer?.name} · {o.customer?.email}</dd>
              <dt>Ship to</dt>
              <dd>{o.address.line1}, {o.address.city}, {o.address.state} {o.address.pincode} · {o.address.phone}</dd>
              {o.note && (
                <>
                  <dt>Note</dt>
                  <dd>{o.note}</dd>
                </>
              )}
            </dl>
            <h3 className="label" style={{ margin: "20px 0 10px" }}>Status</h3>
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              {[...FLOW, "cancelled" as const].map((s) => (
                <button key={s} className={`btn btn-sm ${o.status === s ? "" : "btn-ghost"}`} disabled={o.status === s || (o.status === "cancelled")} onClick={() => saver.run(() => api(`/api/admin/orders/${o.id}`, "PATCH", { status: s }))}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
