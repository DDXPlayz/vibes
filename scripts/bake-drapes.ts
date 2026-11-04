/**
 * Bakes the drape for every style × pose into public/drapes/*.bin.
 *   npm run bake            — all nine
 *   npm run bake nivi:classic
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import type { DrapeStyleId, PoseId } from "../src/lib/types";
import { readFileSync } from "fs";
import { bodySDF } from "../src/studio/collider";
import { bakeDrape, encodeBake } from "../src/studio/drapeBake";
import { decodeModel } from "../src/studio/modelFormat";

const STYLES: DrapeStyleId[] = ["nivi", "open", "seedha"];
const POSES: PoseId[] = ["poised", "ease", "turn"];
const only = process.argv.slice(2);
const out = path.join(process.cwd(), "public", "drapes");
mkdirSync(out, { recursive: true });

for (const style of STYLES)
  for (const pose of POSES) {
    const key = `${style}:${pose}`;
    if (only.length && !only.includes(key)) continue;
    const t = Date.now();
    const file = readFileSync(path.join(process.cwd(), "public", "model", `${pose}.bin`));
    const model = decodeModel(file.buffer.slice(file.byteOffset, file.byteOffset + file.length));
    const bake = bakeDrape(style, pose, model, bodySDF(model.body));
    writeFileSync(path.join(out, `${style}-${pose}.bin`), Buffer.from(encodeBake(bake)));
    console.log(`${key.padEnd(22)} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
