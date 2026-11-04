"use client";

import { useState } from "react";
import { num } from "@/lib/format";
import type { Inventory } from "@/lib/types";
import { SaveStatus, api, useSaver } from "./ui";

type Row = { id: string; number: number; name: string; weave: string; status: string; inventory: Inventory };

export function InventoryTable({ rows }: { rows: Row[] }) {
  const [edits, setEdits] = useState<Record<string, Inventory>>({});
  const saver = useSaver();
  const inv = (r: Row) => edits[r.id] ?? r.inventory;
  const edit = (r: Row, p: Partial<Inventory>) => setEdits((e) => ({ ...e, [r.id]: { ...inv(r), ...p } }));
  const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r.inventory.state] = (m[r.inventory.state] ?? 0) + 1), m), {});
  return (
    <div>
      <div className="adm-head">
        <div>
          <h1 className="adm-h1">Inventory</h1>
          <p>Most pieces are one of one. Sold pieces stay in the archive.</p>
        </div>
        <span className="spacer" />
        <SaveStatus state={saver.state} error={saver.error} />
        <button
          className="btn btn-sm"
          disabled={!Object.keys(edits).length}
          onClick={() =>
            saver.run(async () => {
              for (const [id, inventory] of Object.entries(edits)) await api(`/api/admin/products/${id}`, "PATCH", { inventory });
              setEdits({});
            })
          }
        >
          Save {Object.keys(edits).length || ""} change{Object.keys(edits).length === 1 ? "" : "s"}
        </button>
      </div>
      <div className="adm-stats" style={{ marginBottom: 20 }}>
        {(["available", "reserved", "sold", "archived", "private"] as const).map((s) => (
          <div className="adm-stat" key={s}>
            <span className="label">{s}</span>
            <div className="v">{counts[s] ?? 0}</div>
          </div>
        ))}
      </div>
      <div className="adm-card adm-table-wrap" style={{ padding: 0 }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Saree</th>
              <th>SKU</th>
              <th>Model</th>
              <th>Quantity</th>
              <th>Reserved</th>
              <th>State</th>
              <th>Quick actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const i = inv(r);
              const changed = !!edits[r.id];
              return (
                <tr key={r.id} style={changed ? { background: "var(--gold-wash)" } : undefined}>
                  <td className="adm-note">{num(r.number)}</td>
                  <td>
                    <span className="serif" style={{ fontSize: 18 }}>{r.name}</span>
                    <br />
                    <span className="adm-note">{r.weave}{r.status === "draft" ? " · draft" : ""}</span>
                  </td>
                  <td className="adm-note">{i.sku}</td>
                  <td>
                    <select className="select" value={i.model} onChange={(e) => edit(r, { model: e.target.value as Inventory["model"], quantity: e.target.value === "unique" ? Math.min(1, i.quantity) : i.quantity })} style={{ minWidth: 110 }}>
                      <option value="unique">One of one</option>
                      <option value="limited">Limited</option>
                      <option value="multiple">Multiple</option>
                    </select>
                  </td>
                  <td>
                    <input className="input" type="number" min={0} max={i.model === "unique" ? 1 : undefined} value={i.quantity} onChange={(e) => edit(r, { quantity: Math.max(0, +e.target.value) })} style={{ width: 72 }} />
                  </td>
                  <td>{i.reserved}</td>
                  <td>
                    <select className="select" value={i.state} onChange={(e) => edit(r, { state: e.target.value as Inventory["state"] })} style={{ minWidth: 120 }}>
                      <option value="available">Available</option>
                      <option value="reserved">Reserved</option>
                      <option value="sold">Sold</option>
                      <option value="archived">Archived</option>
                      <option value="private">Private</option>
                    </select>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      {i.state === "available" && <button className="btn btn-ghost btn-sm" onClick={() => edit(r, { state: "reserved", reserved: Math.min(i.quantity, i.reserved + 1) })}>Hold</button>}
                      {i.state === "reserved" && <button className="btn btn-ghost btn-sm" onClick={() => edit(r, { state: "available", reserved: 0 })}>Release</button>}
                      {(i.state === "available" || i.state === "reserved") && <button className="btn btn-ghost btn-sm" onClick={() => edit(r, { state: i.quantity <= 1 ? "sold" : "available", quantity: Math.max(0, i.quantity - 1), reserved: Math.max(0, i.reserved - 1) })}>Sold in store</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
