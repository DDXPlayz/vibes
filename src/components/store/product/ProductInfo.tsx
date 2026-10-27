"use client";

import Link from "next/link";
import { cx, num, price } from "@/lib/format";
import { availabilityLine, canPurchase, type ProductView } from "@/lib/view";
import { HeartIcon } from "../Icons";
import { useStore } from "../StoreProvider";
import styles from "./product.module.css";

export function ProductInfo({ p }: { p: ProductView }) {
  const { addToBag, toggleWish, isWished, notify, bag } = useStore();
  const wished = isWished(p.id);
  const inBag = bag.find((l) => l.productId === p.id);
  const buyable = canPurchase(p);
  const atMax = !!inBag && inBag.quantity >= p.available;
  return (
    <div className={styles.info}>
      <span className="num">No. {num(p.number)}</span>
      <h1 className="h2" style={{ fontSize: "clamp(44px, 5vw, 76px)" }}>{p.name}</h1>
      <p className="label">
        {p.weave} · {p.fabric}
      </p>
      <div className="row" style={{ marginTop: 8 }}>
        <span className="serif" style={{ fontSize: 28 }}>{p.availability === "sold" || p.availability === "archived" ? "—" : price(p.price)}</span>
        <span className="spacer" />
        <span className={cx("badge", p.availability)}>{availabilityLine(p)}</span>
      </div>
      <p className="lede" style={{ fontSize: 21 }}>{p.description}</p>
      <div className={styles.actions}>
        {buyable ? (
          <button
            className="btn btn-block"
            disabled={atMax}
            onClick={() => {
              addToBag({ productId: p.id, slug: p.slug, name: p.name, price: p.price, max: p.available });
              notify(`${p.name} is in your bag`, "/bag", "View bag");
            }}
          >
            {atMax ? "In your bag" : "Add to bag"}
          </button>
        ) : (
          <a className="btn btn-block btn-ghost" href={`mailto:house@vibes.in?subject=${encodeURIComponent(`Enquiry — No. ${num(p.number)} ${p.name}`)}`}>
            {p.availability === "reserved" ? "Join the waiting list" : "Ask us for something similar"}
          </a>
        )}
        <button
          className={cx("btn btn-gold", styles.wish)}
          onClick={() => {
            const added = toggleWish(p.id);
            notify(added ? "Added to your collection" : "Removed from your collection", "/wishlist", "View");
          }}
          aria-pressed={wished}
        >
          <HeartIcon size={16} filled={wished} /> {wished ? "In your collection" : "Add to collection"}
        </button>
      </div>
      {p.availability === "sold" && <p className="body muted">This saree has found its home. It stays here, in the archive, as part of our history.</p>}
      {p.inventoryModel === "unique" && buyable && <p className="body muted" style={{ fontSize: 13 }}>One of one. When it is gone, it will live on in our archive.</p>}
      <dl className="kv" style={{ marginTop: 16 }}>
        <dt>Fabric</dt>
        <dd>{p.fabric}</dd>
        <dt>Weave</dt>
        <dd>{p.weave}</dd>
        <dt>Region</dt>
        <dd>
          {p.region}, {p.state}
        </dd>
        {p.artisan && (
          <>
            <dt>Woven by</dt>
            <dd>
              <Link href={`/artisans/${p.artisan.slug}`} className="link" style={{ textTransform: "none", letterSpacing: 0, fontSize: 14 }}>
                {p.artisan.name}
              </Link>
            </dd>
          </>
        )}
        <dt>Technique</dt>
        <dd>{p.technique}</dd>
      </dl>
      <p className="body muted" style={{ fontSize: 13 }}>Insured shipping across India · Viewing by appointment in Mumbai and Kolkata</p>
    </div>
  );
}
