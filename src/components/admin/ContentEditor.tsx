"use client";

import { useState } from "react";
import type { SiteContent, Story } from "@/lib/types";
import { EntityManager } from "./EntityManager";
import { Field, SaveStatus, api, useSaver } from "./ui";

type Ref = { id: string; name: string };
type Tab = "home" | "stories";

/** Edit every word on the homepage without a developer. */
export function ContentEditor({ content, products, collections, artisans, stories }: { content: SiteContent; products: Ref[]; collections: Ref[]; artisans: Ref[]; stories: Story[] }) {
  const [c, setC] = useState<SiteContent>(content);
  const [tab, setTab] = useState<Tab>("home");
  const saver = useSaver();
  const up = <K extends keyof SiteContent>(k: K, p: Partial<SiteContent[K]>) => setC((x) => ({ ...x, [k]: { ...x[k], ...p } }));

  if (tab === "stories")
    return (
      <div>
        <div className="adm-tabs">
          <button onClick={() => setTab("home")}>Homepage</button>
          <button className="on">Stories & craft articles</button>
        </div>
        <EntityManager
          entity="stories"
          title="Stories"
          intro="Craft articles, artisan features and campaigns. Published stories appear on The Craft page."
          items={stories as never}
          display={(i) => String(i.title)}
          sub={(i) => `${i.kind}${i.published ? " · published" : " · draft"}`}
          blank={{ title: "", kind: "craft", excerpt: "", body: "", productIds: [], published: false }}
          fields={[
            { key: "title", label: "Title", type: "text", full: true },
            { key: "kind", label: "Kind", type: "select", options: [{ value: "craft", label: "Craft" }, { value: "artisan", label: "Artisan" }, { value: "campaign", label: "Campaign" }] },
            { key: "published", label: "Published", type: "checkbox" },
            { key: "excerpt", label: "Excerpt", type: "textarea", full: true },
            { key: "body", label: "Body", type: "textarea", full: true },
            { key: "productIds", label: "Linked product IDs", type: "tags", full: true },
          ]}
        />
      </div>
    );

  return (
    <div>
      <div className="adm-tabs">
        <button className="on">Homepage</button>
        <button onClick={() => setTab("stories")}>Stories & craft articles</button>
      </div>
      <div className="adm-head">
        <div>
          <h1 className="adm-h1">Homepage</h1>
          <p>Every headline, every featured piece. Saved changes are live immediately.</p>
        </div>
        <span className="spacer" />
        <SaveStatus state={saver.state} error={saver.error} />
        <a className="btn btn-ghost btn-sm" href="/" target="_blank">View ↗</a>
        <button className="btn btn-sm" onClick={() => saver.run(() => api("/api/admin/content", "PUT", c))}>Save & publish</button>
      </div>
      <div className="adm-grid" style={{ gap: 20 }}>
        <Block title="Announcement banner">
          <label className="check"><input type="checkbox" checked={c.banner.enabled} onChange={(e) => up("banner", { enabled: e.target.checked })} /> Show banner</label>
          <Field label="Text" full><input className="input" value={c.banner.text} onChange={(e) => up("banner", { text: e.target.value })} /></Field>
        </Block>
        <Block title="Hero">
          <Field label="Wordmark"><input className="input" value={c.hero.headline} onChange={(e) => up("hero", { headline: e.target.value })} /></Field>
          <Field label="Tagline"><input className="input" value={c.hero.tagline} onChange={(e) => up("hero", { tagline: e.target.value })} /></Field>
          <Field label="Primary button"><input className="input" value={c.hero.primaryCta} onChange={(e) => up("hero", { primaryCta: e.target.value })} /></Field>
          <Field label="Secondary button"><input className="input" value={c.hero.secondaryCta} onChange={(e) => up("hero", { secondaryCta: e.target.value })} /></Field>
          <Field label="Sarees in the hero (in order)" full hint="The hero opens on the first, then cuts softly to each of the others.">
            <Picker all={products} value={c.hero.productIds} onChange={(productIds) => up("hero", { productIds })} />
          </Field>
          <Field label="Seconds on each saree"><input className="input" type="number" min={6} max={60} value={c.hero.intervalSeconds} onChange={(e) => up("hero", { intervalSeconds: +e.target.value })} /></Field>
        </Block>
        <Block title="The idea">
          <Field label="Eyebrow"><input className="input" value={c.idea.eyebrow} onChange={(e) => up("idea", { eyebrow: e.target.value })} /></Field>
          <Field label="Headline"><input className="input" value={c.idea.headline} onChange={(e) => up("idea", { headline: e.target.value })} /></Field>
          {c.idea.steps.map((s, i) => (
            <div key={i} className="full adm-form" style={{ gridTemplateColumns: "1fr 2fr" }}>
              <Field label={`Step ${i + 1}`}><input className="input" value={s.title} onChange={(e) => up("idea", { steps: c.idea.steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} /></Field>
              <Field label="Text"><input className="input" value={s.body} onChange={(e) => up("idea", { steps: c.idea.steps.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} /></Field>
            </div>
          ))}
        </Block>
        <Block title="Featured collection">
          <Field label="Headline"><input className="input" value={c.collection.headline} onChange={(e) => up("collection", { headline: e.target.value })} /></Field>
          <Field label="Featured sarees" full><Picker all={products} value={c.collection.productIds} onChange={(productIds) => up("collection", { productIds })} /></Field>
        </Block>
        <Block title="Craft">
          <Field label="Headline" full><input className="input" value={c.craft.headline} onChange={(e) => up("craft", { headline: e.target.value })} /></Field>
          <Field label="Text" full><textarea className="textarea" value={c.craft.body} onChange={(e) => up("craft", { body: e.target.value })} /></Field>
          <Field label="Featured artisans" full><Picker all={artisans} value={c.craft.artisanIds} onChange={(artisanIds) => up("craft", { artisanIds })} /></Field>
        </Block>
        <Block title="Digital draping">
          <Field label="Headline"><input className="input" value={c.draping.headline} onChange={(e) => up("draping", { headline: e.target.value })} /></Field>
          <Field label="Text" full><textarea className="textarea" value={c.draping.body} onChange={(e) => up("draping", { body: e.target.value })} /></Field>
        </Block>
        <Block title="Collection stories">
          <Field label="Eyebrow"><input className="input" value={c.stories.headline} onChange={(e) => up("stories", { headline: e.target.value })} /></Field>
          <Field label="Collections shown" full><Picker all={collections} value={c.stories.collectionIds} onChange={(collectionIds) => up("stories", { collectionIds })} /></Field>
        </Block>
        <Block title="Legacy">
          <Field label="Headline" full><input className="input" value={c.legacy.headline} onChange={(e) => up("legacy", { headline: e.target.value })} /></Field>
          <Field label="Text" full><textarea className="textarea" value={c.legacy.body} onChange={(e) => up("legacy", { body: e.target.value })} /></Field>
        </Block>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="adm-card">
      <h2>{title}</h2>
      <div className="adm-form">{children}</div>
    </section>
  );
}

/** Ordered multi-select: click to add, arrows to reorder, × to remove. */
function Picker({ all, value, onChange }: { all: Ref[]; value: string[]; onChange: (v: string[]) => void }) {
  const name = (id: string) => all.find((x) => x.id === id)?.name ?? id;
  const move = (i: number, d: number) => {
    const n = [...value];
    const [x] = n.splice(i, 1);
    n.splice(Math.max(0, Math.min(n.length, i + d)), 0, x);
    onChange(n);
  };
  return (
    <div className="adm-grid" style={{ gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {value.map((id, i) => (
          <span key={id} className="adm-pill" style={{ height: 28, background: "var(--purple-wash)", color: "var(--purple)" }}>
            {i + 1}. {name(id)}
            <button type="button" onClick={() => move(i, -1)} aria-label="Earlier">‹</button>
            <button type="button" onClick={() => move(i, 1)} aria-label="Later">›</button>
            <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} aria-label="Remove">×</button>
          </span>
        ))}
      </div>
      <select className="select" value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
        <option value="">+ Add…</option>
        {all.filter((x) => !value.includes(x.id)).map((x) => (
          <option key={x.id} value={x.id}>{x.name}</option>
        ))}
      </select>
    </div>
  );
}
