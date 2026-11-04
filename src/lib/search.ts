import type { ProductView } from "./view";
import { COLOUR_FAMILIES } from "./view";

/**
 * Natural-language catalogue search.
 *
 * "red sarees from Bengal under ₹50,000" → { colour: red, state: West Bengal, priceMax: 50000 }
 *
 * Deterministic and explainable on purpose: the interpreted filters are shown
 * back to the shopper as removable chips, so the search never silently guesses.
 * An embedding model can be added later as a re-ranker for the free-text part.
 */

export interface CatalogFilters {
  fabric: string[];
  weave: string[];
  state: string[];
  colour: string[];
  occasion: string[];
  collection: string[];
  priceMin?: number;
  priceMax?: number;
  availability: "all" | "available" | "archive";
  light?: boolean;
  terms: string[];
}

export const emptyFilters = (): CatalogFilters => ({ fabric: [], weave: [], state: [], colour: [], occasion: [], collection: [], availability: "all", terms: [] });

const FABRICS: Record<string, string[]> = {
  silk: ["silk", "resham", "pattu"],
  cotton: ["cotton", "sooti"],
  "silk-cotton": ["silk-cotton", "silk cotton"],
  tussar: ["tussar", "tussore", "kosa"],
  muga: ["muga"],
  muslin: ["muslin", "mulmul"],
};

const WEAVES: Record<string, string[]> = {
  Banarasi: ["banarasi", "benarasi", "banaras", "benares", "kadwa", "tanchoi"],
  Kanjivaram: ["kanjivaram", "kanjeevaram", "kanchipuram", "kanchi"],
  Jamdani: ["jamdani"],
  Tant: ["tant", "taant"],
  Chanderi: ["chanderi"],
  Paithani: ["paithani"],
  Patola: ["patola", "patan", "double ikat"],
  "Pochampally ikat": ["pochampally", "pochampalli"],
  Baluchari: ["baluchari"],
  Maheshwari: ["maheshwari"],
  "Kota doria": ["kota", "doria"],
  Bhagalpuri: ["bhagalpuri"],
  "Sambalpuri ikat": ["sambalpuri"],
  Gadwal: ["gadwal"],
  Kasavu: ["kasavu"],
  Bomkai: ["bomkai"],
  Ikat: ["ikat"],
};

const STATES: Record<string, string[]> = {
  "Uttar Pradesh": ["uttar pradesh", "up", "varanasi", "banaras"],
  "West Bengal": ["bengal", "west bengal", "kolkata", "calcutta", "bengali", "phulia", "shantipur", "bishnupur"],
  "Tamil Nadu": ["tamil nadu", "tamil", "south", "kanchipuram"],
  Gujarat: ["gujarat", "gujarati", "patan"],
  Telangana: ["telangana", "hyderabad", "pochampally", "gadwal"],
  "Madhya Pradesh": ["madhya pradesh", "mp", "maheshwar"],
  Maharashtra: ["maharashtra", "yeola"],
  Rajasthan: ["rajasthan", "kota"],
  Bihar: ["bihar", "bhagalpur"],
  Odisha: ["odisha", "orissa", "sambalpur"],
  Assam: ["assam", "assamese", "sualkuchi"],
  Kerala: ["kerala", "malayali"],
};

const OCCASIONS: Record<string, string[]> = {
  wedding: ["wedding", "bridal", "bride", "shaadi", "trousseau"],
  festive: ["festive", "festival", "diwali", "puja", "pujo"],
  evening: ["evening", "party", "night", "cocktail"],
  day: ["day", "daytime", "everyday", "daily", "casual"],
  office: ["office", "work", "workwear"],
  summer: ["summer", "summery"],
};

const STOP = new Set(["saree", "sarees", "sari", "saris", "a", "the", "in", "from", "of", "with", "and", "for", "me", "show", "handwoven", "handloom", "woven", "to", "on", "under", "below", "over", "above", "between", "less", "than", "more", "rs", "inr", "₹", "k", "lakh", "lakhs", "upto", "up"]);

function parseAmount(s: string) {
  const m = s.replace(/[₹,\s]|rs\.?|inr/gi, "").match(/^(\d+(?:\.\d+)?)(k|l|lakh|lakhs)?$/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? "").toLowerCase();
  return unit === "k" ? n * 1000 : unit.startsWith("l") ? n * 100000 : n;
}

export function parseQuery(input: string): CatalogFilters {
  const f = emptyFilters();
  let q = ` ${input.toLowerCase().replace(/[^\p{L}\p{N}₹.,\-\s]/gu, " ")} `;

  // price phrases
  const amt = String.raw`(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?\s*(?:k|l|lakh|lakhs)?)`;
  const between = q.match(new RegExp(String.raw`between\s+${amt}\s+(?:and|to|-)\s+${amt}`, "i"));
  if (between) {
    f.priceMin = parseAmount(between[1]);
    f.priceMax = parseAmount(between[2]);
    q = q.replace(between[0], " ");
  }
  const under = q.match(new RegExp(String.raw`(?:under|below|less than|upto|up to|within|max)\s+${amt}`, "i"));
  if (under) {
    f.priceMax = parseAmount(under[1]);
    q = q.replace(under[0], " ");
  }
  const over = q.match(new RegExp(String.raw`(?:over|above|more than|from|min)\s+${amt}`, "i"));
  if (over && parseAmount(over[1])) {
    f.priceMin = parseAmount(over[1]);
    q = q.replace(over[0], " ");
  }

  const take = (dict: Record<string, string[]>, into: string[]) => {
    // longest synonyms first so "west bengal" wins over "bengal"
    const pairs = Object.entries(dict).flatMap(([k, ws]) => ws.map((w) => [k, w] as const)).sort((a, b) => b[1].length - a[1].length);
    for (const [k, w] of pairs) {
      const re = new RegExp(`(^|\\s)${w.replace(/[-]/g, "[- ]")}(?=\\s)`, "i");
      if (re.test(q)) {
        if (!into.includes(k)) into.push(k);
        q = q.replace(re, " ");
      }
    }
  };
  take(FABRICS, f.fabric);
  take(WEAVES, f.weave);
  take(STATES, f.state);
  take(COLOUR_FAMILIES, f.colour);
  take(OCCASIONS, f.occasion);

  if (/\b(light|lightweight|light-weight|airy|breathable|feather)\b/.test(q)) {
    f.light = true;
    q = q.replace(/\b(light|lightweight|light-weight|airy|breathable|feather)\b/g, " ");
  }
  if (/\b(available|in stock|buy now)\b/.test(q)) {
    f.availability = "available";
    q = q.replace(/\b(available|in stock|buy now)\b/g, " ");
  }
  if (/\b(archive|sold|archived)\b/.test(q)) {
    f.availability = "archive";
    q = q.replace(/\b(archive|sold|archived)\b/g, " ");
  }
  f.terms = q.split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t) && !/^\d/.test(t));
  return f;
}

