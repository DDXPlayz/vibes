"use client";

import type { DrapeConfig, DrapeStyleId, EnvironmentId, LightingId, MannequinId, PoseId } from "@/lib/types";
import { MANNEQUIN_FINISHES, POSES } from "@/studio/body";
import { DRAPE_STYLES } from "@/studio/drape";
import { ENVIRONMENTS, LIGHTING } from "@/studio/scene";
import { Options } from "./ui";

const keys = <T extends string>(o: Record<T, unknown>) => Object.keys(o) as T[];

/** The reusable studio: choose from shared assets, never build per product. */
export function StudioControls({ value, onChange, compact }: { value: DrapeConfig; onChange: (v: DrapeConfig) => void; compact?: boolean }) {
  const set = (p: Partial<DrapeConfig>) => onChange({ ...value, ...p });
  return (
    <div className="adm-grid" style={{ gap: 22 }}>
      <div>
        <h3 className="label" style={{ margin: "0 0 10px" }}>Drape</h3>
        <Options<DrapeStyleId> value={value.style} onChange={(style) => set({ style })} options={keys(DRAPE_STYLES).map((id) => ({ id, label: DRAPE_STYLES[id].label, note: compact ? undefined : DRAPE_STYLES[id].note }))} />
      </div>
      <div>
        <h3 className="label" style={{ margin: "0 0 10px" }}>Mannequin</h3>
        <Options<MannequinId> value={value.mannequin} onChange={(mannequin) => set({ mannequin })} options={keys(MANNEQUIN_FINISHES).map((id) => ({ id, label: MANNEQUIN_FINISHES[id].label }))} />
      </div>
      <div>
        <h3 className="label" style={{ margin: "0 0 10px" }}>Pose</h3>
        <Options<PoseId> value={value.pose} onChange={(pose) => set({ pose })} options={keys(POSES).map((id) => ({ id, label: POSES[id].label }))} />
      </div>
      <div>
        <h3 className="label" style={{ margin: "0 0 10px" }}>Lighting</h3>
        <Options<LightingId> value={value.lighting} onChange={(lighting) => set({ lighting })} options={keys(LIGHTING).map((id) => ({ id, label: LIGHTING[id].label, note: compact ? undefined : LIGHTING[id].note }))} />
      </div>
      <div>
        <h3 className="label" style={{ margin: "0 0 10px" }}>Background</h3>
        <Options<EnvironmentId> value={value.environment} onChange={(environment) => set({ environment })} options={keys(ENVIRONMENTS).map((id) => ({ id, label: ENVIRONMENTS[id].label }))} />
      </div>
    </div>
  );
}
