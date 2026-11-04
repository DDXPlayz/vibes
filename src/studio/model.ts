"use client";

import * as THREE from "three";
import { decodeModel, type MeshData, type ModelData, type ModelPoseId } from "./modelFormat";

/** Loads /model/{pose}.bin (the posed woman, blouse, hair) and caches it. */

const ready = new Map<ModelPoseId, ModelData>();
const pending = new Map<ModelPoseId, Promise<ModelData>>();

export function getModelSync(pose: ModelPoseId) {
  return ready.get(pose);
}

export function loadModel(pose: ModelPoseId): Promise<ModelData> {
  const done = ready.get(pose);
  if (done) return Promise.resolve(done);
  let p = pending.get(pose);
  if (!p) {
    p = fetch(`/model/${pose}.bin`)
      .then((r) => {
        if (!r.ok) throw new Error(`model ${pose} missing`);
        return r.arrayBuffer();
      })
      .then((b) => {
        const m = decodeModel(b);
        ready.set(pose, m);
        return m;
      });
    p.catch(() => pending.delete(pose));
    pending.set(pose, p);
  }
  return p;
}

export function geometryOf(d: MeshData) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(d.pos instanceof Float32Array ? d.pos : Float32Array.from(d.pos), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(d.normal instanceof Float32Array ? d.normal : Float32Array.from(d.normal), 3));
  if (d.uv) g.setAttribute("uv", new THREE.BufferAttribute(d.uv, 2));
  for (const [k, v] of Object.entries(d.attrs ?? {})) g.setAttribute(k, new THREE.BufferAttribute(v, 1));
  g.setIndex(new THREE.BufferAttribute(d.index, 1));
  return g;
}
