import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import type { DrapeConfig, DrapeStyleId, EnvironmentId, LightingId, PoseId, ViewId } from "@/lib/types";
import { DrapeRig } from "./drape";
import { createHuman, disposeHuman, setSkinTone, type Human } from "./human";
import { getModelSync } from "./model";
import type { TextileSurface } from "./textile";

/**
 * The Digital Saree Studio.
 *
 * One studio, reused for every saree: the model, the light, the camera. The
 * storefront hero, the product viewer, the admin preview and the render farm
 * all use this class; a saree is "inserted" by swapping textures.
 *
 * It is lit and framed like fashion photography: large soft sources, a long
 * lens, the model standing on the floor of a seamless paper sweep.
 */

export type Theme = "light" | "dark";

export const LIGHTING: Record<LightingId, { label: string; note: string }> = {
  gallery: { label: "Softbox", note: "Large soft key, quiet fill, a fine rim — the campaign light." },
  daylight: { label: "Window", note: "Broad, cool side light — true colour." },
  dusk: { label: "Golden hour", note: "Low and warm, long soft shadows." },
  studio: { label: "Even", note: "Flat, frontal catalogue light." },
};

/** Seamless paper sweeps. `top`/`floor` are the two ends of the gradient. */
export const ENVIRONMENTS: Record<EnvironmentId, { label: string; top: string; floor: string; topDark: string; floorDark: string }> = {
  ivory: { label: "Ivory", top: "#efe9df", floor: "#ded4c5", topDark: "#2a2622", floorDark: "#171412" },
  stone: { label: "Stone", top: "#ddd5c9", floor: "#c7bcac", topDark: "#2b2825", floorDark: "#181614" },
  charcoal: { label: "Charcoal", top: "#3a3633", floor: "#22201e", topDark: "#262321", floorDark: "#100f0e" },
  umber: { label: "Umber", top: "#4b3a2f", floor: "#2c211b", topDark: "#30251f", floorDark: "#16110e" },
};

export function backdropOf(env: EnvironmentId, theme: Theme) {
  const e = ENVIRONMENTS[env] ?? ENVIRONMENTS.ivory;
  const top = theme === "dark" ? e.topDark : e.top;
  const floor = theme === "dark" ? e.floorDark : e.floor;
  // a paper sweep: lit from the front, falling off toward the edges
  return `radial-gradient(ellipse 55% 60% at 50% 38%, ${top}, transparent 75%), linear-gradient(${top} 0%, ${top} 58%, ${floor} 100%)`;
}

export const VIEWS: Record<ViewId, { label: string }> = {
  full: { label: "Full length" },
  front: { label: "Front" },
  "three-quarter": { label: "Three-quarter" },
  side: { label: "Side" },
  back: { label: "Back" },
  pallu: { label: "Pallu" },
  border: { label: "Border" },
  weave: { label: "Weave" },
};

/** A long lens: flattering, no wide-angle distortion. */
export const EDITORIAL_FOV = 16;

/**
 * Cameras. Full-length views are framed from her jaw to the floor — the
 * semi-anonymous crop of luxury fashion photography — so the saree fills the
 * frame. Detail views move in on the pallu, the border and the weave.
 */
export function viewCamera(view: ViewId, style: DrapeStyleId = "nivi") {
  const at = (az: number, target: [number, number, number], dist: number, camY: number) => {
    const r = (az * Math.PI) / 180;
    return { pos: [target[0] + Math.sin(r) * dist, camY, target[2] + Math.cos(r) * dist] as [number, number, number], target, fov: EDITORIAL_FOV };
  };
  // jaw to floor
  const body: [number, number, number] = [0, 0.733, 0];
  switch (view) {
    case "front":
      return at(0, body, 5.4, 0.9);
    case "three-quarter":
      return at(36, body, 5.4, 0.9);
    case "side":
      return at(88, body, 5.4, 0.9);
    case "back":
      return at(180, body, 5.4, 0.9);
    case "pallu":
      return style === "seedha" ? at(-24, [-0.02, 1.0, 0.08], 3.1, 1.08) : at(146, [0.07, 0.98, -0.06], 3.1, 1.08);
    case "border":
      return at(18, [0.02, 0.16, 0.08], 1.7, 0.36);
    case "weave":
      return at(8, [0.0, 0.66, 0.12], 1.05, 0.72);
    case "full":
    default:
      return at(10, body, 5.4, 0.9);
  }
}

/* ───────────── weave normal map ───────────── */

