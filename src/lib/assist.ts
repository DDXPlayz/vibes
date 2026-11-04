import type { Collection, TextileAnalysis } from "./types";
import { colourFamilies } from "./view";

/**
 * The studio assistant. It *suggests* — the admin accepts, edits or ignores
 * every suggestion; nothing is written to a product without a click.
 *
 * This implementation is deterministic (templated from the scan analysis
 * and the facts the admin entered) so it works offline and never invents
 * facts. A language model can replace `suggest()` behind the same
 * /api/admin/assist contract to write richer copy — with the same rule:
 * suggestions only.
 */

export interface AssistInput {
  name?: string;
  fabric?: string;
  weave?: string;
  region?: string;
  state?: string;
  technique?: string;
  occasions?: string[];
  analysis?: TextileAnalysis;
}

export interface Suggestions {
  colour?: string;
  tags: string[];
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  collectionIds: string[];
  occasions: string[];
  notes: string[];
}

const PATTERN_PHRASE: Record<TextileAnalysis["pattern"], string> = {
  plain: "a quiet, unpatterned body",
  "sparse-buti": "scattered butis across the body",
  "dense-motif": "a densely patterned body",
  stripes: "a striped body",
  checks: "a checked body",
  ikat: "ikat patterning",
};

export function suggest(input: AssistInput, collections: Pick<Collection, "id" | "name" | "kind" | "slug">[]): Suggestions {
  const a = input.analysis;
  const notes: string[] = [];
  const colours = a?.dominantColours ?? [];
  const main = colours[0]?.name;
  const accent = colours.find((c, i) => i > 0 && c.name !== main)?.name;
  const colour = main ? (accent && accent !== main ? `${cap(main)} & ${accent}` : cap(main)) : undefined;
  const zari = (a?.zariCoverage ?? 0) > 0.015;
  if (zari) notes.push(`Zari detected on about ${Math.round((a!.zariCoverage) * 100)}% of the surface — please confirm real or tested zari.`);
  if (a && a.patternConfidence < 0.55) notes.push("Pattern reading is uncertain — check the description.");

  const tags = new Set<string>();
  colourFamilies(`${main ?? ""} ${accent ?? ""}`).forEach((c) => tags.add(c));
  if (input.fabric) input.fabric.toLowerCase().split(/[\s,-]+/).filter((w) => w.length > 3).forEach((w) => tags.add(w));
  if (input.weave) tags.add(input.weave.toLowerCase());
  if (zari) tags.add("zari");
  if (a?.pattern === "ikat") tags.add("ikat");
  if (a?.pattern === "stripes") tags.add("stripes");
  if (a?.pattern === "checks") tags.add("checks");
  const light = /cotton|muslin|chanderi|kota|linen|organza/i.test(`${input.fabric} ${input.weave}`);
  if (light) tags.add("lightweight");

  const occasions = new Set<string>(input.occasions ?? []);
  if (zari && /silk/i.test(input.fabric ?? "")) {
    occasions.add("wedding");
    occasions.add("festive");
  } else if (light) {
    occasions.add("day");
    occasions.add("summer");
  } else occasions.add("festive");

  const fabric = input.fabric?.toLowerCase() || "handwoven";
  const parts = [
    `${colour ?? "Handwoven"} ${fabric}${input.weave ? ` ${input.weave}` : ""}${input.region ? ` from ${input.region}` : ""}`,
    a ? `with ${PATTERN_PHRASE[a.pattern]}${zari ? " worked in zari" : ""}` : "",
    a && a.borderRatio > 0.04 ? `${a.borderRatio > 0.11 ? "a broad" : "a fine"} border` : "",
  ].filter(Boolean);
  const description = `${parts[0]}${parts[1] ? `, ${parts[1]}` : ""}${parts[2] ? ` and ${parts[2]}` : ""}, finished with its pallu.`;

  const collectionIds = collections
    .filter((c) => {
      const n = `${c.name} ${c.slug}`.toLowerCase();
      if (c.kind === "region" && input.state && (n.includes(input.state.toLowerCase().split(" ")[0]) || (input.region && n.includes(input.region.toLowerCase().split(/[ ,]/)[0])))) return true;
      if (c.kind === "region" && /varanasi|banaras/i.test(input.region ?? "") && n.includes("banaras")) return true;
      if (c.kind === "region" && /tamil|kerala|telangana/i.test(input.state ?? "") && n.includes("temple")) return true;
      if (c.kind === "technique" && (a?.pattern === "ikat" || /ikat|patola/i.test(`${input.weave} ${input.technique}`)) && n.includes("resist")) return true;
      if (c.kind === "story" && occasions.has("wedding") && n.includes("handed")) return true;
      if (c.kind === "story" && light && n.includes("everyday")) return true;
      if (c.kind === "colour" && /purple|indigo|black|aubergine|ink|navy/i.test(colour ?? "") && n.includes("dark")) return true;
      return false;
    })
    .map((c) => c.id);

  const title = input.name ? `${input.name} — ${[input.weave, input.fabric].filter(Boolean).join(" ")} saree` : undefined;
  return {
    colour,
    tags: [...tags].slice(0, 10),
    description,
    seoTitle: title ? `${title} | VIBES` : undefined,
    seoDescription: description.length > 155 ? description.slice(0, 152) + "…" : description,
    collectionIds,
    occasions: [...occasions],
    notes,
  };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
