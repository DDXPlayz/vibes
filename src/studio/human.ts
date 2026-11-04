import * as THREE from "three";
import type { MannequinId, PoseId } from "@/lib/types";
import { geometryOf } from "./model";
import type { ModelData } from "./modelFormat";

/**
 * The model: a realistic woman built from MakeHuman's CC0 body (see
 * scripts/build-model.ts), wearing a tailored blouse, hair drawn back into a
 * low chignon. Framed as luxury fashion photography usually is — cropped at
 * the jaw — so the eye goes to the saree.
 */

export const SKIN_TONES: Record<MannequinId, { label: string; colour: string; sheen: string }> = {
  warm: { label: "Warm", colour: "#a8765a", sheen: "#e8bca4" },
  honey: { label: "Honey", colour: "#c39270", sheen: "#f0cdb4" },
  deep: { label: "Deep", colour: "#6f4632", sheen: "#c99278" },
};

export const POSES: Record<PoseId, { label: string; note: string }> = {
  poised: { label: "Poised", note: "Weight on one leg, the other knee soft." },
  ease: { label: "At ease", note: "Relaxed, a slight turn of the head." },
  turn: { label: "Turn", note: "A quarter turn, glancing back." },
};

/* ───────── textures, generated once ───────── */

let rawSilk: THREE.Texture | null = null;
/** Raw-silk (dupion) normal map: horizontal slubs over a fine plain weave. */
function rawSilkNormal() {
  if (rawSilk) return rawSilk;
  const N = 256;
  const h = new Float32Array(N * N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < N; y++) {
    // slubs: thicker, irregular weft threads
    const slub = rnd() < 0.18 ? 0.6 + rnd() * 0.6 : 0;
    const start = rnd() * N;
    const len = 20 + rnd() * 90;
    for (let x = 0; x < N; x++) {
      const weave = ((x + y) % 2 === 0 ? 0.5 : 0) + 0.5 * Math.sin((y / 2) * Math.PI);
      const inSlub = slub && ((x - start + N) % N) < len ? slub * Math.sin((((x - start + N) % N) / len) * Math.PI) : 0;
      h[y * N + x] = weave * 0.35 + inSlub;
    }
  }
  rawSilk = heightToNormal(h, N, 1.4);
  rawSilk.repeat.set(26, 34);
  return rawSilk;
}

let strands: THREE.Texture | null = null;
/** Fine hair strands running along v. */
function hairNormal() {
  if (strands) return strands;
  const N = 256;
  const h = new Float32Array(N * N);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cols = Array.from({ length: N }, () => rnd());
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = cols[(x + Math.round(Math.sin(y * 0.05) * 2) + N) % N] * 0.8 + cols[(x * 3) % N] * 0.2;
  strands = heightToNormal(h, N, 2.2);
  strands.repeat.set(10, 1);
  return strands;
}

function heightToNormal(h: Float32Array, N: number, strength: number) {
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (h[y * N + ((x + 1) % N)] - h[y * N + ((x - 1 + N) % N)]) * strength;
      const dy = (h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x]) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      data[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/* ───────── materials ───────── */

function skinMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ color: SKIN_TONES.warm.colour, roughness: 0.5, specularIntensity: 0.42, sheen: 0.35, sheenRoughness: 0.55, sheenColor: new THREE.Color(SKIN_TONES.warm.sheen) });
  // light that travels under the skin: shadows stay warm, never grey
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      "#include <lights_fragment_end>",
      `#include <lights_fragment_end>
      reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.34, 0.12, 0.07) * 0.55;`,
    );
  };
  return m;
}

function blouseMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: "#d6c8b2",
    roughness: 0.6,
    sheen: 0.7,
    sheenRoughness: 0.38,
    sheenColor: new THREE.Color("#fff6e8"),
    normalMap: rawSilkNormal(),
    normalScale: new THREE.Vector2(0.35, 0.35),
    side: THREE.DoubleSide,
  });
  // tailoring, drawn in the shader: armhole and side seams, bust darts, a turned hem
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float arm;\nattribute float edge;\nvarying float vArm;\nvarying float vEdge;\nvarying vec3 vLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvArm = arm; vEdge = edge; vLocal = position;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vArm;\nvarying float vEdge;\nvarying vec3 vLocal;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float seam = 0.0;
        seam = max(seam, 1.0 - smoothstep(0.0, 0.035, abs(vArm - 0.5)));                 // armhole
        float side = abs(abs(atan(vLocal.x, vLocal.z)) - 1.5708);
        seam = max(seam, (1.0 - smoothstep(0.0, 0.03, side)) * step(vArm, 0.4));         // side seams
        float dart = abs(abs(vLocal.x) - 0.075) * step(0.0, vLocal.z);
        seam = max(seam, (1.0 - smoothstep(0.0, 0.0035, dart)) * step(vArm, 0.3) * 0.7); // bust darts
        float hem = 1.0 - smoothstep(0.6, 1.4, vEdge);                                   // turned hem
        diffuseColor.rgb *= 1.0 - seam * 0.16 - hem * 0.08;`,
      );
  };
  return m;
}

function hairMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: "#170f0b",
    roughness: 0.4,
    sheen: 1,
    sheenRoughness: 0.32,
    sheenColor: new THREE.Color("#6a4a36"),
    specularIntensity: 0.6,
    normalMap: hairNormal(),
    normalScale: new THREE.Vector2(0.6, 0.6),
  });
}

/* ───────── assembly ───────── */

export interface Human {
  group: THREE.Group;
  skin: THREE.MeshPhysicalMaterial;
  blouse: THREE.MeshPhysicalMaterial;
  hair: THREE.MeshPhysicalMaterial;
  model: ModelData;
}

export function createHuman(model: ModelData): Human {
  const group = new THREE.Group();
  group.name = "model";
  const skin = skinMaterial();
  const blouse = blouseMaterial();
  const hair = hairMaterial();
  const body = new THREE.Mesh(geometryOf(model.body), skin);
  const bg = geometryOf(model.blouse);
  // a cylindrical projection for the silk's grain; its seam falls at centre back, where a blouse has one
  const p = bg.getAttribute("position") as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (Math.atan2(p.getX(i), p.getZ(i)) / (Math.PI * 2)) * 0.9;
    uv[i * 2 + 1] = p.getY(i) * 1.6;
  }
  bg.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const blouseMesh = new THREE.Mesh(bg, blouse);
  const hairMesh = new THREE.Mesh(geometryOf(model.hair), hair);
  for (const m of [body, blouseMesh, hairMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return { group, skin, blouse, hair, model };
}

export function setSkinTone(h: Human, id: MannequinId) {
  const t = SKIN_TONES[id] ?? SKIN_TONES.warm;
  h.skin.color.set(t.colour);
  h.skin.sheenColor.set(t.sheen);
}

export function disposeHuman(h: Human) {
  h.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
}
