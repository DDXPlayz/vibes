"use client";

import Link from "next/link";
import { cx, num, price } from "@/lib/format";
import { availabilityLine, type ProductView } from "@/lib/view";
import { HeartIcon } from "./Icons";
import { RenderImage } from "./RenderImage";
import { useStore } from "./StoreProvider";

/** A piece in the gallery — not a SKU tile. */
export function ProductCard({ p, size = "md", priority }: { p: ProductView; size?: "sm" | "md" | "lg"; priority?: boolean }) {
  const { isWished, toggleWish, notify } = useStore();
  const wished = isWished(p.id);
  const archived = p.availability === "sold" || p.availability === "archived";
  const w = size === "lg" ? 720 : size === "sm" ? 420 : 540;
  const h = Math.round((w * 4) / 3);
  return (
    <Link href={`/saree/${p.slug}`} className={cx("card", archived && "archived")}>
      <div className="card-media">
        <RenderImage product={p} view="full" width={w} height={h} priority={priority} />
        <RenderImage product={p} view="three-quarter" width={w} height={h} className="alt" />
        <button
          className={cx("icon-btn wish-btn", wished && "on")}
          aria-label={wished ? "Remove from your collection" : "Add to your collection"}
          onClick={(e) => {
            e.preventDefault();
            const added = toggleWish(p.id);
            notify(added ? `${p.name} added to your collection` : `${p.name} removed`, "/wishlist", "View");
          }}
          style={{ color: wished ? "var(--gold)" : undefined }}
        >
          <HeartIcon filled={wished} size={18} />
        </button>
      </div>
      <div className="card-meta">
        <div className="card-title">
          <h3>{p.name}</h3>
          <span className="num">No. {num(p.number)}</span>
        </div>
        <span className="card-sub">
          {p.fabric} · {p.weave}
        </span>
        <span className="card-sub muted">
          {p.artisan ? `${p.artisan.name}, ` : ""}
          {p.region}
        </span>
        <div className="card-foot">
          <span>{archived ? <span className="muted">—</span> : price(p.price)}</span>
          <span className={cx("badge", p.availability)}>{availabilityLine(p)}</span>
        </div>
      </div>
    </Link>
  );
}