let weaveNormal: THREE.Texture | null = null;
function weaveNormalMap() {
  if (weaveNormal) return weaveNormal;
  const N = 64;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  const img = g.createImageData(N, N);
  // plain weave height field: warp over weft, alternating
  const h = (x: number, y: number) => {
    const cx = ((x % 8) + 8) % 8;
    const cy = ((y % 8) + 8) % 8;
    const cellX = Math.floor((((x % N) + N) % N) / 8);
    const cellY = Math.floor((((y % N) + N) % N) / 8);
    const warpOnTop = (cellX + cellY) % 2 === 0;
    const warp = Math.sin((cx / 8) * Math.PI);
    const weft = Math.sin((cy / 8) * Math.PI);
    return warpOnTop ? 0.5 + warp * 0.5 : 0.5 + weft * 0.5;
  };
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * N + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(380, 80);
  t.colorSpace = THREE.NoColorSpace;
  weaveNormal = t;
  return t;
}

/* ───────────── fabric material ───────────── */

export interface FabricTextures {
  map: THREE.Texture;
  material: THREE.Texture;
}

export function texturesFromSurface(s: TextileSurface, maxAniso = 8): FabricTextures {
  const map = new THREE.CanvasTexture(s.colour);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAniso;
  const material = new THREE.CanvasTexture(s.material);
  material.anisotropy = maxAniso;
  for (const t of [map, material]) {
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  }
  return { map, material };
}

export class FabricMaterial extends THREE.MeshPhysicalMaterial {
  readonly uniformsExtra = {
    uMap2: { value: null as THREE.Texture | null },
    uMat2: { value: null as THREE.Texture | null },
    uMix: { value: -1 },
    uEdge: { value: new THREE.Color("#d9b56e") },
    /** half the cloth's thickness: the front face sits out, the back face in */
    uThick: { value: 0 },
  };

  constructor(tex: FabricTextures, sheen = 0.6, sheer = 0, side: THREE.Side = THREE.FrontSide) {
    super({
      map: tex.map,
      roughnessMap: tex.material,
      metalnessMap: tex.material,
      roughness: 1,
      // zari is metal wrapped round silk and then woven: it glints, it is not chrome
      metalness: 0.62,
      normalMap: weaveNormalMap(),
      normalScale: new THREE.Vector2(0.28, 0.28),
      sheen: 0.08 + sheen * 0.22,
      sheenRoughness: 0.45 - sheen * 0.12,
      sheenColor: new THREE.Color("#6f6a64"),
      side,
      // baked ambient occlusion from the drape (fold valleys, contact) arrives as vertex colour
      vertexColors: true,
      transparent: sheer > 0.05,
      opacity: 1 - sheer * 0.3,
      envMapIntensity: 0.9,
    });
    this.uniformsExtra.uMap2.value = tex.map;
    this.uniformsExtra.uMat2.value = tex.material;
    this.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniformsExtra);
      shader.vertexShader = "varying float vSweepY;\nuniform float uThick;\n" + shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  transformed += objectNormal * uThick;\n  vSweepY = (modelMatrix * vec4(transformed, 1.0)).y / 1.56;",
      );
      const head = `varying float vSweepY;
uniform sampler2D uMap2; uniform sampler2D uMat2; uniform float uMix; uniform vec3 uEdge;
float vibesNoise(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float vibesNew(vec2 uv){
  if (uMix < 0.0) return 0.0;
  float n = (vibesNoise(floor(uv * vec2(520.0, 110.0))) - 0.5) * 0.025;
  return 1.0 - smoothstep(uMix - 0.012, uMix + 0.012, vSweepY + n);
}
`;
      shader.fragmentShader = head + shader.fragmentShader
        .replace(
          "#include <map_fragment>",
          `#ifdef USE_MAP
  float vibesK = vibesNew(vMapUv);
  vec4 sampledDiffuseColor = mix(texture2D(map, vMapUv), texture2D(uMap2, vMapUv), vibesK);
  diffuseColor *= sampledDiffuseColor;
#endif`,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  vec4 texelRoughness = mix(texture2D(roughnessMap, vRoughnessMapUv), texture2D(uMat2, vRoughnessMapUv), vibesNew(vRoughnessMapUv));
  roughnessFactor *= texelRoughness.g;
#endif`,
        )
        .replace(
          "#include <metalnessmap_fragment>",
          `float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
  vec4 texelMetalness = mix(texture2D(metalnessMap, vMetalnessMapUv), texture2D(uMat2, vMetalnessMapUv), vibesNew(vMetalnessMapUv));
  metalnessFactor *= texelMetalness.b;
#endif`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
#ifdef USE_MAP
  if (uMix >= 0.0 && uMix < 1.06) {
    float vibesEdge = 1.0 - smoothstep(0.0, 0.014, abs(vSweepY - uMix));
    totalEmissiveRadiance += uEdge * vibesEdge * 0.9;
  }
#endif`,
        );
    };
  }

  /** Begin a woven transition to another textile. Call `setSweep` to advance it. */
  beginTransition(next: FabricTextures) {
    this.uniformsExtra.uMap2.value = next.map;
    this.uniformsExtra.uMat2.value = next.material;
    this.uniformsExtra.uMix.value = 0;
  }
  setSweep(v: number) {
    this.uniformsExtra.uMix.value = v;
  }
  finishTransition() {
    const m = this.uniformsExtra.uMap2.value;
    const r = this.uniformsExtra.uMat2.value;
    if (m && r) {
      this.map = m;
      this.roughnessMap = r;
      this.metalnessMap = r;
    }
    this.uniformsExtra.uMix.value = -1;
  }
  setTextures(t: FabricTextures) {
    this.map = t.map;
    this.roughnessMap = t.material;
    this.metalnessMap = t.material;
    this.uniformsExtra.uMap2.value = t.map;
    this.uniformsExtra.uMat2.value = t.material;
    this.uniformsExtra.uMix.value = -1;
    this.needsUpdate = false;
  }
  /**
   * Fibre character. Silk: a crisp, directional highlight and little fuzz.
   * Cotton: a soft, diffuse sheen and almost no specular. Raw silks sit between.
   */
  setFibre(sheen: number, sheer: number) {
    this.specularIntensity = 0.22 + sheen * 0.7;
    this.sheen = 0.2 + (1 - sheen) * 0.45;
    this.sheenRoughness = 0.32 + (1 - sheen) * 0.5;
    this.anisotropy = sheen * 0.35;
    const transparent = sheer > 0.05;
    if (transparent !== this.transparent) {
      this.transparent = transparent;
      this.needsUpdate = true;
    }
    this.opacity = 1 - sheer * 0.3;
  }
}


