"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { price } from "@/lib/format";
import type { ProductView } from "@/lib/view";
import { CloseIcon } from "./Icons";
import { RenderImage } from "./RenderImage";

const EXAMPLES = ["purple silk sarees", "handwoven sarees under ₹50,000", "Banarasi", "wedding sarees", "lightweight cotton", "red sarees from Bengal"];

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ chips: { label: string }[]; results: ProductView[]; total: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    if (!q.trim()) return setRes(null);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=4`, { signal: ctl.signal })
        .then((r) => r.json())
        .then(setRes)
        .catch(() => {});
    }, 180);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const go = (query: string) => router.push(`/collection?q=${encodeURIComponent(query)}`);

  return (
    <div className="search-overlay" role="dialog" aria-label="Search">
      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 80 }}>
        <div className="row">
          <span className="label">Search the house</span>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close search">
            <CloseIcon />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) go(q);
          }}
          style={{ marginTop: "8vh" }}
        >
          <input ref={input} className="search-input" placeholder="Try “red sarees from Bengal”" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        </form>
        {!res && (
          <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {EXAMPLES.map((x) => (
              <button key={x} className="chip" onClick={() => setQ(x)}>
                {x}
              </button>
            ))}
          </div>
        )}
        {res && (
          <div style={{ marginTop: 28 }}>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {res.chips.length > 0 && <span className="label">Understood as</span>}
              {res.chips.map((c, i) => (
                <span className="chip on" key={i}>
                  {c.label}
                </span>
              ))}
              <span className="spacer" />
              <button className="link" onClick={() => go(q)}>
                See all {res.total} →
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 24, marginTop: 28 }}>
              {res.results.map((p) => (
                <Link key={p.id} href={`/saree/${p.slug}`} className="card">
                  <div className="card-media">
                    <RenderImage product={p} view="full" width={360} height={480} />
                  </div>
                  <div className="card-meta">
                    <div className="card-title">
                      <h3 style={{ fontSize: 20 }}>{p.name}</h3>
                    </div>
                    <span className="card-sub">
                      {p.weave} · {price(p.price)}
                    </span>
                  </div>
                </Link>
              ))}
              {res.results.length === 0 && <p className="lede">Nothing in the archive matches that yet.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
