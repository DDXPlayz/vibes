"use client";

import type { Artisan, Collection } from "@/lib/types";
import { EntityManager } from "./EntityManager";

export function CollectionsManager({ collections, products, counts }: { collections: Collection[]; products: { value: string; label: string }[]; counts: Record<string, number> }) {
  return (
    <EntityManager
      entity="collections"
      title="Collections"
      intro="Group sarees by region, weave, technique, colour, story or community. Assign pieces from each product."
      items={collections as never}
      display={(i) => String(i.name)}
      sub={(i) => `${i.kind} · ${counts[i.id] ?? 0} pieces${i.featured ? " · featured" : ""}`}
      storeHref={(i) => `/collections/${i.slug}`}
      blank={{ name: "", slug: "", kind: "story", tagline: "", description: "", featured: false, coverProductId: null, order: 99 }}
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "slug", label: "Web address", type: "text", hint: "Leave empty to generate from the name" },
        { key: "kind", label: "Organised by", type: "select", options: ["region", "weave", "technique", "colour", "story", "community"].map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) })) },
        { key: "coverProductId", label: "Cover saree", type: "select", options: [{ value: "", label: "— First piece —" }, ...products] },
        { key: "tagline", label: "Tagline", type: "text", full: true },
        { key: "description", label: "Description", type: "textarea", full: true },
        { key: "order", label: "Order", type: "number" },
        { key: "featured", label: "Feature on the homepage", type: "checkbox" },
      ]}
    />
  );
}

export function ArtisansManager({ artisans, counts }: { artisans: Artisan[]; counts: Record<string, number> }) {
  return (
    <EntityManager
      entity="artisans"
      title="Artisans"
      intro="The weavers and communities behind each saree. Products link here so the story travels with the cloth."
      items={artisans as never}
      display={(i) => String(i.name)}
      sub={(i) => `${i.region}, ${i.state} · ${counts[i.id] ?? 0} pieces`}
      storeHref={(i) => `/artisans/${i.slug}`}
      blank={{ name: "", community: "", region: "", state: "", tradition: "", techniques: [], since: new Date().getFullYear(), bio: "", story: "", quote: "" }}
      fields={[
        { key: "name", label: "Name", type: "text" },
        { key: "community", label: "Community / cluster", type: "text" },
        { key: "region", label: "Town", type: "text" },
        { key: "state", label: "State", type: "text" },
        { key: "tradition", label: "Weaving tradition", type: "text" },
        { key: "since", label: "Weaving since", type: "number" },
        { key: "techniques", label: "Techniques", type: "tags", full: true },
        { key: "portraitKey", label: "Photograph", type: "image", full: true },
        { key: "quote", label: "In their words", type: "text", full: true },
        { key: "bio", label: "Short biography", type: "textarea", full: true },
        { key: "story", label: "Their story", type: "textarea", full: true },
      ]}
    />
  );
}
