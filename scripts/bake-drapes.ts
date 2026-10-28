/**
 * Bakes the drape for every style × pose into public/drapes/*.bin.
 *   npm run bake            — all nine
 *   npm run bake nivi:classic
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import type { DrapeStyleId, PoseId } from "../src/lib/types";
import { bakeDrape, encodeBake } from "../src/studio/drapeBake";

const STYLES: DrapeStyleId[] = ["nivi", "open", "seedha"];
const POSES: PoseId[] = ["classic", "contrapposto", "dressform"];
const only = process.argv.slice(2);
const out = path.join(process.cwd(), "public", "drapes");
mkdirSync(out, { recursive: true });

for (const style of STYLES)
  for (const pose of POSES) {
    const key = `${style}:${pose}`;
    if (only.length && !only.includes(key)) continue;
    const t = Date.now();
    const bake = bakeDrape(style, pose);
    writeFileSync(path.join(out, `${style}-${pose}.bin`), Buffer.from(encodeBake(bake)));
    console.log(`${key.padEnd(22)} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
