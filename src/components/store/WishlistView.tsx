"use client";

import Link from "next/link";
import type { ProductView } from "@/lib/view";
import { ProductCard } from "./ProductCard";
import { useStore } from "./StoreProvider";

export function WishlistView({ products }: { products: ProductView[] }) {
  const { wishlist } = useStore();
  const items = wishlist.map((id) => products.find((p) => p.id === id)).filter((p): p is ProductView => !!p);
  return (
    <div className="wrap section">
      <span className="eyebrow">Your collection</span>
      <h1 className="h2" style={{ marginTop: 20, maxWidth: "14ch" }}>
        {items.length ? <>The pieces you <em>keep returning to.</em></> : <>Begin your <em>collection.</em></>}
      </h1>
      {items.length === 0 ? (
        <>
          <p className="lede" style={{ marginTop: 28 }}>Tap the heart on any saree to keep it here. Pieces that find a home stay visible in your collection, in the archive.</p>
          <Link href="/collection" className="btn" style={{ marginTop: 32 }}>Explore the collection</Link>
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 40, marginTop: 64 }}>
          {items.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
