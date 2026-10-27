import type { Database, Product } from "@/lib/types";
import { colourFamilies, type ProductView } from "@/lib/view";
import { read } from "./db";
import { mediaUrl } from "./storage";

export function toView(db: Database, p: Product): ProductView {
  const textile = db.textiles.find((t) => t.id === p.textileId);
  const artisan = p.artisanId ? db.artisans.find((a) => a.id === p.artisanId) : undefined;
  const spec = textile?.spec;
  return {
    id: p.id,
    number: p.number,
    slug: p.slug,
    name: p.name,
    price: p.price,
    fabric: p.fabric,
    weave: p.weave,
    region: p.region,
    state: p.state,
    technique: p.technique,
    colour: p.colour,
    colourFamilies: colourFamilies(`${p.colour} ${p.tags.join(" ")}`),
    occasions: p.occasions,
    tags: p.tags,
    dimensions: p.dimensions,
    weightG: p.weightG,
    description: p.description,
    story: p.story,
    care: p.care,
    availability: p.inventory.state,
    inventoryModel: p.inventory.model,
    available: Math.max(0, p.inventory.quantity - p.inventory.reserved),
    artisan: artisan ? { id: artisan.id, slug: artisan.slug, name: artisan.name, region: artisan.region, community: artisan.community, quote: artisan.quote } : null,
    collections: p.collectionIds.map((id) => db.collections.find((c) => c.id === id)).filter(Boolean).map((c) => ({ id: c!.id, slug: c!.slug, name: c!.name })),
    textile: { id: textile?.id ?? p.textileId, source: textile?.source ?? "procedural", spec, scanUrl: mediaUrl(textile?.scanKey) },
    blouse: spec?.blouse ?? "#3a2a2a",
    fibre: { sheen: spec?.sheen ?? 0.55, sheer: spec?.sheer ?? 0 },
    drape: p.drape,
    renders: p.renders.map((r) => ({ view: r.view, url: mediaUrl(r.mediaKey)! })),
    status: p.status,
    createdAt: p.createdAt,
  };
}

/** Published products visible on the storefront (private ones are hidden). */
export async function storefrontProducts() {
  return read((db) => db.products.filter((p) => p.status === "published" && p.inventory.state !== "private").map((p) => toView(db, p)));
}

export async function productBySlug(slug: string) {
  return read((db) => {
    const p = db.products.find((x) => x.slug === slug && x.status === "published");
    return p ? toView(db, p) : null;
  });
}

export async function siteContent() {
  return read((db) => db.content);
}
