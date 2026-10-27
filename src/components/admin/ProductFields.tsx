"use client";

import type { Artisan, Collection, Product } from "@/lib/types";
import { FABRICS, OCCASIONS, STATES, WEAVES } from "@/lib/options";
import { Field, TagInput } from "./ui";

export type ProductDraft = Pick<
  Product,
  "name" | "price" | "fabric" | "weave" | "region" | "state" | "technique" | "colour" | "occasions" | "artisanId" | "collectionIds" | "dimensions" | "weightG" | "description" | "story" | "care" | "tags" | "seo"
> & { inventory: Pick<Product["inventory"], "model" | "quantity" | "state"> };

export const emptyDraft = (): ProductDraft => ({
  name: "",
  price: 0,
  fabric: "",
  weave: "",
  region: "",
  state: "",
  technique: "",
  colour: "",
  occasions: [],
  artisanId: null,
  collectionIds: [],
  dimensions: { lengthM: 5.5, widthM: 1.15, blousePieceM: 0.8 },
  weightG: 600,
  description: "",
  story: "",
  care: "Dry clean only. Store folded in muslin, refolding along new lines every few months.",
  tags: [],
  seo: { title: "", description: "" },
  inventory: { model: "unique", quantity: 1, state: "available" },
});

type Section = "essentials" | "story" | "inventory" | "collections" | "seo" | "dimensions";

