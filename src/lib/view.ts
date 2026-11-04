import type { AvailabilityState, DrapeConfig, InventoryModel, Product, TextileRef, ViewId } from "./types";

/** Client-safe projection of a product with everything needed to present it. */
export interface ProductView {
  id: string;
  number: number;
  slug: string;
  name: string;
  price: number;
  fabric: string;
  weave: string;
  region: string;
  state: string;
  technique: string;
  colour: string;
  colourFamilies: string[];
  occasions: string[];
  tags: string[];
  dimensions: Product["dimensions"];
  weightG: number;
  description: string;
  story: string;
  care: string;
  availability: AvailabilityState;
  inventoryModel: InventoryModel;
  available: number;
  artisan: { id: string; slug: string; name: string; region: string; community: string; quote: string } | null;
  collections: { id: string; slug: string; name: string }[];
  textile: TextileRef;
  blouse: string;
  fibre: { sheen: number; sheer: number };
  drape: DrapeConfig;
  renders: { view: ViewId; url: string }[];
  status: Product["status"];
  createdAt: string;
}

export const COLOUR_FAMILIES: Record<string, string[]> = {
  purple: ["purple", "aubergine", "plum", "violet", "lilac", "wine", "jamuni"],
  red: ["red", "crimson", "maroon", "madder", "vermilion", "laal", "scarlet", "rust"],
  pink: ["pink", "rose", "magenta", "gulabi", "blush"],
  white: ["white", "ivory", "off-white", "cream", "fog"],
  black: ["black", "ink", "kaali", "charcoal"],
  blue: ["blue", "indigo", "neel", "navy"],
  green: ["green", "emerald", "mint", "forest", "teal"],
  gold: ["gold", "golden", "zari", "muga", "mustard"],
  beige: ["beige", "sand", "stone", "natural", "tussar"],
};

export function colourFamilies(text: string) {
  const t = text.toLowerCase();
  return Object.entries(COLOUR_FAMILIES)
    .filter(([, words]) => words.some((w) => new RegExp(`\\b${w}\\b`).test(t)))
    .map(([f]) => f);
}

export const AVAILABILITY_LABEL: Record<AvailabilityState, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "In the archive",
  archived: "In the archive",
  private: "Private",
};

export function availabilityLine(p: Pick<ProductView, "availability" | "inventoryModel" | "available">) {
  if (p.availability === "available") {
    if (p.inventoryModel === "unique") return "One of one";
    if (p.available <= 0) return "In the archive";
    if (p.inventoryModel === "limited") return `${p.available} of a limited run`;
    return "Available";
  }
  return AVAILABILITY_LABEL[p.availability];
}

export function canPurchase(p: Pick<ProductView, "availability" | "available">) {
  return p.availability === "available" && p.available > 0;
}

/**
 * The default blouse: a sophisticated neutral chosen to sit quietly beside
 * the saree — champagne silk for most, espresso for very pale sarees.
 */
export function neutralBlouse(sareeBase: string) {
  const h = sareeBase.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.72 ? "#3b302a" : "#d6c8b2";
}
