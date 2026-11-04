"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { num, price } from "@/lib/format";
import type { ProductView } from "@/lib/view";
import { AdminThumb } from "./AdminThumb";

export function ProductsTable({ rows }: { rows: { v: ProductView; sku: string; qty: number; updatedAt: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const list = useMemo(
    () =>
      rows.filter(({ v, sku }) => {
        if (status === "draft" && v.status !== "draft") return false;
        if (status === "published" && v.status !== "published") return false;
        if (["available", "reserved", "sold", "archived", "private"].includes(status) && v.availability !== status) return false;
        const hay = `${v.name} ${v.weave} ${v.fabric} ${v.region} ${sku} ${v.number}`.toLowerCase();
        return !q || hay.includes(q.toLowerCase());
      }),
    [rows, q, status],
  );
  return (
    <div>
      <div className="adm-head">
        <div>
          <h1 className="adm-h1">Products</h1>
          <p>{rows.length} sarees in the house — including the archive.</p>
        </div>
        <span className="spacer" />
        <Link href="/admin/products/new" className="btn">+ Add a saree</Link>
      </div>
      <div className="row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <input className="input" placeholder="Search by name, weave, SKU…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
          <option value="private">Private</option>
        </select>
        <span className="adm-note">{list.length} shown</span>
      </div>
      <div className="adm-card adm-table-wrap" style={{ padding: 0 }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th />
              <th>No.</th>
              <th>Name</th>
              <th>Weave · Fabric</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            {list.map(({ v, sku, qty }) => (
              <tr key={v.id} className="click" onClick={() => router.push(`/admin/products/${v.id}`)}>
                <td style={{ width: 60 }}><AdminThumb p={v} /></td>
                <td className="adm-note">{num(v.number)}<br />{sku}</td>
                <td><span className="serif" style={{ fontSize: 19 }}>{v.name}</span><br /><span className="adm-note">{v.artisan?.name ?? "—"}</span></td>
                <td>{v.weave}<br /><span className="adm-note">{v.fabric}</span></td>
                <td>{price(v.price)}</td>
                <td>{v.inventoryModel === "unique" ? "1 of 1" : `${qty} (${v.inventoryModel})`}</td>
                <td><span className={`adm-pill ${v.status}`}>{v.status}</span></td>
                <td><span className={`adm-pill ${v.availability}`}>{v.availability}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