/** The product form — the same fields in the Add workflow and the editor. */
export function ProductFields({ d, set, artisans, collections, sections = ["essentials", "inventory", "collections", "story"], suggested = {} }: { d: ProductDraft; set: (p: Partial<ProductDraft>) => void; artisans: Artisan[]; collections: Collection[]; sections?: Section[]; suggested?: Partial<Record<keyof ProductDraft, boolean>> }) {
  const ai = (k: keyof ProductDraft) => (suggested[k] ? <span className="adm-pill ai" style={{ marginLeft: 6 }}>suggested</span> : null);
  return (
    <div className="adm-grid" style={{ gap: 28 }}>
      {sections.includes("essentials") && (
        <div className="adm-form">
          <Field label="Name" full hint="A short, evocative name — e.g. “Raat ki Rani”.">
            <input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} required autoFocus />
          </Field>
          <Field label="Price (₹)">
            <input className="input" type="number" min={0} step={100} value={d.price || ""} onChange={(e) => set({ price: Number(e.target.value) })} required />
          </Field>
          <Field label="Fabric">
            <input className="input" list="fabrics" value={d.fabric} onChange={(e) => set({ fabric: e.target.value })} />
          </Field>
          <Field label="Weave">
            <input className="input" list="weaves" value={d.weave} onChange={(e) => set({ weave: e.target.value })} />
          </Field>
          <Field label="Technique">
            <input className="input" value={d.technique} onChange={(e) => set({ technique: e.target.value })} placeholder="e.g. Kadwa brocade, real zari" />
          </Field>
          <Field label="Town / cluster">
            <input className="input" value={d.region} onChange={(e) => set({ region: e.target.value })} placeholder="e.g. Varanasi" />
          </Field>
          <Field label="State">
            <input className="input" list="states" value={d.state} onChange={(e) => set({ state: e.target.value })} />
          </Field>
          <Field label="Artisan">
            <select
              className="select"
              value={d.artisanId ?? ""}
              onChange={(e) => {
                const a = artisans.find((x) => x.id === e.target.value);
                set({ artisanId: e.target.value || null, ...(a && !d.region ? { region: a.region, state: a.state } : {}) });
              }}
            >
              <option value="">— Not recorded —</option>
              {artisans.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.region}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Colour">
            <span style={{ display: "contents" }}>
              <input className="input" value={d.colour} onChange={(e) => set({ colour: e.target.value })} />
            </span>
          </Field>
          <datalist id="fabrics">{FABRICS.map((f) => <option key={f} value={f} />)}</datalist>
          <datalist id="weaves">{WEAVES.map((f) => <option key={f} value={f} />)}</datalist>
          <datalist id="states">{STATES.map((f) => <option key={f} value={f} />)}</datalist>
        </div>
      )}
      {sections.includes("inventory") && (
        <div className="adm-form">
          <Field label="This saree is…">
            <select
              className="select"
              value={d.inventory.model}
              onChange={(e) => {
                const model = e.target.value as ProductDraft["inventory"]["model"];
                set({ inventory: { ...d.inventory, model, quantity: model === "unique" ? 1 : Math.max(2, d.inventory.quantity) } });
              }}
            >
              <option value="unique">One of one (default)</option>
              <option value="limited">A limited run</option>
              <option value="multiple">Woven in several</option>
            </select>
          </Field>
          <Field label="Quantity">
            <input className="input" type="number" min={0} value={d.inventory.quantity} disabled={d.inventory.model === "unique"} onChange={(e) => set({ inventory: { ...d.inventory, quantity: Number(e.target.value) } })} />
          </Field>
          <Field label="Availability">
            <select className="select" value={d.inventory.state} onChange={(e) => set({ inventory: { ...d.inventory, state: e.target.value as ProductDraft["inventory"]["state"] } })}>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold (kept in archive)</option>
              <option value="archived">Archived</option>
              <option value="private">Private (link only / client viewing)</option>
            </select>
          </Field>
          <Field label="Occasions">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {OCCASIONS.map((o) => (
                <button type="button" key={o} className={`chip${d.occasions.includes(o) ? " on" : ""}`} style={{ height: 26, fontSize: 11 }} onClick={() => set({ occasions: d.occasions.includes(o) ? d.occasions.filter((x) => x !== o) : [...d.occasions, o] })}>
                  {o}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}
      {sections.includes("collections") && (
        <div className="adm-form">
          <Field label="Collections" full>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {collections.map((c) => (
                <button type="button" key={c.id} className={`chip${d.collectionIds.includes(c.id) ? " on" : ""}`} style={{ height: 28, fontSize: 12 }} onClick={() => set({ collectionIds: d.collectionIds.includes(c.id) ? d.collectionIds.filter((x) => x !== c.id) : [...d.collectionIds, c.id] })}>
                  {c.name}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Search tags" full hint="Words people might search with: colours, occasions, techniques.">
            <TagInput value={d.tags} onChange={(tags) => set({ tags })} placeholder="Type and press Enter" />
          </Field>
        </div>
      )}
      {sections.includes("story") && (
        <div className="adm-form">
          <Field label="Description" full>
            <span style={{ display: "contents" }}>
              <textarea className="textarea" rows={3} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="One or two sentences about what it is." />
            </span>
          </Field>
          <div className="full" style={{ marginTop: -14 }}>{ai("description")}</div>
          <Field label="The story" full hint="Where it was woven, by whom, what it means. Optional, but it is what customers remember.">
            <textarea className="textarea" rows={3} value={d.story} onChange={(e) => set({ story: e.target.value })} />
          </Field>
        </div>
      )}
      {sections.includes("dimensions") && (
        <div className="adm-form">
          <Field label="Length (m)">
            <input className="input" type="number" step={0.05} value={d.dimensions.lengthM} onChange={(e) => set({ dimensions: { ...d.dimensions, lengthM: Number(e.target.value) } })} />
          </Field>
          <Field label="Width (m)">
            <input className="input" type="number" step={0.01} value={d.dimensions.widthM} onChange={(e) => set({ dimensions: { ...d.dimensions, widthM: Number(e.target.value) } })} />
          </Field>
          <Field label="Blouse piece (m)">
            <input className="input" type="number" step={0.05} value={d.dimensions.blousePieceM} onChange={(e) => set({ dimensions: { ...d.dimensions, blousePieceM: Number(e.target.value) } })} />
          </Field>
          <Field label="Weight (g)">
            <input className="input" type="number" step={10} value={d.weightG} onChange={(e) => set({ weightG: Number(e.target.value) })} />
          </Field>
          <Field label="Care" full>
            <input className="input" value={d.care} onChange={(e) => set({ care: e.target.value })} />
          </Field>
        </div>
      )}
      {sections.includes("seo") && (
        <div className="adm-form">
          <Field label="Search engine title" full hint={`${d.seo.title.length}/60`}>
            <input className="input" value={d.seo.title} onChange={(e) => set({ seo: { ...d.seo, title: e.target.value } })} />
          </Field>
          <Field label="Search engine description" full hint={`${d.seo.description.length}/155`}>
            <textarea className="textarea" rows={2} value={d.seo.description} onChange={(e) => set({ seo: { ...d.seo, description: e.target.value } })} />
          </Field>
        </div>
      )}
    </div>
  );
}
