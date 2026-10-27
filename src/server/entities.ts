import type { Artisan, Collection, Database, Product, Role, Story, Textile } from "@/lib/types";
import { DEFAULT_DRAPE } from "@/lib/seed";
import { newId } from "./db";

/**
 * Admin entity rules: defaults on create, which fields may be patched, and
 * who may delete. Kept in one place so the API stays a thin shell.
 */

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "untitled";

function uniqueSlug(base: string, taken: string[]) {
  let s = slugify(base);
  let i = 2;
  while (taken.includes(s)) s = `${slugify(base)}-${i++}`;
  return s;
}

type EntityKey = "products" | "collections" | "artisans" | "textiles" | "stories";

export const ENTITIES: Record<EntityKey, { deleteRole: Role; create(db: Database, body: Record<string, unknown>): { id: string } }> = {
  products: {
    deleteRole: "manager",
    create(db, b) {
      const now = new Date().toISOString();
      const number = Math.max(0, ...db.products.map((p) => p.number)) + 1;
      const name = String(b.name ?? "Untitled saree");
      const p: Product = {
        id: newId("p"),
        number,
        slug: uniqueSlug(name, db.products.map((x) => x.slug)),
        name,
        price: Number(b.price ?? 0),
        fabric: String(b.fabric ?? ""),
        weave: String(b.weave ?? ""),
        region: String(b.region ?? ""),
        state: String(b.state ?? ""),
        technique: String(b.technique ?? ""),
        colour: String(b.colour ?? ""),
        occasions: (b.occasions as string[]) ?? [],
        artisanId: (b.artisanId as string) || null,
        collectionIds: (b.collectionIds as string[]) ?? [],
        dimensions: (b.dimensions as Product["dimensions"]) ?? { lengthM: 5.5, widthM: 1.15, blousePieceM: 0.8 },
        weightG: Number(b.weightG ?? 600),
        description: String(b.description ?? ""),
        story: String(b.story ?? ""),
        care: String(b.care ?? "Dry clean only. Store folded in muslin."),
        textileId: String(b.textileId ?? ""),
        drape: (b.drape as Product["drape"]) ?? db.studio.defaults ?? DEFAULT_DRAPE,
        renders: (b.renders as Product["renders"]) ?? [],
        tags: (b.tags as string[]) ?? [],
        seo: (b.seo as Product["seo"]) ?? { title: `${name} | VIBES`, description: String(b.description ?? "") },
        status: b.status === "published" ? "published" : "draft",
        inventory: { model: "unique", quantity: 1, reserved: 0, state: "available", ...(b.inventory as object), sku: `VB-${String(number).padStart(4, "0")}` },
        views: 0,
        createdAt: now,
        updatedAt: now,
      };
      db.products.push(p);
      return p;
    },
  },
  collections: {
    deleteRole: "manager",
    create(db, b) {
      const name = String(b.name ?? "New collection");
      const c: Collection = {
        id: newId("c"),
        slug: uniqueSlug(String(b.slug || name), db.collections.map((x) => x.slug)),
        name,
        kind: (b.kind as Collection["kind"]) ?? "story",
        tagline: String(b.tagline ?? ""),
        description: String(b.description ?? ""),
        featured: !!b.featured,
        coverProductId: (b.coverProductId as string) || null,
        order: db.collections.length + 1,
      };
      db.collections.push(c);
      return c;
    },
  },
  artisans: {
    deleteRole: "manager",
    create(db, b) {
      const name = String(b.name ?? "New artisan");
      const a: Artisan = {
        id: newId("a"),
        slug: uniqueSlug(name, db.artisans.map((x) => x.slug)),
        name,
        community: String(b.community ?? ""),
        region: String(b.region ?? ""),
        state: String(b.state ?? ""),
        tradition: String(b.tradition ?? ""),
        techniques: (b.techniques as string[]) ?? [],
        since: Number(b.since ?? new Date().getFullYear()),
        bio: String(b.bio ?? ""),
        story: String(b.story ?? ""),
        quote: String(b.quote ?? ""),
        portraitKey: b.portraitKey as string | undefined,
      };
      db.artisans.push(a);
      return a;
    },
  },
  textiles: {
    deleteRole: "owner",
    create(db, b) {
      const t: Textile = {
        id: newId("t"),
        source: b.scanKey ? "scan" : "procedural",
        spec: b.spec as Textile["spec"],
        scanKey: b.scanKey as string | undefined,
        originalKey: b.originalKey as string | undefined,
        analysis: b.analysis as Textile["analysis"],
        createdAt: new Date().toISOString(),
      };
      db.textiles.push(t);
      return t;
    },
  },
  stories: {
    deleteRole: "manager",
    create(db, b) {
      const title = String(b.title ?? "Untitled story");
      const s: Story = {
        id: newId("s"),
        slug: uniqueSlug(title, db.stories.map((x) => x.slug)),
        title,
        kind: (b.kind as Story["kind"]) ?? "craft",
        excerpt: String(b.excerpt ?? ""),
        body: String(b.body ?? ""),
        productIds: (b.productIds as string[]) ?? [],
        published: !!b.published,
      };
      db.stories.push(s);
      return s;
    },
  },
};

export function isEntity(k: string): k is EntityKey {
  return k in ENTITIES;
}

/** Fields that can never be set from a patch. */
export const PROTECTED = new Set(["id", "number", "createdAt", "views"]);