/* ───────────── soft shadow under her feet ───────────── */

function contactTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(0.35, "rgba(0,0,0,0.22)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A studio of softboxes for reflections: what silk and zari see. */
function softboxEnvironment() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#2c2926");
  const box = (w: number, h: number, intensity: number, pos: [number, number, number], colour = "#fff6ec") => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 1, 0);
    scene.add(m);
  };
  box(3, 4, 4, [-3.2, 2.6, 3.4]); // key
  box(3, 3, 1.4, [3.6, 1.6, 3], "#eef0ff"); // fill
  box(1, 4, 3, [2.6, 2.2, -3]); // rim
  box(1, 4, 2, [-2.8, 2.2, -2.8]); // rim
  box(4, 4, 1.2, [0, 5, 0.5]); // ceiling
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: "#5a524a" }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  return scene;
}

let rectInit = false;

/* ───────────── the studio ───────────── */

export interface StudioOptions {
  /** Use an existing scene (e.g. the one React Three Fiber owns). */
  scene?: THREE.Scene;
  transparentBackground?: boolean;
  /** kept for API compatibility; the beam is gone — light now comes from softboxes */
  beam?: boolean;
  shadows?: boolean;
}

type Rig = { key: THREE.RectAreaLight; fill: THREE.RectAreaLight; rimL: THREE.RectAreaLight; rimR: THREE.RectAreaLight; top: THREE.RectAreaLight; sun: THREE.DirectionalLight; ambient: THREE.HemisphereLight };

export class Studio {
  readonly scene: THREE.Scene;
  readonly figure = new THREE.Group();
  readonly lights = new THREE.Group();
  human: Human | null = null;
  drape: DrapeRig;
  fabric: FabricMaterial;
  /** the back face of the cloth, set slightly behind the front: the fabric has thickness */
  fabricBack: FabricMaterial;
  config: DrapeConfig;
  theme: Theme = "light";
  private rig: Rig;
  private catcher: THREE.Mesh;
  private contact: THREE.Mesh;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private blouseColour = "#d6c8b2";

