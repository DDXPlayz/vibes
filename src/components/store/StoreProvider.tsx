"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Bag and wishlist ("Your collection"). Kept client-side and in
 * localStorage so the storefront stays fully static/cacheable; the server
 * re-validates price and availability at checkout.
 */

export interface BagLine {
  productId: string;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  max: number;
}

interface Store {
  bag: BagLine[];
  wishlist: string[];
  addToBag(line: Omit<BagLine, "quantity">, qty?: number): void;
  setQuantity(productId: string, qty: number): void;
  removeFromBag(productId: string): void;
  clearBag(): void;
  toggleWish(productId: string): boolean;
  isWished(productId: string): boolean;
  toast: { text: string; href?: string; cta?: string } | null;
  notify(text: string, href?: string, cta?: string): void;
}

const Ctx = createContext<Store | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [bag, setBag] = useState<BagLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [toast, setToast] = useState<Store["toast"]>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBag(load("vibes-bag", []));
    setWishlist(load("vibes-wish", []));
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) save("vibes-bag", bag);
  }, [bag, ready]);
  useEffect(() => {
    if (ready) save("vibes-wish", wishlist);
  }, [wishlist, ready]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = useCallback((text: string, href?: string, cta?: string) => setToast({ text, href, cta }), []);

  const value = useMemo<Store>(
    () => ({
      bag,
      wishlist,
      toast,
      notify,
      addToBag(line, qty = 1) {
        setBag((b) => {
          const ex = b.find((x) => x.productId === line.productId);
          if (ex) return b.map((x) => (x.productId === line.productId ? { ...x, quantity: Math.min(x.max, x.quantity + qty) } : x));
          return [...b, { ...line, quantity: Math.min(line.max, qty) }];
        });
      },
      setQuantity(id, qty) {
        setBag((b) => b.map((x) => (x.productId === id ? { ...x, quantity: Math.max(1, Math.min(x.max, qty)) } : x)));
      },
      removeFromBag(id) {
        setBag((b) => b.filter((x) => x.productId !== id));
      },
      clearBag() {
        setBag([]);
      },
      toggleWish(id) {
        let added = false;
        setWishlist((w) => {
          added = !w.includes(id);
          return added ? [...w, id] : w.filter((x) => x !== id);
        });
        return !wishlist.includes(id);
      },
      isWished: (id) => wishlist.includes(id),
    }),
    [bag, wishlist, toast, notify],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
