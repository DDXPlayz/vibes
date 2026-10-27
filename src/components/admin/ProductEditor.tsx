"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StudioCanvas } from "@/components/three/StudioCanvas";
import { TextileSwatch } from "@/components/store/TextileSwatch";
import { num } from "@/lib/format";
import { can } from "@/lib/session";
import type { Artisan, Collection, DrapeConfig, Product, Render, Role, Textile, ViewId } from "@/lib/types";
import type { ProductView } from "@/lib/view";
import { ProductFields, type ProductDraft } from "./ProductFields";
import { StudioControls } from "./StudioControls";
import { SaveStatus, api, upload, useSaver } from "./ui";

type Tab = "details" | "story" | "inventory" | "textile" | "drape" | "seo";
const TABS: { id: Tab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "story", label: "Story" },
  { id: "inventory", label: "Pricing & inventory" },
  { id: "textile", label: "Textile & renders" },
  { id: "drape", label: "3D drape" },
  { id: "seo", label: "Search & SEO" },
];
const VIEWS: ViewId[] = ["full", "front", "three-quarter", "side", "back", "pallu", "border", "weave"];

export function ProductEditor({ product, view, textile, artisans, collections, orders, role }: { product: Product; view: ProductView; textile: Textile | null; artisans: Artisan[]; collections: Collection[]; orders: number; role: Role }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("details");
  const [d, setD] = useState<ProductDraft>({ ...product, inventory: { model: product.inventory.model, quantity: product.inventory.quantity, state: product.inventory.state } });
  const [drape, setDrape] = useState<DrapeConfig>(product.drape);
  const [status, setStatus] = useState(product.status);
  const [renders, setRenders] = useState<Render[]>(product.renders);
  const [rendering, setRendering] = useState<string | null>(null);
  const saver = useSaver();
  const set = (p: Partial<ProductDraft>) => setD((x) => ({ ...x, ...p }));
  const [initial] = useState(() => JSON.stringify({ d, drape, status }));
  const dirty = JSON.stringify({ d, drape, status }) !== initial;

  const save = (extra: Partial<Product> = {}) =>
    saver.run(() =>
      api(`/api/admin/products/${product.id}`, "PATCH", {
        ...d,
        inventory: { ...product.inventory, ...d.inventory },
        drape,
        status,
        // a changed drape makes stored renders stale
        renders: JSON.stringify(drape) !== JSON.stringify(product.drape) ? [] : renders,
        ...extra,
      }),
    );

  const rerender = async () => {
    const { render } = await import("@/studio/renderFarm");
    const out: Render[] = [];
    for (const v of VIEWS) {
      setRendering(v);
      const url = await render({ textile: view.textile, fibre: view.fibre, blouse: view.blouse, drape, view: v, theme: "light", width: 900, height: 1200, transparent: true, quality: "standard" });
      const up = await upload(await fetch(url).then((r) => r.blob()), "render", `${v}.webp`);
      out.push({ view: v, mediaKey: up.key, width: 900, height: 1200, createdAt: new Date().toISOString() });
    }
    setRendering(null);
    setRenders(out);
    await save({ renders: out });
  };

  return (
    <div>
      <div className="adm-head">
        <div>
          <span className="adm-note">
            <Link href="/admin/products">Products</Link> / No. {num(product.number)} · {product.inventory.sku}
          </span>
          <h1 className="adm-h1">{d.name || "Untitled"}</h1>
        </div>
        <span className="spacer" />
        <SaveStatus state={saver.state} error={saver.error} />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value as Product["status"])} style={{ width: 140 }}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <Link href={`/saree/${product.slug}`} target="_blank" className="btn btn-ghost btn-sm">Preview ↗</Link>
        <button className="btn btn-sm" onClick={() => save()} disabled={saver.state === "saving"}>
          {dirty ? "Save changes" : "Save"}
        </button>
      </div>
      <div className="adm-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="adm-split" style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }}>
        <div className="adm-card">
          {tab === "details" && <ProductFields d={d} set={set} artisans={artisans} collections={collections} sections={["essentials", "collections"]} />}
          {tab === "story" && <ProductFields d={d} set={set} artisans={artisans} collections={collections} sections={["story", "dimensions"]} />}
          {tab === "inventory" && (
            <div className="adm-grid" style={{ gap: 24 }}>
              <ProductFields d={d} set={set} artisans={artisans} collections={collections} sections={["inventory"]} />
              <div className="adm-form">
                <label className="field">
                  <span>Price (₹)</span>
                  <input className="input" type="number" value={d.price} onChange={(e) => set({ price: +e.target.value })} />
                </label>
                <div className="adm-note" style={{ alignSelf: "end" }}>
                  Reserved: {product.inventory.reserved} · Orders: {orders}
                </div>
              </div>
              <p className="adm-note">
                When a one-of-one saree sells, it moves to <b>Sold</b> automatically and stays visible in the archive. Choose <b>Private</b> for pieces shown only to a client.
              </p>
            </div>
          )}
          {tab === "textile" && (
            <div className="adm-grid" style={{ gap: 20 }}>
              <div>
                <h3 className="label" style={{ margin: "0 0 10px" }}>Textile record {textile?.source === "scan" ? "· scanned" : "· archive"}</h3>
                <div style={{ aspectRatio: "4.8", boxShadow: "var(--shadow-sm)" }}>
                  <TextileSwatch textile={view.textile} quality="standard" />
                </div>
                {textile?.originalKey && (
                  <a className="link" href={`/api/media/${textile.originalKey}`} target="_blank" rel="noreferrer" style={{ marginTop: 10 }}>
                    Original photograph ↗
                  </a>
                )}
                {textile?.analysis && (
                  <p className="adm-note">
                    Detected: {textile.analysis.pattern.replace("-", " ")} · border {Math.round(textile.analysis.borderRatio * 100)}% · pallu from {Math.round(textile.analysis.palluStart * 100)}% · zari {Math.round(textile.analysis.zariCoverage * 100)}%
                  </p>
                )}
              </div>
              <div>
                <div className="row" style={{ marginBottom: 10 }}>
                  <h3 className="label" style={{ margin: 0 }}>Stored renders</h3>
                  <span className="spacer" />
                  <button className="btn btn-ghost btn-sm" onClick={rerender} disabled={!!rendering}>
                    {rendering ? `Rendering ${rendering}…` : renders.length ? "Re-render all views" : "Render all views"}
                  </button>
                </div>
                {renders.length ? (
                  <div className="adm-renders">
                    {renders.map((r) => (
                      <figure key={r.view}>
                        <div className="img">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/media/${r.mediaKey}`} alt={r.view} />
                        </div>
                        {r.view.replace("-", " ")}
                      </figure>
                    ))}
                  </div>
                ) : (
                  <p className="adm-note">No stored renders — the store renders views on demand from the textile and caches them. Render and store them for the fastest pages.</p>
                )}
              </div>
            </div>
          )}
          {tab === "drape" && (
            <div className="adm-grid">
              <StudioControls value={drape} onChange={setDrape} compact />
              <p className="adm-note">Changing the drape clears stored renders; re-render from the Textile tab after saving.</p>
            </div>
          )}
          {tab === "seo" && (
            <div className="adm-grid" style={{ gap: 24 }}>
              <ProductFields d={d} set={set} artisans={artisans} collections={collections} sections={["seo"]} />
              <div className="adm-card" style={{ background: "var(--bg)" }}>
                <div style={{ color: "#1a0dab", fontSize: 18 }}>{d.seo.title || d.name}</div>
                <div style={{ color: "#006621", fontSize: 13 }}>vibes.in/saree/{product.slug}</div>
                <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{d.seo.description || d.description}</div>
              </div>
            </div>
          )}
          {can(role, "manager") && (
            <div className="row" style={{ marginTop: 32, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <span className="adm-note">{orders ? "This saree has orders, so it can only be archived." : "Deleting removes it from the archive entirely."}</span>
              <span className="spacer" />
              {orders ? (
                <button className="btn btn-ghost btn-sm" onClick={() => { set({ inventory: { ...d.inventory, state: "archived" } }); }}>Mark archived</button>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--bad)", borderColor: "var(--bad)" }}
                  onClick={async () => {
                    if (!confirm(`Delete “${product.name}” permanently?`)) return;
                    await api(`/api/admin/products/${product.id}`, "DELETE");
                    router.push("/admin/products");
                    router.refresh();
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
        <aside style={{ position: "sticky", top: 84 }}>
          <div className="stage adm-preview">
            <StudioCanvas item={{ id: view.id, textile: view.textile, fibre: view.fibre, blouse: view.blouse, drape }} mode={{ kind: "viewer", view: "full", lighting: drape.lighting, autoRotate: true }} quality="draft" />
          </div>
          <p className="adm-note" style={{ marginTop: 8 }}>Live preview — drag to turn. Changes go live on the store when you save.</p>
        </aside>
      </div>
    </div>
  );
}
