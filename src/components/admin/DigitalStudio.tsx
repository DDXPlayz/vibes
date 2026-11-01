"use client";

import { useState } from "react";
import { StudioCanvas } from "@/components/three/StudioCanvas";
import type { DrapeConfig, RenderQuality, StudioSettings, ViewId } from "@/lib/types";
import type { ProductView } from "@/lib/view";
import { VIEWS } from "@/studio/scene";
import { StudioControls } from "./StudioControls";
import { Options, SaveStatus, api, useSaver } from "./ui";

/**
 * One reusable studio. Every saree is worn by the same model,
 * poses, lights, cameras and backgrounds — set them once here.
 */
export function DigitalStudio({ products, settings }: { products: ProductView[]; settings: StudioSettings }) {
  const [pid, setPid] = useState(products[0]?.id);
  const p = products.find((x) => x.id === pid) ?? products[0];
  const [cfg, setCfg] = useState<DrapeConfig>(settings.defaults);
  const [quality, setQuality] = useState<RenderQuality>(settings.quality);
  const [view, setView] = useState<ViewId>("full");
  const [replay, setReplay] = useState(0);
  const [shots, setShots] = useState<{ view: ViewId; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const saver = useSaver();

  const renderAll = async () => {
    setBusy(true);
    setShots([]);
    const { render } = await import("@/studio/renderFarm");
    for (const v of settings.views) {
      const url = await render({ textile: p.textile, fibre: p.fibre, blouse: p.blouse, drape: cfg, view: v, theme: "light", width: quality === "high" ? 1200 : quality === "standard" ? 900 : 600, height: quality === "high" ? 1600 : quality === "standard" ? 1200 : 800, quality: quality === "high" ? "high" : "standard" });
      setShots((s) => [...s, { view: v, url }]);
    }
    setBusy(false);
  };

  return (
    <div>
      <div className="adm-head">
        <div>
          <h1 className="adm-h1">Digital Studio</h1>
          <p>One model, one set of lights, every saree. Changes here affect how new pieces are presented.</p>
        </div>
        <span className="spacer" />
        <SaveStatus state={saver.state} error={saver.error} />
      </div>
      <div className="adm-split" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)" }}>
        <div className="adm-grid">
          <div className="adm-card">
            <h2>Preview with</h2>
            <select className="select" value={pid} onChange={(e) => setPid(e.target.value)}>
              {products.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} — {x.weave}
                </option>
              ))}
            </select>
          </div>
          <div className="adm-card">
            <StudioControls value={cfg} onChange={setCfg} />
            <div style={{ marginTop: 22 }}>
              <h3 className="label" style={{ margin: "0 0 10px" }}>Camera</h3>
              <Options<ViewId> value={view} onChange={setView} options={(Object.keys(VIEWS) as ViewId[]).map((id) => ({ id, label: VIEWS[id].label }))} />
            </div>
            <div style={{ marginTop: 22 }}>
              <h3 className="label" style={{ margin: "0 0 10px" }}>Render quality</h3>
              <Options<RenderQuality>
                value={quality}
                onChange={setQuality}
                options={[
                  { id: "draft", label: "Draft", note: "Fast — phones & previews" },
                  { id: "standard", label: "Standard", note: "Storefront default" },
                  { id: "high", label: "High", note: "Campaigns, print, soft shadows" },
                ]}
              />
            </div>
          </div>
          <div className="adm-card">
            <h2>Apply</h2>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <button className="btn btn-sm" onClick={() => saver.run(() => api("/api/admin/studio", "PUT", { defaults: cfg, quality }))}>Save as studio default</button>
              <button className="btn btn-ghost btn-sm" onClick={() => saver.run(() => api("/api/admin/studio", "PUT", { defaults: cfg, applyTo: [p.id], keepDefaults: true }))}>
                Apply to “{p.name}”
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (confirm("Re-dress every saree in the archive with this studio setup?")) saver.run(() => api("/api/admin/studio", "PUT", { defaults: cfg, quality, applyTo: "all" }));
                }}
              >
                Apply to every saree
              </button>
            </div>
            <p className="adm-note" style={{ marginTop: 10 }}>The default is used for every new saree. Applying clears stored renders so they are regenerated from the new setup.</p>
          </div>
        </div>
        <div className="adm-grid">
          <div className="stage adm-preview" style={{ aspectRatio: "4 / 5" }}>
            {p && <StudioCanvas item={{ id: p.id, textile: p.textile, fibre: p.fibre, blouse: p.blouse, drape: cfg }} mode={{ kind: "preview", view, replay }} quality={quality} />}
          </div>
          <div className="row">
            <button className="link" onClick={() => setReplay((r) => r + 1)}>▶ Play the drape</button>
            <span className="spacer" />
            <button className="btn btn-gold btn-sm" onClick={renderAll} disabled={busy}>
              {busy ? `Rendering ${shots.length + 1} of ${settings.views.length}…` : "Render all views"}
            </button>
          </div>
          {shots.length > 0 && (
            <div className="adm-card">
              <div className="adm-renders">
                {shots.map((s) => (
                  <figure key={s.view}>
                    <div className="img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.url} alt={s.view} />
                    </div>
                    {s.view.replace("-", " ")}
                  </figure>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
