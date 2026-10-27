import Link from "next/link";
import { AdminThumb } from "@/components/admin/AdminThumb";
import { date, price } from "@/lib/format";
import { read } from "@/server/db";
import { toView } from "@/server/catalog";
import { currentSession } from "@/server/auth";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const session = await currentSession();
  const d = await read((db) => {
    const now = Date.now();
    const paid = db.orders.filter((o) => o.status !== "pending" && o.status !== "cancelled");
    const last30 = paid.filter((o) => now - +new Date(o.createdAt) < 30 * 864e5);
    return {
      available: db.products.filter((p) => p.status === "published" && p.inventory.state === "available").length,
      reserved: db.products.filter((p) => p.inventory.state === "reserved"),
      sold: db.products.filter((p) => p.inventory.state === "sold").length,
      drafts: db.products.filter((p) => p.status === "draft").map((p) => toView(db, p)),
      revenue30: last30.reduce((s, o) => s + o.total, 0),
      toShip: db.orders.filter((o) => o.status === "paid"),
      pending: db.orders.filter((o) => o.status === "pending").length,
      recent: [...db.orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5).map((o) => ({ ...o, customer: db.customers.find((c) => c.id === o.customerId)?.name })),
      latest: [...db.products].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 4).map((p) => toView(db, p)),
    };
  });
  const hour = new Date().getHours();
  return (
    <div className="adm-grid" style={{ gap: 28 }}>
      <div className="adm-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="adm-h1">Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}{session ? `, ${session.name.split(" ")[0]}` : ""}.</h1>
          <p>{d.toShip.length ? `${d.toShip.length} ${d.toShip.length === 1 ? "order is" : "orders are"} waiting to be wrapped.` : "Nothing waiting to ship."}</p>
        </div>
      </div>
      <Link href="/admin/products/new" className="adm-card" style={{ display: "flex", alignItems: "center", gap: 24, background: "var(--purple-wash)", borderColor: "color-mix(in srgb, var(--purple) 30%, transparent)" }}>
        <div style={{ flex: 1 }}>
          <span className="label">New arrival?</span>
          <div className="serif" style={{ fontSize: 30, marginTop: 4 }}>Add a saree in under five minutes →</div>
          <p className="adm-note" style={{ margin: "4px 0 0" }}>One photograph, a few details. The studio drapes, lights and renders every view.</p>
        </div>
      </Link>
      <div className="adm-stats">
        <Stat label="Available now" v={d.available} s="published pieces" />
        <Stat label="Reserved" v={d.reserved.length} s="held for clients" />
        <Stat label="In the archive" v={d.sold} s="found their homes" />
        <Stat label="Revenue · 30 days" v={price(d.revenue30)} s="paid orders" />
        <Stat label="Drafts" v={d.drafts.length} s="awaiting publish" />
      </div>
      <div className="adm-split">
        <div className="adm-card">
          <h2>Recent orders</h2>
          <table className="adm-table">
            <tbody>
              {d.recent.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders?o=${o.id}`}>{o.number}</Link>
                  </td>
                  <td>{o.customer}</td>
                  <td>{price(o.total)}</td>
                  <td><span className={`adm-pill ${o.status}`}>{o.status}</span></td>
                  <td className="adm-note">{date(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="adm-card">
          <h2>Needs attention</h2>
          <ul className="adm-log">
            {d.drafts.map((p) => (
              <li key={p.id} className="done" style={{ color: "var(--ink)" }}>
                <span className="adm-pill draft">draft</span>
                <Link href={`/admin/products/${p.id}`}>{p.name}</Link> — ready to publish?
              </li>
            ))}
            {d.reserved.map((p) => (
              <li key={p.id} className="done" style={{ color: "var(--ink)" }}>
                <span className="adm-pill reserved">reserved</span>
                <Link href={`/admin/inventory`}>{p.name}</Link> — confirm or release the hold
              </li>
            ))}
            {d.pending > 0 && <li className="done" style={{ color: "var(--ink)" }}><span className="adm-pill pending">pending</span> {d.pending} checkout(s) awaiting payment</li>}
            {!d.drafts.length && !d.reserved.length && !d.pending && <li>All clear.</li>}
          </ul>
        </div>
      </div>
      <div className="adm-card">
        <h2>Latest additions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
          {d.latest.map((p) => (
            <Link key={p.id} href={`/admin/products/${p.id}`} style={{ display: "grid", gap: 8 }}>
              <AdminThumb p={p} big />
              <span className="serif" style={{ fontSize: 19 }}>{p.name}</span>
              <span className="adm-note">{price(p.price)} · <span className={`adm-pill ${p.status === "draft" ? "draft" : p.availability}`}>{p.status === "draft" ? "draft" : p.availability}</span></span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, v, s }: { label: string; v: React.ReactNode; s: string }) {
  return (
    <div className="adm-stat">
      <span className="label">{label}</span>
      <div className="v">{v}</div>
      <div className="s">{s}</div>
    </div>
  );
}
