import type { DrapeConfig, EnvironmentId, MannequinId, PoseId } from "./types";

/**
 * Older records used mannequin-era ids. Map them onto the current studio so
 * existing products keep working without a data migration.
 */
const POSE: Record<string, PoseId> = { classic: "poised", contrapposto: "ease", dressform: "turn" };
const MODEL: Record<string, MannequinId> = { ivory: "warm", stone: "honey", graphite: "deep" };
const ENV: Record<string, EnvironmentId> = { "ivory-gallery": "ivory", "night-gallery": "charcoal", "stone-room": "stone", aubergine: "umber" };

export function normalizeDrape(d: DrapeConfig): DrapeConfig {
  return {
    ...d,
    pose: POSE[d.pose] ?? d.pose,
    mannequin: MODEL[d.mannequin] ?? d.mannequin,
    environment: ENV[d.environment] ?? d.environment,
  };
}
