import type { Database, Order, Product } from "@/lib/types";

/**
 * Inventory rules for one-of-one textiles.
 *
 *   checkout   → reserve (unique: available → reserved)
 *   payment    → commit  (quantity falls; at zero → sold, stays in archive)
 *   cancel     → release (reserved → available)
 */

export function availableQty(p: Product) {
  return p.inventory.state === "available" ? Math.max(0, p.inventory.quantity - p.inventory.reserved) : 0;
}

export function reserve(p: Product, qty: number) {
  p.inventory.reserved += qty;
  if (p.inventory.quantity - p.inventory.reserved <= 0) p.inventory.state = "reserved";
}

export function commit(p: Product, qty: number) {
  p.inventory.reserved = Math.max(0, p.inventory.reserved - qty);
  p.inventory.quantity = Math.max(0, p.inventory.quantity - qty);
  if (p.inventory.quantity === 0) p.inventory.state = "sold";
  else if (p.inventory.quantity - p.inventory.reserved > 0) p.inventory.state = "available";
}

export function release(p: Product, qty: number) {
  p.inventory.reserved = Math.max(0, p.inventory.reserved - qty);
  if (p.inventory.state === "reserved" && p.inventory.quantity - p.inventory.reserved > 0) p.inventory.state = "available";
}

/** Apply an order status change to stock. */
export function transitionOrder(db: Database, order: Order, next: Order["status"]) {
  const prev = order.status;
  if (prev === next) return;
  for (const l of order.lines) {
    const p = db.products.find((x) => x.id === l.productId);
    if (!p) continue;
    if (prev === "pending" && next === "paid") commit(p, l.quantity);
    else if (prev === "pending" && next === "cancelled") release(p, l.quantity);
    else if ((prev === "paid" || prev === "shipped") && next === "cancelled") {
      // restock a cancelled paid order
      p.inventory.quantity += l.quantity;
      if (p.inventory.state === "sold") p.inventory.state = "available";
    }
    p.updatedAt = new Date().toISOString();
  }
  order.status = next;
}
