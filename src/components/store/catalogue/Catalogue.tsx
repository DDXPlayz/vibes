"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useReveal } from "@/hooks/useReveal";
import { cx, num, price } from "@/lib/format";
import { applyFilters, describe, emptyFilters, mergeFilters, parseQuery, type CatalogFilters } from "@/lib/search";
import { availabilityLine, type ProductView } from "@/lib/view";
import { CloseIcon } from "../Icons";
import { ProductCard } from "../ProductCard";
import { RenderImage } from "../RenderImage";
import styles from "./catalogue.module.css";

const Gallery3D = dynamic(() => import("./Gallery3D").then((m) => m.Gallery3D), { ssr: false, loading: () => <div className="loading-thread" /> });

type Mode = "grid" | "editorial" | "3d";

const PRICE_BANDS = [
  { label: "Under ₹25,000", max: 25000 },
  { label: "₹25,000 – ₹75,000", min: 25000, max: 75000 },
  { label: "₹75,000 – ₹1,50,000", min: 75000, max: 150000 },
  { label: "Above ₹1,50,000", min: 150000 },
];
const SWATCH: Record<string, string> = { purple: "#5b2e5f", red: "#9b1c24", pink: "#e2a5a5", white: "#efe9dc", black: "#1a1717", blue: "#26386b", green: "#1d5a46", gold: "#c9a356", beige: "#cdb894" };

