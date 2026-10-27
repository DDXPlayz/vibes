"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudioCanvas } from "@/components/three/StudioCanvas";
import type { Suggestions } from "@/lib/assist";
import type { Artisan, Collection, DrapeConfig, Render, TextileAnalysis, ViewId } from "@/lib/types";
import { canvasToBlob, loadImageFile, processScan, samplePhoto, type ScanAdjust, type ScanResult } from "@/studio/scan";
import { emptyDraft, ProductFields, type ProductDraft } from "./ProductFields";
import { StudioControls } from "./StudioControls";
import { api, upload } from "./ui";

type Step = "scan" | "details" | "studio" | "generate" | "review";
const STEPS: { id: Step; label: string }[] = [
  { id: "scan", label: "Upload scan" },
  { id: "details", label: "Details" },
  { id: "studio", label: "Studio" },
  { id: "generate", label: "Generate" },
  { id: "review", label: "Review & publish" },
];
const VIEWS: ViewId[] = ["full", "front", "three-quarter", "side", "back", "pallu", "border", "weave"];

export function AddSaree({ artisans, collections, defaults }: { artisans: Artisan[]; collections: Collection[]; defaults: DrapeConfig }) {
  const [step, setStep] = useState<Step>("scan");
  const [started] = useState(() => Date.now());
  const [source, setSource] = useState<{ blob: Blob; img: HTMLImageElement | HTMLCanvasElement; name: string } | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [adjust, setAdjust] = useState<Partial<ScanAdjust>>({});
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [suggested, setSuggested] = useState<Partial<Record<keyof ProductDraft, boolean>>>({});
  const [sugg, setSugg] = useState<Suggestions | null>(null);
  const [drape, setDrape] = useState<DrapeConfig>(defaults);
  const [blouse, setBlouse] = useState("#3a2a2a");
  const [replay, setReplay] = useState(1);
  const [log, setLog] = useState<{ label: string; state: "wait" | "run" | "done" }[]>([]);
  const [product, setProduct] = useState<{ id: string; slug: string; renders: Render[] } | null>(null);
  const [published, setPublished] = useState(false);
  const draftId = useRef(`draft-${Math.random().toString(36).slice(2, 8)}`);

  const set = (p: Partial<ProductDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setSuggested((s) => {
      const n = { ...s };
      Object.keys(p).forEach((k) => delete n[k as keyof ProductDraft]);
      return n;
    });
  };

  /* step 1: process the photograph */
  const run = useCallback(async (img: HTMLImageElement | HTMLCanvasElement, adj: Partial<ScanAdjust>) => {
    setBusy(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 30));
      const res = await processScan(img, adj);
      setScan(res);
      const blob = await canvasToBlob(res.processed);
      setScanUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      draftId.current = `draft-${Math.random().toString(36).slice(2, 8)}`;
      const top = res.analysis.dominantColours;
      setBlouse(top[1]?.hex ?? top[0]?.hex ?? "#3a2a2a");
      setDraft((d) => ({ ...d, dimensions: { ...d.dimensions, lengthM: Math.min(6.5, Math.max(4.5, res.analysis.estimatedLengthM)) } }));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }, []);

  const onFile = async (f: File) => {
    try {
      const img = await loadImageFile(f);
      setSource({ blob: f, img, name: f.name });
      setAdjust({});
      run(img, {});
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const onSample = async () => {
    const c = samplePhoto();
    const blob = await canvasToBlob(c);
    setSource({ blob, img: c, name: "sample-photo.jpg" });
    setAdjust({});
    run(c, {});
  };

  /* step 2: ask the assistant */
  const askAssistant = useCallback(async () => {
    if (!scan) return;
    try {
      const s = await api<Suggestions>("/api/admin/assist", "POST", { ...draft, analysis: scan.analysis });
      setSugg(s);
    } catch {
      /* suggestions are optional */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan, draft.name, draft.fabric, draft.weave, draft.region, draft.state, draft.technique]);
  useEffect(() => {
    if (step !== "details") return;
    const t = setTimeout(askAssistant, 400);
    return () => clearTimeout(t);
  }, [step, askAssistant]);

  const applyAll = () => {
    if (!sugg) return;
    const p: Partial<ProductDraft> = {};
    if (sugg.colour && !draft.colour) p.colour = sugg.colour;
    if (sugg.description && !draft.description) p.description = sugg.description;
    p.tags = [...new Set([...draft.tags, ...sugg.tags])];
    p.occasions = [...new Set([...draft.occasions, ...sugg.occasions])];
    p.collectionIds = [...new Set([...draft.collectionIds, ...sugg.collectionIds])];
    if (sugg.seoTitle) p.seo = { title: sugg.seoTitle, description: sugg.seoDescription ?? "" };
    setDraft((d) => ({ ...d, ...p }));
    setSuggested(Object.fromEntries(Object.keys(p).map((k) => [k, true])));
  };

  const textileRef = useMemo(() => (scanUrl ? { id: draftId.current, source: "scan" as const, scanUrl } : null), [scanUrl]);
  const fibre = useMemo(() => {
    const silk = /silk|katan|muga|tussar/i.test(draft.fabric) && !/cotton/i.test(draft.fabric);
    return { sheen: silk ? 0.8 : 0.25, sheer: /muslin|kota|organza|chanderi/i.test(`${draft.fabric} ${draft.weave}`) ? 0.35 : 0 };
  }, [draft.fabric, draft.weave]);

  /* step 4: generate everything */
  const generate = async () => {
    if (!source || !scan) return;
    setStep("generate");
    setError(null);
    const steps = ["Store the original photograph", "Store the processed textile", "Create the textile record", ...VIEWS.map((v) => `Render ${v.replace("-", " ")} view`), "Write product page, metadata & search tags"];
    setLog(steps.map((label) => ({ label, state: "wait" })));
    const mark = (i: number, state: "run" | "done") => setLog((l) => l.map((x, j) => (j === i ? { ...x, state } : x)));
    try {
      mark(0, "run");
      const original = await upload(source.blob, "original", source.name);
      mark(0, "done");
      mark(1, "run");
      const processed = await upload(await canvasToBlob(scan.processed), "scan", "scan.jpg");
      mark(1, "done");
      mark(2, "run");
      const textile = await api<{ id: string }>("/api/admin/textiles", "POST", { scanKey: processed.key, originalKey: original.key, analysis: scan.analysis as TextileAnalysis });
      mark(2, "done");
      const { render } = await import("@/studio/renderFarm");
      const renders: Render[] = [];
      for (let i = 0; i < VIEWS.length; i++) {
        mark(3 + i, "run");
        const url = await render({ textile: { id: textile.id, source: "scan", scanUrl: processed.url }, fibre, blouse, drape, view: VIEWS[i], theme: "light", width: 900, height: 1200, transparent: true, quality: "standard" });
        const blob = await fetch(url).then((r) => r.blob());
        const up = await upload(blob, "render", `${VIEWS[i]}.webp`);
        renders.push({ view: VIEWS[i], mediaKey: up.key, width: 900, height: 1200, createdAt: new Date().toISOString() });
        mark(3 + i, "done");
      }
      const last = 3 + VIEWS.length;
      mark(last, "run");
      const created = await api<{ id: string; slug: string }>("/api/admin/products", "POST", {
        ...draft,
        seo: draft.seo.title ? draft.seo : { title: `${draft.name} | VIBES`, description: draft.description },
        textileId: textile.id,
        drape,
        renders,
        status: "draft",
      });
      // the blouse colour lives with the textile's spec for scanned pieces
      await api(`/api/admin/textiles/${textile.id}`, "PATCH", { spec: { base: scan.analysis.dominantColours[0]?.hex ?? "#777", border: { color: "#000", style: "plain", width: scan.analysis.borderRatio, zari: false }, motif: { kind: "none", color: "#000", zari: false, scale: 1, density: 0 }, pallu: { kind: "plain", color: "#000", zari: false, start: scan.analysis.palluStart }, blouse, sheen: fibre.sheen, sheer: fibre.sheer } });
      mark(last, "done");
      setProduct({ id: created.id, slug: created.slug, renders });
      setTimeout(() => setStep("review"), 700);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const elapsed = Math.round((Date.now() - started) / 1000);
  const idx = STEPS.findIndex((s) => s.id === step);
  const a = scan?.analysis;

  return (
    <div>
      <div className="adm-head">
        <div>
          <h1 className="adm-h1">Add a saree</h1>
          <p>Photograph it once. The studio does the rest.</p>
        </div>
      </div>
      <ol className="adm-steps" style={{ padding: 0 }}>
        {STEPS.map((s, i) => (
          <li key={s.id} className={i === idx ? "on" : i < idx ? "done" : ""}>
            <span className="n">{i < idx ? "✓" : i + 1}</span>
            <span className="t">{s.label}</span>
          </li>
        ))}
      </ol>
      {error && <p className="adm-err" style={{ marginBottom: 16 }}>{error}</p>}

      {step === "scan" && (
        <div className="adm-grid">
          {!scan ? (
            <>
              <DropZone onFile={onFile} busy={busy} />
              <p className="adm-note" style={{ textAlign: "center" }}>
                No saree to hand?{" "}
                <button className="link" onClick={onSample} style={{ fontSize: 11 }}>
                  Try a sample photograph
                </button>
              </p>
            </>
          ) : (
            <>
              <div className="adm-split" style={{ gridTemplateColumns: "1fr 2fr" }}>
                <div className="adm-card">
                  <h2>Original photograph</h2>
                  <OriginalPreview img={source!.img} crop={a!.crop} />
                  <p className="adm-note" style={{ marginTop: 10 }}>Kept untouched as the record. The cloth was found automatically{a?.crop ? "" : " (whole frame used)"}.</p>
                </div>
                <div className="adm-card">
                  <h2>Processed textile</h2>
                  <ScanPreview canvas={scan.processed} analysis={a!} />
                  <div className="row" style={{ marginTop: 16, flexWrap: "wrap", gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { const n = { ...adjust, rotate: (((adjust.rotate ?? scan.autoAdjust.rotate) + 180) % 360) as ScanAdjust["rotate"], flip: adjust.flip ?? scan.autoAdjust.flip }; setAdjust(n); run(source!.img, n); }}>
                      Pallu is on the wrong end
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { const n = { ...adjust, rotate: (((adjust.rotate ?? scan.autoAdjust.rotate) + 90) % 360) as ScanAdjust["rotate"] }; setAdjust(n); run(source!.img, n); }}>
                      Rotate 90°
                    </button>
                    <label className="row adm-note" style={{ gap: 8 }}>
                      Border
                      <input type="range" min={0.02} max={0.2} step={0.005} value={adjust.borderRatio ?? a!.borderRatio} onChange={(e) => { const n = { ...adjust, borderRatio: +e.target.value }; setAdjust(n); setScan({ ...scan, analysis: { ...scan.analysis, borderRatio: +e.target.value } }); }} />
                    </label>
                    <label className="row adm-note" style={{ gap: 8 }}>
                      Pallu starts
                      <input type="range" min={0.6} max={0.95} step={0.005} value={adjust.palluStart ?? a!.palluStart} onChange={(e) => { const n = { ...adjust, palluStart: +e.target.value }; setAdjust(n); setScan({ ...scan, analysis: { ...scan.analysis, palluStart: +e.target.value } }); }} />
                    </label>
                  </div>
                </div>
              </div>
              <div className="adm-stats">
                <div className="adm-stat">
                  <span className="label">Dominant colours</span>
                  <div className="row" style={{ gap: 6, marginTop: 10 }}>
                    {a!.dominantColours.map((c) => (
                      <span key={c.hex} title={`${c.name} · ${Math.round(c.share * 100)}%`} className="adm-swatch" style={{ background: c.hex }} />
                    ))}
                  </div>
                  <div className="s" style={{ marginTop: 8, textTransform: "capitalize" }}>{a!.dominantColours.slice(0, 3).map((c) => c.name).join(", ")}</div>
                </div>
                <div className="adm-stat">
                  <span className="label">Pattern</span>
                  <div className="v" style={{ fontSize: 24, textTransform: "capitalize" }}>{a!.pattern.replace("-", " ")}</div>
                  <div className="s">{Math.round(a!.patternConfidence * 100)}% confident</div>
                </div>
                <div className="adm-stat">
                  <span className="label">Zari</span>
                  <div className="v">{Math.round(a!.zariCoverage * 100)}%</div>
                  <div className="s">{a!.zariCoverage > 0.015 ? "Metallic thread found" : "None detected"}</div>
                </div>
                <div className="adm-stat">
                  <span className="label">Approx. size</span>
                  <div className="v">{a!.estimatedLengthM} m</div>
                  <div className="s">× {a!.estimatedWidthM} m · border {Math.round(a!.borderRatio * 100)}%</div>
                </div>
                <div className="adm-stat">
                  <span className="label">Processed in</span>
                  <div className="v">{(scan.timings.reduce((s, t) => s + t.ms, 0) / 1000).toFixed(1)}s</div>
                  <div className="s">{scan.timings.map((t) => t.step).join(" · ")}</div>
                </div>
              </div>
              <div className="row">
                <button className="btn btn-ghost" onClick={() => { setScan(null); setSource(null); }}>Use a different photo</button>
                <span className="spacer" />
                <button className="btn" onClick={() => setStep("details")} disabled={busy}>Looks right — continue</button>
              </div>
            </>
          )}
        </div>
      )}

      {step === "details" && (
        <form className="adm-split" style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }} onSubmit={(e) => { e.preventDefault(); setStep("studio"); }}>
          <div className="adm-card">
            <ProductFields d={draft} set={set} artisans={artisans} collections={collections} suggested={suggested} />
            <div className="row" style={{ marginTop: 28 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep("scan")}>Back</button>
              <span className="spacer" />
              <button className="btn" disabled={!draft.name || !draft.price}>Continue to studio</button>
            </div>
          </div>
          <aside className="adm-grid" style={{ position: "sticky", top: 84 }}>
            <div className="adm-card">
              <h2>Textile</h2>
              <ScanPreview canvas={scan!.processed} analysis={scan!.analysis} />
            </div>
            <div className="adm-card">
              <h2>Assistant suggestions</h2>
              {!sugg ? (
                <p className="adm-note">Reading the scan…</p>
              ) : (
                <div className="adm-grid" style={{ gap: 10 }}>
                  <p className="adm-note" style={{ margin: 0 }}>Suggestions only — nothing is applied until you choose. Always check against the saree in your hands.</p>
                  {sugg.colour && <Suggest label="Colour" value={sugg.colour} onApply={() => { setDraft((d) => ({ ...d, colour: sugg.colour! })); setSuggested((s) => ({ ...s, colour: true })); }} />}
                  {sugg.description && <Suggest label="Description" value={sugg.description} onApply={() => { setDraft((d) => ({ ...d, description: sugg.description! })); setSuggested((s) => ({ ...s, description: true })); }} />}
                  {sugg.tags.length > 0 && <Suggest label="Search tags" value={sugg.tags.join(", ")} onApply={() => setDraft((d) => ({ ...d, tags: [...new Set([...d.tags, ...sugg.tags])] }))} />}
                  {sugg.occasions.length > 0 && <Suggest label="Occasions" value={sugg.occasions.join(", ")} onApply={() => setDraft((d) => ({ ...d, occasions: [...new Set([...d.occasions, ...sugg.occasions])] }))} />}
                  {sugg.collectionIds.length > 0 && <Suggest label="Collections" value={sugg.collectionIds.map((id) => collections.find((c) => c.id === id)?.name).join(", ")} onApply={() => setDraft((d) => ({ ...d, collectionIds: [...new Set([...d.collectionIds, ...sugg.collectionIds])] }))} />}
                  {sugg.seoTitle && <Suggest label="Search engine title" value={sugg.seoTitle} onApply={() => setDraft((d) => ({ ...d, seo: { title: sugg.seoTitle!, description: sugg.seoDescription ?? "" } }))} />}
                  {sugg.notes.map((n) => (
                    <p key={n} className="adm-note" style={{ margin: 0 }}>⚑ {n}</p>
                  ))}
                  <button type="button" className="btn btn-gold btn-sm" onClick={applyAll}>Apply all suggestions</button>
                </div>
              )}
            </div>
          </aside>
        </form>
      )}

      {step === "studio" && textileRef && (
        <div className="adm-split">
          <div className="adm-card">
            <StudioControls value={drape} onChange={setDrape} />
            <div className="adm-form" style={{ marginTop: 22 }}>
              <label className="field">
                <span>Blouse colour</span>
                <div className="row" style={{ gap: 8 }}>
                  <input type="color" value={blouse} onChange={(e) => setBlouse(e.target.value)} style={{ width: 44, height: 34, border: 0, background: "none" }} />
                  {scan!.analysis.dominantColours.map((c) => (
                    <button type="button" key={c.hex} className="adm-swatch" style={{ background: c.hex, outline: blouse === c.hex ? "2px solid var(--gold)" : undefined }} onClick={() => setBlouse(c.hex)} title={c.name} />
                  ))}
                </div>
              </label>
            </div>
            <div className="row" style={{ marginTop: 28 }}>
              <button className="btn btn-ghost" onClick={() => setStep("details")}>Back</button>
              <span className="spacer" />
              <button className="btn btn-gold" onClick={generate}>Generate</button>
            </div>
          </div>
          <div>
            <div className="stage adm-preview">
              <StudioCanvas item={{ id: draftId.current, textile: textileRef, fibre, blouse, drape }} mode={{ kind: "preview", view: "full", replay }} quality="standard" />
            </div>
            <button className="link" style={{ marginTop: 12 }} onClick={() => setReplay((r) => r + 1)}>▶ Play the drape</button>
          </div>
        </div>
      )}

      {step === "generate" && (
        <div className="adm-split">
          <div className="adm-card">
            <h2>Generating</h2>
            <ul className="adm-log">
              {log.map((l) => (
                <li key={l.label} className={l.state}>
                  <span className="dot">{l.state === "done" ? "✓" : ""}</span>
                  {l.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="stage adm-preview">
            {textileRef && <StudioCanvas item={{ id: draftId.current, textile: textileRef, fibre, blouse, drape }} mode={{ kind: "preview", view: "three-quarter", replay: 1 }} quality="draft" />}
          </div>
        </div>
      )}

      {step === "review" && product && (
        <div className="adm-grid">
          <div className="adm-card">
            <div className="row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0 }}>{draft.name}</h2>
                <p className="adm-note" style={{ margin: "4px 0 0" }}>
                  From photograph to finished product page in {Math.floor(elapsed / 60)}m {elapsed % 60}s. {product.renders.length} views rendered from one scan.
                </p>
              </div>
              <span className="spacer" />
              {published ? (
                <>
                  <span className="adm-pill published">Published</span>
                  <Link className="btn btn-sm" href={`/saree/${product.slug}`} target="_blank">View on the store ↗</Link>
                </>
              ) : (
                <>
                  <Link className="btn btn-ghost btn-sm" href={`/admin/products/${product.id}`}>Save draft & edit</Link>
                  <button
                    className="btn btn-gold btn-sm"
                    onClick={async () => {
                      await api(`/api/admin/products/${product.id}`, "PATCH", { status: "published" });
                      setPublished(true);
                    }}
                  >
                    Publish
                  </button>
                </>
              )}
            </div>
            <div className="adm-renders">
              {product.renders.map((r) => (
                <figure key={r.view}>
                  <div className="img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/media/${r.mediaKey}`} alt={r.view} />
                  </div>
                  {r.view.replace("-", " ")}
                </figure>
              ))}
            </div>
          </div>
          <Link href="/admin/products/new" className="link" onClick={() => location.reload()}>+ Add another saree</Link>
        </div>
      )}
    </div>
  );
}

function Suggest({ label, value, onApply }: { label: string; value: string; onApply: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <div className="adm-suggest">
      <div className="row" style={{ gap: 8 }}>
        <span className="label" style={{ fontSize: 10 }}>{label}</span>
        <span className="spacer" />
        <button type="button" className="link" style={{ fontSize: 10 }} onClick={() => { onApply(); setDone(true); }}>
          {done ? "Applied ✓" : "Apply"}
        </button>
      </div>
      <span>{value}</span>
    </div>
  );
}

function DropZone({ onFile, busy }: { onFile: (f: File) => void; busy: boolean }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`adm-drop${over ? " over" : ""}`}
      onClick={() => input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
    >
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <div className="stack" style={{ justifyItems: "center" }}>
        <span className="serif" style={{ fontSize: 30 }}>{busy ? "Reading the cloth…" : "Drop the saree photograph here"}</span>
        <span className="adm-note">Lay the saree flat and full-length, photographed from above in even light. JPEG, PNG or WebP. On a phone, tap to use the camera.</span>
        <span className="btn btn-sm" style={{ marginTop: 8 }}>Choose photo</span>
      </div>
    </div>
  );
}

function OriginalPreview({ img, crop }: { img: HTMLImageElement | HTMLCanvasElement; crop?: TextileAnalysis["crop"] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const k = 360 / Math.max(img.width, img.height);
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0, c.width, c.height);
    if (crop) {
      g.strokeStyle = "#e7c46f";
      g.lineWidth = 2;
      g.setLineDash([6, 4]);
      g.strokeRect(crop.x * c.width, crop.y * c.height, crop.w * c.width, crop.h * c.height);
    }
  }, [img, crop]);
  return <canvas ref={ref} style={{ width: "100%", maxHeight: 420, objectFit: "contain" }} />;
}

function ScanPreview({ canvas, analysis }: { canvas: HTMLCanvasElement; analysis: TextileAnalysis }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    c.width = 1200;
    c.height = Math.round((1200 * canvas.height) / canvas.width);
    c.getContext("2d")!.drawImage(canvas, 0, 0, c.width, c.height);
  }, [canvas]);
  const b = analysis.borderRatio * 100;
  const p = analysis.palluStart * 100;
  return (
    <div className="adm-scan">
      <canvas ref={ref} />
      <div className="adm-overlay">
        <div className="b" style={{ top: 0, height: `${b}%` }} />
        <div className="b" style={{ bottom: 0, height: `${b}%` }} />
        <div className="p" style={{ left: `${p}%`, right: 0 }} />
        <span className="tag" style={{ left: 6, top: 4 }}>Border</span>
        <span className="tag" style={{ left: `calc(${p}% + 6px)`, top: "40%" }}>Pallu</span>
        <span className="tag" style={{ left: 6, top: "40%" }}>Body</span>
      </div>
    </div>
  );
}
