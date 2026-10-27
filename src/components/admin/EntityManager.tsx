"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, SaveStatus, TagInput, api, upload, useSaver } from "./ui";

export type FieldDef =
  | { key: string; label: string; type: "text" | "textarea" | "number"; full?: boolean; hint?: string }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; full?: boolean }
  | { key: string; label: string; type: "checkbox" }
  | { key: string; label: string; type: "tags"; full?: boolean }
  | { key: string; label: string; type: "image"; full?: boolean };

type Item = Record<string, unknown> & { id: string };

/** A list + form editor used for collections, artisans and stories. */
export function EntityManager({ entity, title, intro, items, fields, display, sub, storeHref, blank }: { entity: string; title: string; intro: string; items: Item[]; fields: FieldDef[]; display: (i: Item) => string; sub?: (i: Item) => string; storeHref?: (i: Item) => string; blank: Record<string, unknown> }) {
  const router = useRouter();
  const [sel, setSel] = useState<string | "new" | null>(items[0]?.id ?? null);
  const current = sel === "new" ? ({ id: "new", ...blank } as Item) : items.find((i) => i.id === sel) ?? null;
  return (
    <div>
      <div className="adm-head">
        <div>
          <h1 className="adm-h1">{title}</h1>
          <p>{intro}</p>
        </div>
        <span className="spacer" />
        <button className="btn btn-sm" onClick={() => setSel("new")}>+ New</button>
      </div>
      <div className="adm-split" style={{ gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.6fr)" }}>
        <div className="adm-card" style={{ padding: 8 }}>
          {items.map((i) => (
            <button key={i.id} onClick={() => setSel(i.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 4, background: i.id === sel ? "var(--purple-wash)" : undefined }}>
              <span className="serif" style={{ fontSize: 19 }}>{display(i)}</span>
              {sub && <span className="adm-note" style={{ display: "block" }}>{sub(i)}</span>}
            </button>
          ))}
        </div>
        {current && (
          <Editor
            key={current.id}
            item={current}
            fields={fields}
            entity={entity}
            storeHref={storeHref}
            onCreated={(id) => {
              setSel(id);
              router.refresh();
            }}
            onDeleted={() => {
              setSel(items.find((i) => i.id !== current.id)?.id ?? null);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

function Editor({ item, fields, entity, storeHref, onCreated, onDeleted }: { item: Item; fields: FieldDef[]; entity: string; storeHref?: (i: Item) => string; onCreated: (id: string) => void; onDeleted: () => void }) {
  const [v, setV] = useState<Item>(item);
  const saver = useSaver();
  const isNew = item.id === "new";
  const set = (k: string, val: unknown) => setV((x) => ({ ...x, [k]: val }));
  return (
    <form
      className="adm-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const { id, ...body } = v;
        if (isNew) {
          await saver.run(async () => {
            const created = await api<{ id: string }>(`/api/admin/${entity}`, "POST", body);
            onCreated(created.id);
          });
        } else await saver.run(() => api(`/api/admin/${entity}/${id}`, "PATCH", body));
      }}
    >
      <div className="adm-form">
        {fields.map((f) => {
          const val = v[f.key];
          if (f.type === "checkbox")
            return (
              <label key={f.key} className="check">
                <input type="checkbox" checked={!!val} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}
              </label>
            );
          if (f.type === "select")
            return (
              <Field key={f.key} label={f.label} full={f.full}>
                <select className="select" value={String(val ?? "")} onChange={(e) => set(f.key, e.target.value || null)}>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
            );
          if (f.type === "tags")
            return (
              <Field key={f.key} label={f.label} full={f.full}>
                <TagInput value={(val as string[]) ?? []} onChange={(t) => set(f.key, t)} />
              </Field>
            );
          if (f.type === "image")
            return (
              <Field key={f.key} label={f.label} full={f.full}>
                <div className="row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {val ? <img src={`/api/media/${val}`} alt="" style={{ width: 72, height: 90, objectFit: "cover", borderRadius: 4 }} /> : <span className="adm-note">No photograph yet</span>}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) set(f.key, (await upload(file, "portrait", file.name)).key);
                    }}
                  />
                </div>
              </Field>
            );
          return (
            <Field key={f.key} label={f.label} full={f.full} hint={"hint" in f ? f.hint : undefined}>
              {f.type === "textarea" ? (
                <textarea className="textarea" rows={4} value={String(val ?? "")} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <input className="input" type={f.type} value={String(val ?? "")} onChange={(e) => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)} />
              )}
            </Field>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 24 }}>
        {!isNew && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--bad)" }}
            onClick={async () => {
              if (!confirm("Delete this permanently?")) return;
              if (await saver.run(() => api(`/api/admin/${entity}/${item.id}`, "DELETE"))) onDeleted();
            }}
          >
            Delete
          </button>
        )}
        {!isNew && storeHref && (
          <a className="link" href={storeHref(item)} target="_blank" rel="noreferrer">
            View on store ↗
          </a>
        )}
        <span className="spacer" />
        <SaveStatus state={saver.state} error={saver.error} />
        <button className="btn btn-sm">{isNew ? "Create" : "Save"}</button>
      </div>
    </form>
  );
}
