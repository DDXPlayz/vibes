"use client";

import { RenderImage } from "@/components/store/RenderImage";
import type { ProductView } from "@/lib/view";

export function AdminThumb({ p, big }: { p: ProductView; big?: boolean }) {
  return (
    <div className="adm-thumb" style={big ? { width: "100%", height: "auto", aspectRatio: "3/4" } : undefined}>
      <RenderImage product={p} view="full" width={big ? 360 : 120} height={big ? 480 : 160} />
    </div>
  );
}