  constructor(textures: FabricTextures, config: DrapeConfig, opts: StudioOptions = {}) {
    this.scene = opts.scene ?? new THREE.Scene();
    this.config = { ...config };
    this.fabric = new FabricMaterial(textures, 0.6, 0, THREE.FrontSide);
    this.fabric.uniformsExtra.uThick.value = 0.0006;
    this.fabricBack = new FabricMaterial(textures, 0.6, 0, THREE.BackSide);
    this.fabricBack.uniformsExtra.uThick.value = -0.0006;
    this.drape = new DrapeRig(this.fabric, config.style, config.pose, this.fabricBack);
    this.figure.add(this.drape.group);
    this.scene.add(this.figure);
    this.setPose(config.pose);

    // the floor: invisible, it only catches her shadow
    this.catcher = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.26 }));
    this.catcher.rotation.x = -Math.PI / 2;
    this.catcher.receiveShadow = true;
    this.scene.add(this.catcher);
    this.contact = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshBasicMaterial({ map: contactTexture(), transparent: true, depthWrite: false, opacity: 0.55 }));
    this.contact.rotation.x = -Math.PI / 2;
    this.contact.position.y = 0.001;
    this.scene.add(this.contact);

    if (!rectInit) {
      RectAreaLightUniformsLib.init();
      rectInit = true;
    }
    const rect = (w: number, h: number) => new THREE.RectAreaLight("#ffffff", 1, w, h);
    const sun = new THREE.DirectionalLight("#fff3e6", 1);
    sun.castShadow = !!opts.shadows;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -2.5;
    sun.shadow.camera.right = 2.5;
    sun.shadow.camera.top = 2.5;
    sun.shadow.camera.bottom = -2.5;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 12;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.01;
    sun.shadow.radius = 9;
    sun.shadow.blurSamples = 16;
    this.rig = { key: rect(2.2, 3.2), fill: rect(3, 3), rimL: rect(0.8, 3), rimR: rect(0.8, 3), top: rect(3, 3), sun, ambient: new THREE.HemisphereLight("#fff8f0", "#5c5048", 0.2) };
    this.lights.add(this.rig.key, this.rig.fill, this.rig.rimL, this.rig.rimR, this.rig.top, sun, sun.target, this.rig.ambient);
    sun.target.position.set(0, 0.8, 0);
    this.scene.add(this.lights);
    this.setLighting(config.lighting);
    this.drape.update(1, 0);
  }

  /** Image-based reflections for sheen and zari. Needs the renderer. */
  attachRenderer(renderer: THREE.WebGLRenderer) {
    if (this.envTarget) return;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envTarget = pmrem.fromScene(softboxEnvironment(), 0.02);
    this.scene.environment = this.envTarget.texture;
    pmrem.dispose();
    this.setLighting(this.config.lighting);
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.setLighting(this.config.lighting);
  }

  setTextile(t: FabricTextures, fibre?: { sheen: number; sheer: number }) {
    this.fabric.setTextures(t);
    this.fabricBack.setTextures(t);
    if (fibre) {
      this.fabric.setFibre(fibre.sheen, fibre.sheer);
      this.fabricBack.setFibre(fibre.sheen, fibre.sheer);
    }
  }

  setBlouse(colour: string) {
    this.blouseColour = colour;
    this.human?.blouse.color.set(colour);
  }

  /** Swap in the model for a pose. The model file must already be loaded (see loadModel). */
  private setPose(pose: PoseId) {
    const model = getModelSync(pose);
    if (this.human) {
      this.figure.remove(this.human.group);
      disposeHuman(this.human);
      this.human = null;
    }
    if (!model) return;
    this.human = createHuman(model);
    setSkinTone(this.human, this.config.mannequin);
    this.human.blouse.color.set(this.blouseColour);
    this.figure.add(this.human.group);
  }

  configure(next: Partial<DrapeConfig>) {
    const prev = this.config;
    this.config = { ...prev, ...next };
    if ((next.pose && next.pose !== prev.pose) || !this.human) this.setPose(this.config.pose);
    if ((next.style && next.style !== prev.style) || (next.pose && next.pose !== prev.pose)) {
      this.drape.configure(this.config.style, this.config.pose);
      this.drape.update(this.drape.progress, 0);
    }
    if (next.mannequin && this.human) setSkinTone(this.human, this.config.mannequin);
    if (next.lighting || next.environment) this.setLighting(this.config.lighting);
  }

  setLighting(id: LightingId) {
    this.config.lighting = id;
    const dark = this.theme === "dark";
    const { key, fill, rimL, rimR, top, sun, ambient } = this.rig;
    const place = (l: THREE.Object3D, p: [number, number, number], t: [number, number, number] = [0, 0.95, 0]) => {
      l.position.set(...p);
      l.lookAt(...t);
    };
    const env = (v: number) => (this.scene.environmentIntensity = v);
    switch (id) {
      case "daylight":
        key.color.set("#f6f8ff");
        key.intensity = 7;
        key.width = 3;
        key.height = 3.6;
        place(key, [-3.6, 1.9, 1.2]);
        fill.color.set("#fffaf2");
        fill.intensity = 2.2;
        place(fill, [3.2, 1.4, 2.8]);
        rimL.intensity = 0;
        rimR.color.set("#ffffff");
        rimR.intensity = 2;
        place(rimR, [2.2, 2, -2.6]);
        top.intensity = 1.2;
        place(top, [0, 4.2, 0.6]);
        sun.color.set("#f4f6ff");
        sun.intensity = 0.9;
        sun.position.set(-2.2, 5.5, 1.6);
        ambient.intensity = 0.35;
        env(0.55);
        break;
      case "dusk":
        key.color.set("#ffc790");
        key.intensity = 6.5;
        key.width = 2;
        key.height = 2.6;
        place(key, [-3.4, 1.4, 2.2]);
        fill.color.set("#8d7ca6");
        fill.intensity = 0.7;
        place(fill, [3.4, 1.2, 2.4]);
        rimL.color.set("#ffd2a0");
        rimL.intensity = 3;
        place(rimL, [-2.2, 1.8, -2.6]);
        rimR.color.set("#ffe2c0");
        rimR.intensity = 2.4;
        place(rimR, [2.4, 1.8, -2.4]);
        top.intensity = 0.3;
        sun.color.set("#ffbe85");
        sun.intensity = 1.3;
        sun.position.set(-3, 4.2, 2.2);
        ambient.intensity = 0.12;
        env(0.3);
        break;
      case "studio":
        key.color.set("#ffffff");
        key.intensity = 5;
        key.width = 3;
        key.height = 3.4;
        place(key, [-1.4, 2.2, 3.8]);
        fill.color.set("#ffffff");
        fill.intensity = 3;
        place(fill, [2.6, 1.6, 3.2]);
        rimL.intensity = 1.2;
        place(rimL, [-2.2, 2.2, -2.6]);
        rimR.intensity = 1.2;
        place(rimR, [2.2, 2.2, -2.6]);
        top.intensity = 1.5;
        place(top, [0, 4.2, 0.6]);
        sun.color.set("#ffffff");
        sun.intensity = 0.7;
        sun.position.set(-0.8, 6, 2.4);
        ambient.intensity = 0.4;
        env(0.6);
        break;
      case "gallery":
      default:
        // the campaign light: a large soft key from high front-left, a quiet fill, fine rims
        key.color.set("#fff1e2");
        key.intensity = dark ? 7.5 : 6.5;
        key.width = 2.2;
        key.height = 3.2;
        place(key, [-2.8, 2.6, 3.0]);
        fill.color.set("#eef0fa");
        fill.intensity = dark ? 0.8 : 1.4;
        place(fill, [3.4, 1.5, 2.8]);
        rimL.color.set("#fff4e8");
        rimL.intensity = dark ? 3.2 : 2.4;
        place(rimL, [-2.3, 2.2, -2.7]);
        rimR.color.set("#ffffff");
        rimR.intensity = dark ? 4 : 3;
        place(rimR, [2.4, 2.3, -2.5]);
        top.color.set("#fff8f0");
        top.intensity = dark ? 0.6 : 1;
        place(top, [0, 4.4, 0.6]);
        sun.color.set("#fff0de");
        sun.intensity = dark ? 1.1 : 0.95;
        sun.position.set(-1.6, 6, 2.2);
        ambient.intensity = dark ? 0.12 : 0.22;
        env(dark ? 0.32 : 0.45);
        break;
    }
    sun.target.position.set(0, 0.8, 0);
    (this.catcher.material as THREE.ShadowMaterial).opacity = dark ? 0.3 : 0.16;
  }

  dispose() {
    this.scene.remove(this.figure, this.lights, this.catcher, this.contact);
    this.scene.environment = null;
    this.drape.dispose();
    if (this.human) disposeHuman(this.human);
    this.envTarget?.dispose();
  }
}

export type { DrapeStyleId, PoseId };