export function Catalogue({ products, collections, initial }: { products: ProductView[]; collections: { slug: string; name: string }[]; initial: { q?: string; availability?: string; collection?: string; view?: string } }) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState(initial.q ?? "");
  const [manual, setManual] = useState<CatalogFilters>(() => {
    const f = emptyFilters();
    if (initial.availability === "archive" || initial.availability === "available") f.availability = initial.availability;
    if (initial.collection) f.collection = [initial.collection];
    return f;
  });
  const [mode, setMode] = useState<Mode>((initial.view as Mode) ?? "grid");
  const [drawer, setDrawer] = useState(false);

  const parsed = useMemo(() => parseQuery(q), [q]);
  const filters = useMemo(() => mergeFilters(manual, parsed), [manual, parsed]);
  const results = useMemo(() => applyFilters(products, filters), [products, filters]);
  const chips = describe(filters);
  useReveal([results, mode]);

  // keep the URL shareable
  useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (manual.availability !== "all") sp.set("availability", manual.availability);
    if (manual.collection[0]) sp.set("collection", manual.collection[0]);
    if (mode !== "grid") sp.set("view", mode);
    const t = setTimeout(() => router.replace(`${path}${sp.size ? `?${sp}` : ""}`, { scroll: false }), 300);
    return () => clearTimeout(t);
  }, [q, manual.availability, manual.collection, mode, path, router]);

  const facets = useMemo(() => {
    const count = (key: (p: ProductView) => string[]) => {
      const m = new Map<string, number>();
      products.forEach((p) => key(p).forEach((v) => m.set(v, (m.get(v) ?? 0) + 1)));
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return {
      fabric: count((p) => {
        const f = p.fabric.toLowerCase();
        if (f.includes("muga")) return ["muga"];
        if (f.includes("tussar")) return ["tussar"];
        if (f.includes("muslin")) return ["muslin"];
        if (f.includes("silk") && f.includes("cotton")) return ["silk-cotton"];
        if (f.includes("cotton")) return ["cotton"];
        return ["silk"];
      }),
      weave: count((p) => [p.weave.replace(/^Tanchoi /, "").replace(/^Mekhela-style /, "")]),
      state: count((p) => [p.state]),
      colour: count((p) => p.colourFamilies),
    };
  }, [products]);

  const toggle = (key: "fabric" | "weave" | "state" | "colour" | "collection", v: string) =>
    setManual((m) => ({ ...m, [key]: m[key].includes(v) ? m[key].filter((x) => x !== v) : [...m[key], v] }));

  const removeChip = (c: (typeof chips)[number]) => {
    const inParsed = c.value ? (parsed[c.key] as string[] | undefined)?.includes(c.value) : parsed[c.key] !== undefined && parsed[c.key] !== "all";
    if (inParsed) {
      // drop the words that produced this chip from the query
      const rest = q
        .split(/\s+/)
        .filter((w) => !c.label.toLowerCase().includes(w.toLowerCase().replace(/[^\p{L}]/gu, "")) || w.length < 3)
        .join(" ");
      setQ(rest === q ? "" : rest);
    }
    setManual((m) => {
      const n = { ...m };
      if (c.key === "priceMin") n.priceMin = undefined;
      else if (c.key === "priceMax") n.priceMax = undefined;
      else if (c.key === "light") n.light = false;
      else if (c.key === "availability") n.availability = "all";
      else if (c.value) (n[c.key] as string[]) = (m[c.key] as string[]).filter((x) => x !== c.value);
      return n;
    });
  };

  const rail = (
    <div className={styles.rail}>
      <Facet title="Availability">
        {(["all", "available", "archive"] as const).map((a) => (
          <label className="check" key={a}>
            <input type="radio" name="avail" checked={manual.availability === a} onChange={() => setManual((m) => ({ ...m, availability: a }))} />
            {a === "all" ? "Everything" : a === "available" ? "Available now" : "The archive"}
          </label>
        ))}
      </Facet>
      <Facet title="Colour">
        <div className={styles.swatches}>
          {facets.colour.map(([c]) => (
            <button key={c} title={c} aria-label={c} aria-pressed={manual.colour.includes(c)} className={cx(styles.sw, manual.colour.includes(c) && styles.swOn)} style={{ background: SWATCH[c] }} onClick={() => toggle("colour", c)} />
          ))}
        </div>
      </Facet>
      <Facet title="Fabric">
        {facets.fabric.map(([v, n]) => (
          <label className="check" key={v}>
            <input type="checkbox" checked={manual.fabric.includes(v)} onChange={() => toggle("fabric", v)} />
            <span style={{ textTransform: "capitalize" }}>{v}</span>
            <span className="muted" style={{ marginLeft: "auto" }}>{n}</span>
          </label>
        ))}
      </Facet>
      <Facet title="Weave">
        {facets.weave.map(([v, n]) => (
          <label className="check" key={v}>
            <input type="checkbox" checked={manual.weave.includes(v)} onChange={() => toggle("weave", v)} />
            {v}
            <span className="muted" style={{ marginLeft: "auto" }}>{n}</span>
          </label>
        ))}
      </Facet>
      <Facet title="Region">
        {facets.state.map(([v, n]) => (
          <label className="check" key={v}>
            <input type="checkbox" checked={manual.state.includes(v)} onChange={() => toggle("state", v)} />
            {v}
            <span className="muted" style={{ marginLeft: "auto" }}>{n}</span>
          </label>
        ))}
      </Facet>
      <Facet title="Price">
        {PRICE_BANDS.map((b) => {
          const on = manual.priceMin === b.min && manual.priceMax === b.max;
          return (
            <label className="check" key={b.label}>
              <input type="radio" name="price" checked={on} onChange={() => setManual((m) => ({ ...m, priceMin: b.min, priceMax: b.max }))} />
              {b.label}
            </label>
          );
        })}
      </Facet>
      <Facet title="Collection">
        {collections.map((c) => (
          <label className="check" key={c.slug}>
            <input type="checkbox" checked={manual.collection.includes(c.slug)} onChange={() => toggle("collection", c.slug)} />
            {c.name}
          </label>
        ))}
      </Facet>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className="wrap">
        <header className={styles.head}>
          <div>
            <span className="eyebrow">{manual.availability === "archive" ? "The archive" : "The collection"}</span>
            <h1 className="h2" style={{ marginTop: 20 }}>
              {manual.availability === "archive" ? (
                <>
                  Kept, <em>always.</em>
                </>
              ) : (
                <>
                  Every piece, <em>one of one.</em>
                </>
              )}
            </h1>
          </div>
          <form className={styles.search} onSubmit={(e) => e.preventDefault()}>
            <input className="input" placeholder="Search in your own words — “red silk from Bengal under ₹70,000”" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the collection" />
          </form>
        </header>

        <div className={styles.bar}>
          <button className="btn btn-ghost btn-sm" onClick={() => setDrawer(true)} data-mobile-only>
            Filter
          </button>
          <span className="label">{results.length} {results.length === 1 ? "saree" : "sarees"}</span>
          <div className={styles.chips}>
            {chips.map((c, i) => (
              <button key={i} className="chip on" onClick={() => removeChip(c)}>
                {c.label} <span className="x">×</span>
              </button>
            ))}
            {chips.length > 0 && (
              <button
                className="link"
                onClick={() => {
                  setQ("");
                  setManual(emptyFilters());
                }}
              >
                Clear
              </button>
            )}
          </div>
          <span className="spacer" />
          <div className="seg" role="tablist" aria-label="View">
            {(["grid", "editorial", "3d"] as Mode[]).map((m) => (
              <button key={m} className={cx(mode === m && "on")} onClick={() => setMode(m)} role="tab" aria-selected={mode === m}>
                {m === "3d" ? "3D" : m}
              </button>
            ))}
          </div>
        </div>

        <div className={cx(styles.body, mode === "3d" && styles.body3d)}>
          {mode !== "3d" && <aside className={styles.aside}>{rail}</aside>}
          <div>
            {results.length === 0 && (
              <div className={styles.empty}>
                <p className="lede">Nothing in the archive matches that — yet.</p>
                <p className="body">Every saree is one of one, so the collection changes weekly. Try fewer filters, or ask us to look out for one.</p>
              </div>
            )}
            {mode === "grid" && (
              <div className={styles.grid}>
                {results.map((p, i) => (
                  <div key={p.id} className="reveal" style={{ ["--d" as string]: `${(i % 3) * 100}ms` }}>
                    <ProductCard p={p} priority={i < 3} />
                  </div>
                ))}
              </div>
            )}
            {mode === "editorial" && (
              <div className={styles.editorial}>
                {results.map((p, i) => (
                  <Link href={`/saree/${p.slug}`} key={p.id} className={cx("reveal", styles.edRow, i % 2 === 1 && styles.edFlip)}>
                    <div className={cx("stage", styles.edImg)}>
                      <RenderImage product={p} view={i % 3 === 1 ? "three-quarter" : i % 3 === 2 ? "back" : "full"} width={720} height={960} />
                    </div>
                    <div className={styles.edText}>
                      <span className="num">No. {num(p.number)}</span>
                      <h2 className="h3">{p.name}</h2>
                      <p className="label">
                        {p.weave} · {p.fabric} · {p.region}, {p.state}
                      </p>
                      <p className="lede">{p.story}</p>
                      <div className="row">
                        <span className="serif" style={{ fontSize: 24 }}>{p.availability === "sold" ? "—" : price(p.price)}</span>
                        <span className={cx("badge", p.availability)}>{availabilityLine(p)}</span>
                      </div>
                      {p.artisan && <p className="serif italic muted" style={{ fontSize: 19 }}>Woven by {p.artisan.name}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {mode === "3d" && results.length > 0 && (
              <div className={cx("stage", styles.room)}>
                <Gallery3D products={results.slice(0, 9)} />
                {results.length > 9 && <p className={cx("label", styles.roomNote)}>Showing 9 of {results.length} — refine to bring others into the room</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      {drawer && (
        <div className="drawer" role="dialog" aria-label="Filters" style={{ overflowY: "auto" }}>
          <div className="row">
            <span className="label">Refine</span>
            <span className="spacer" />
            <button className="icon-btn" onClick={() => setDrawer(false)} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {rail}
          <button className="btn btn-block" style={{ marginTop: 24, flexShrink: 0 }} onClick={() => setDrawer(false)}>
            Show {results.length}
          </button>
        </div>
      )}
    </div>
  );
}

function Facet({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.facet}>
      <button className={styles.facetHead} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="label">{title}</span>
        <span className="muted">{open ? "−" : "+"}</span>
      </button>
      {open && <div className={styles.facetBody}>{children}</div>}
    </div>
  );
}
