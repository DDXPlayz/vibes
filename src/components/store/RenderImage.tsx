"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import type { ViewId } from "@/lib/types";
import type { ProductView } from "@/lib/view";
import { TextileSwatch } from "./TextileSwatch";

type Renderable = Pick<ProductView, "name" | "textile" | "fibre" | "blouse" | "drape" | "renders">;

/**
 * A still of the saree from the digital studio. Uses a stored render when
 * one exists; otherwise renders on demand (once, cached) when scrolled near.
 * Without WebGL it falls back to the flat textile itself.
 */
export function RenderImage({ product, view, width, height, className, priority }: { product: Renderable; view: ViewId; width: number; height: number; className?: string; priority?: boolean }) {
  const { theme } = useTheme();
  const stored = product.renders.find((r) => r.view === view)?.url;
  const [url, setUrl] = useState<string | null>(stored ?? null);
  const [failed, setFailed] = useState(false);
  const [near, setNear] = useState(!!priority);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (near || !ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "400px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (stored || !near) return;
    let live = true;
    import("@/studio/renderFarm")
      .then(({ render }) =>
        render({
          textile: product.textile,
          fibre: product.fibre,
          blouse: product.blouse,
          drape: product.drape,
          view,
          theme,
          width,
          height,
          transparent: true,
        }),
      )
      .then((u) => live && setUrl(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [near, stored, theme, view, width, height, product.textile, product.fibre, product.blouse, product.drape]);

  if (failed) return <TextileSwatch textile={product.textile} className={className} folded />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      className={className}
      src={url ?? "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
      alt={`${product.name} — ${view} view`}
      width={width}
      height={height}
      style={{ opacity: url ? undefined : 0, transition: "opacity 1200ms var(--ease-silk)" }}
      draggable={false}
    />
  );
}