const isLight = (p: ProductView) => p.weightG <= 480;

export function applyFilters(list: ProductView[], f: CatalogFilters): ProductView[] {
  const scored = list
    .filter((p) => {
      const fab = p.fabric.toLowerCase();
      if (f.fabric.length && !f.fabric.some((x) => (x === "silk" ? fab.includes("silk") && !fab.includes("cotton") || fab === "silk" || fab.includes("muga") || fab.includes("tussar") || fab.includes("katan") || fab.includes("mulberry") : fab.includes(x)))) return false;
      if (f.weave.length && !f.weave.some((w) => p.weave.toLowerCase().includes(w.toLowerCase()) || (w === "Ikat" && p.technique.toLowerCase().includes("ikat")))) return false;
      if (f.state.length && !f.state.includes(p.state)) return false;
      if (f.colour.length && !f.colour.some((c) => p.colourFamilies.includes(c))) return false;
      if (f.occasion.length && !f.occasion.some((o) => p.occasions.includes(o) || p.tags.includes(o))) return false;
      if (f.collection.length && !f.collection.some((c) => p.collections.some((x) => x.slug === c))) return false;
      if (f.priceMin !== undefined && p.price < f.priceMin) return false;
      if (f.priceMax !== undefined && p.price > f.priceMax) return false;
      if (f.light && !isLight(p)) return false;
      const archived = p.availability === "sold" || p.availability === "archived" || (p.availability === "available" && p.available <= 0);
      if (f.availability === "available" && (archived || p.availability !== "available")) return false;
      if (f.availability === "archive" && !archived) return false;
      return true;
    })
    .map((p) => {
      let score = 0;
      if (f.terms.length) {
        const hay = `${p.name} ${p.weave} ${p.fabric} ${p.region} ${p.state} ${p.technique} ${p.colour} ${p.tags.join(" ")} ${p.description} ${p.story} ${p.artisan?.name ?? ""}`.toLowerCase();
        for (const t of f.terms) {
          if (p.name.toLowerCase().includes(t)) score += 5;
          else if (p.tags.some((x) => x.includes(t))) score += 3;
          else if (hay.includes(t)) score += 1;
          else score -= 2;
        }
      }
      return { p, score };
    });
  const filtered = f.terms.length ? scored.filter((s) => s.score > 0) : scored;
  return filtered.sort((a, b) => b.score - a.score || a.p.number - b.p.number).map((s) => s.p);
}

/** Human-readable chips for the interpreted query. */
export function describe(f: CatalogFilters) {
  const chips: { key: keyof CatalogFilters; value?: string; label: string }[] = [];
  f.colour.forEach((v) => chips.push({ key: "colour", value: v, label: v[0].toUpperCase() + v.slice(1) }));
  f.fabric.forEach((v) => chips.push({ key: "fabric", value: v, label: v[0].toUpperCase() + v.slice(1) }));
  f.weave.forEach((v) => chips.push({ key: "weave", value: v, label: v }));
  f.state.forEach((v) => chips.push({ key: "state", value: v, label: v }));
  f.occasion.forEach((v) => chips.push({ key: "occasion", value: v, label: v[0].toUpperCase() + v.slice(1) }));
  f.collection.forEach((v) => chips.push({ key: "collection", value: v, label: v.replace(/-/g, " ") }));
  if (f.priceMin !== undefined) chips.push({ key: "priceMin", label: `From ₹${f.priceMin.toLocaleString("en-IN")}` });
  if (f.priceMax !== undefined) chips.push({ key: "priceMax", label: `Under ₹${f.priceMax.toLocaleString("en-IN")}` });
  if (f.light) chips.push({ key: "light", label: "Lightweight" });
  if (f.availability !== "all") chips.push({ key: "availability", label: f.availability === "available" ? "Available now" : "The archive" });
  f.terms.forEach((v) => chips.push({ key: "terms", value: v, label: `“${v}”` }));
  return chips;
}

export function mergeFilters(a: CatalogFilters, b: CatalogFilters): CatalogFilters {
  const u = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  return {
    fabric: u(a.fabric, b.fabric),
    weave: u(a.weave, b.weave),
    state: u(a.state, b.state),
    colour: u(a.colour, b.colour),
    occasion: u(a.occasion, b.occasion),
    collection: u(a.collection, b.collection),
    priceMin: b.priceMin ?? a.priceMin,
    priceMax: b.priceMax ?? a.priceMax,
    availability: b.availability !== "all" ? b.availability : a.availability,
    light: a.light || b.light,
    terms: u(a.terms, b.terms),
  };
}
