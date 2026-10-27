import { price } from "@/lib/format";
import { read } from "@/server/db";

export const metadata = { title: "Analytics" };

export default async function Analytics() {
  const a = await read((db) => {
    const paid = db.orders.filter((o) => ["paid", "shipped", "delivered"].includes(o.status));
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const byMonth = new Map<string, number>();
    paid.forEach((o) => {
      const k = new Date(o.createdAt).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      byMonth.set(k, (byMonth.get(k) ?? 0) + o.total);
    });
    const views = [...db.products].sort((x, y) => y.views - x.views).slice(0, 8).map((p) => ({ name: p.name, views: p.views }));
    const totalViews = db.products.reduce((s, p) => s + p.views, 0);
    const byCollection = db.collections.map((c) => ({ name: c.name, value: db.products.filter((p) => p.collectionIds.includes(c.id) && p.status === "published").reduce((s, p) => s + (p.inventory.state === "available" ? p.price : 0), 0) })).sort((x, y) => y.value - x.value);
    const byState = new Map<string, number>();
    db.products.forEach((p) => byState.set(p.state, (byState.get(p.state) ?? 0) + 1));
    const sold = db.products.filter((p) => p.inventory.state === "sold").length;
    return { revenue, orders: paid.length, aov: paid.length ? revenue / paid.length : 0, byMonth: [...byMonth.entries()], views, totalViews, byCollection, byState: [...byState.entries()].sort((x, y) => y[1] - x[1]), sold, published: db.products.filter((p) => p.status === "published").length };
  });
  const maxM = Math.max(1, ...a.byMonth.map(([, v]) => v));
  const maxV = Math.max(1, ...a.views.map((v) => v.views));
  const maxC = Math.max(1, ...a.byCollection.map((c) => c.value));
  const maxS = Math.max(1, ...a.byState.map(([, v]) => v));
  return (
    <div className="adm-grid" style={{ gap: 24 }}>
      <div className="adm-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="adm-h1">Analytics</h1>
          <p>How the house is doing — in plain numbers.</p>
        </div>
      </div>
      <div className="adm-stats">
        <div className="adm-stat"><span className="label">Revenue</span><div className="v">{price(a.revenue)}</div><div className="s">paid, shipped & delivered</div></div>
        <div className="adm-stat"><span className="label">Orders</span><div className="v">{a.orders}</div><div className="s">avg. {price(a.aov)}</div></div>
        <div className="adm-stat"><span className="label">Product views</span><div className="v">{a.totalViews}</div><div className="s">across {a.published} published pieces</div></div>
        <div className="adm-stat"><span className="label">Sell-through</span><div className="v">{Math.round((a.sold / Math.max(1, a.published)) * 100)}%</div><div className="s">{a.sold} pieces now in the archive</div></div>
      </div>
      <div className="adm-split">
        <Bars title="Revenue by month" rows={a.byMonth.map(([k, v]) => ({ k, v, label: price(v) }))} max={maxM} gold />
        <Bars title="Most viewed sarees" rows={a.views.map((v) => ({ k: v.name, v: v.views, label: String(v.views) }))} max={maxV} />
        <Bars title="Available value by collection" rows={a.byCollection.map((c) => ({ k: c.name, v: c.value, label: price(c.value) }))} max={maxC} gold />
        <Bars title="Pieces by state of origin" rows={a.byState.map(([k, v]) => ({ k, v, label: String(v) }))} max={maxS} />
      </div>
    </div>
  );
}

function Bars({ title, rows, max, gold }: { title: string; rows: { k: string; v: number; label: string }[]; max: number; gold?: boolean }) {
  return (
    <div className="adm-card">
      <h2>{title}</h2>
      <div className="adm-grid" style={{ gap: 10 }}>
        {rows.length === 0 && <p className="adm-note">No data yet.</p>}
        {rows.map((r) => (
          <div key={r.k} className="adm-bar">
            <span style={{ width: 150, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.k}</span>
            <span className="track"><span className={`fill${gold ? " gold" : ""}`} style={{ width: `${(r.v / max) * 100}%`, display: "block" }} /></span>
            <span style={{ width: 90, textAlign: "right", fontSize: 12.5 }} className="adm-note">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
