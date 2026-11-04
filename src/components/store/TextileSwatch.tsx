"use client";

import { useEffect, useRef } from "react";
import type { TextileRef } from "@/lib/types";

/**
 * The flat textile — the source of truth — drawn into a canvas.
 * `region` picks a slice along the length (0..1), so we can show the body,
 * the border, or the pallu. `folded` shows it as a folded stack with soft
 * shading: the graceful fallback when WebGL is unavailable.
 */
export function TextileSwatch({ textile, region = [0, 1], className, folded, style, quality = "draft" }: { textile: TextileRef; region?: [number, number]; className?: string; folded?: boolean; style?: React.CSSProperties; quality?: "draft" | "standard" | "high" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    import("@/studio/registry").then(({ getSurface }) =>
      getSurface(textile, quality).then((s) => {
        const c = ref.current;
        if (!live || !c) return;
        const w = c.clientWidth || 300;
        const h = c.clientHeight || 300;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        const g = c.getContext("2d")!;
        const sx = region[0] * s.width;
        const sw = (region[1] - region[0]) * s.width;
        if (!folded) {
          // cover-fit the region
          const scale = Math.max(c.width / sw, c.height / s.height);
          const dw = sw * scale;
          const dh = s.height * scale;
          g.drawImage(s.colour, sx, 0, sw, s.height, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
          return;
        }
        // folded stack: three folds of the body + the pallu on top
        g.clearRect(0, 0, c.width, c.height);
        const fw = c.width * 0.7;
        const fh = c.height * 0.16;
        const x = (c.width - fw) / 2;
        const slices: [number, number][] = [[0.1, 0.25], [0.3, 0.45], [0.5, 0.65], [0.8, 0.98]];
        slices.forEach(([a, b], i) => {
          const y = c.height * 0.3 + i * fh * 0.82;
          g.save();
          g.shadowColor = "rgba(0,0,0,0.18)";
          g.shadowBlur = 18 * dpr;
          g.shadowOffsetY = 6 * dpr;
          g.drawImage(s.colour, a * s.width, 0, (b - a) * s.width, s.height, x, y, fw, fh);
          g.restore();
          const grd = g.createLinearGradient(0, y, 0, y + fh);
          grd.addColorStop(0, "rgba(255,255,255,0.12)");
          grd.addColorStop(0.5, "rgba(0,0,0,0)");
          grd.addColorStop(1, "rgba(0,0,0,0.18)");
          g.fillStyle = grd;
          g.fillRect(x, y, fw, fh);
        });
      }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textile.id, textile.scanUrl, region[0], region[1], folded, quality]);
  return <canvas ref={ref} className={className} style={{ width: "100%", height: "100%", ...style }} aria-hidden />;
}
