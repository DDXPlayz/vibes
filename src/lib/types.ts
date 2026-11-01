/**
 * VIBES domain model.
 *
 * The central idea: a Product does not own pixels. It references a Textile
 * (the single scan of the physical saree — the source of truth) and a Drape
 * configuration that points at reusable studio assets (mannequin, pose,
 * lighting, environment). Every presentation is derived from those.
 */

export type ID = string;

/* ───────────────────────── Textile ───────────────────────── */

export type MotifKind =
  | "none"
  | "buti"
  | "jaal"
  | "stripes"
  | "checks"
  | "ikat-chevron"
  | "ikat-diamond"
  | "jamdani";

export type BorderStyle = "plain" | "temple" | "zari-band" | "stripes" | "ikat" | "buti-band";

export type PalluKind = "dense-buti" | "stripes" | "medallion" | "ikat-grid" | "temple" | "narrative" | "plain";

/** Parametric description used for the sample archive (and as a fallback). */
export interface TextileSpec {
  base: string;
  /** Second colour for shot silks / dhoop-chhaon; optional. */
  baseShot?: string;
  border: { color: string; style: BorderStyle; width: number; zari: boolean; accent?: string };
  motif: { kind: MotifKind; color: string; zari: boolean; scale: number; density: number };
  pallu: { kind: PalluKind; color: string; zari: boolean; start: number };
  blouse: string;
  /** 0..1 — how much the fibre catches light (silk high, cotton low). */
  sheen: number;
  /** 0..1 — sheerness (kota, organza, muslin). */
  sheer: number;
}

export interface TextileAnalysis {
  dominantColours: { hex: string; share: number; name: string }[];
  borderRatio: number;
  palluStart: number;
  palluSide: "start" | "end";
  zariCoverage: number;
  pattern: "plain" | "sparse-buti" | "dense-motif" | "stripes" | "checks" | "ikat";
  patternConfidence: number;
  aspect: number;
  estimatedLengthM: number;
  estimatedWidthM: number;
  /** Bounds of the textile in the original photograph, 0..1. */
  crop?: { x: number; y: number; w: number; h: number };
}

export interface Textile {
  id: ID;
  /** procedural = sample archive. scan = processed photograph of the real saree. */
  source: "procedural" | "scan";
  spec?: TextileSpec;
  /** Object-storage key of the processed (cropped, oriented) scan. */
  scanKey?: string;
  /** Object-storage key of the untouched original upload — never modified. */
  originalKey?: string;
  analysis?: TextileAnalysis;
  createdAt: string;
}

/* ───────────────────────── Studio ───────────────────────── */

export type DrapeStyleId = "nivi" | "seedha" | "open";
/** How the model stands. */
export type PoseId = "poised" | "ease" | "turn";
/** The model's skin tone. (Named for the type's history: it once chose a mannequin finish.) */
export type MannequinId = "warm" | "deep" | "honey";
export type LightingId = "gallery" | "daylight" | "dusk" | "studio";
export type EnvironmentId = "ivory" | "stone" | "charcoal" | "umber";
export type ViewId = "front" | "three-quarter" | "side" | "back" | "pallu" | "border" | "weave" | "full";
export type RenderQuality = "draft" | "standard" | "high";

export interface DrapeConfig {
  style: DrapeStyleId;
  mannequin: MannequinId;
  pose: PoseId;
  lighting: LightingId;
  environment: EnvironmentId;
}

export interface Render {
  view: ViewId;
  mediaKey: string;
  width: number;
  height: number;
  createdAt: string;
}

/* ───────────────────────── Inventory ───────────────────────── */

export type InventoryModel = "unique" | "limited" | "multiple";
export type AvailabilityState = "available" | "reserved" | "sold" | "archived" | "private";

export interface Inventory {
  model: InventoryModel;
  quantity: number;
  reserved: number;
  state: AvailabilityState;
  sku: string;
}

/* ───────────────────────── Catalogue ───────────────────────── */

export interface Product {
  id: ID;
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
  occasions: string[];
  artisanId: ID | null;
  collectionIds: ID[];
  dimensions: { lengthM: number; widthM: number; blousePieceM: number };
  weightG: number;
  description: string;
  story: string;
  care: string;
  textileId: ID;
  drape: DrapeConfig;
  renders: Render[];
  tags: string[];
  seo: { title: string; description: string };
  status: "draft" | "published";
  inventory: Inventory;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export type CollectionKind = "region" | "weave" | "technique" | "colour" | "story" | "community";

export interface Collection {
  id: ID;
  slug: string;
  name: string;
  kind: CollectionKind;
  tagline: string;
  description: string;
  featured: boolean;
  /** Product whose textile represents the collection. */
  coverProductId: ID | null;
  order: number;
}

export interface Artisan {
  id: ID;
  slug: string;
  name: string;
  community: string;
  region: string;
  state: string;
  tradition: string;
  techniques: string[];
  since: number;
  bio: string;
  story: string;
  quote: string;
  portraitKey?: string;
}

/* ───────────────────────── Commerce ───────────────────────── */

export interface OrderLine {
  productId: ID;
  name: string;
  price: number;
  quantity: number;
}

export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

export interface Order {
  id: ID;
  number: string;
  customerId: ID;
  lines: OrderLine[];
  subtotal: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  address: { name: string; line1: string; city: string; state: string; pincode: string; phone: string };
  note?: string;
  createdAt: string;
}

export interface Customer {
  id: ID;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  createdAt: string;
}

/* ───────────────────────── Content ───────────────────────── */

export interface Story {
  id: ID;
  slug: string;
  title: string;
  kind: "craft" | "artisan" | "campaign";
  excerpt: string;
  body: string;
  productIds: ID[];
  published: boolean;
}

export interface SiteContent {
  banner: { enabled: boolean; text: string };
  hero: {
    headline: string;
    tagline: string;
    primaryCta: string;
    secondaryCta: string;
    productIds: ID[];
    intervalSeconds: number;
  };
  idea: { eyebrow: string; headline: string; steps: { title: string; body: string }[] };
  collection: { headline: string; productIds: ID[] };
  craft: { headline: string; body: string; artisanIds: ID[] };
  draping: { headline: string; body: string };
  stories: { headline: string; collectionIds: ID[] };
  legacy: { headline: string; body: string };
}

export interface StudioSettings {
  defaults: DrapeConfig;
  quality: RenderQuality;
  views: ViewId[];
}

export type Role = "owner" | "manager" | "staff";

export interface User {
  id: ID;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
}

export interface Media {
  key: string;
  contentType: string;
  bytes: number;
  kind: "scan" | "original" | "render" | "portrait" | "other";
  createdAt: string;
}

export interface Database {
  products: Product[];
  textiles: Textile[];
  collections: Collection[];
  artisans: Artisan[];
  orders: Order[];
  customers: Customer[];
  stories: Story[];
  media: Media[];
  users: User[];
  content: SiteContent;
  studio: StudioSettings;
}

/** What the storefront needs to draw a saree, without the whole product. */
export interface TextileRef {
  id: ID;
  source: Textile["source"];
  spec?: TextileSpec;
  scanUrl?: string;
}
