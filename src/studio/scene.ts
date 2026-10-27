import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { DrapeConfig, DrapeStyleId, EnvironmentId, LightingId, MannequinId, PoseId, ViewId } from "@/lib/types";
import { MANNEQUIN_FINISHES, createMannequin, type MannequinParts } from "./body";
import { DrapeRig } from "./drape";
import type { TextileSurface } from "./textile";

/**
 * The Digital Saree Studio.
 *
 * One scene, built once, reused for every saree: the storefront hero, the
 * product viewer, the admin preview and the offscreen render farm all
 * instantiate this same class. A saree is "inserted" by swapping textures.
 */

export type Theme = "light" | "dark";

export const LIGHTING: Record<LightingId, { label: string; note: string }> = {
  gallery: { label: "Gallery", note: "A single warm beam, as in the store." },
  daylight: { label: "Daylight", note: "Soft window light — true colour." },
  dusk: { label: "Dusk", note: "Low, warm evening light." },
  studio: { label: "Studio", note: "Even, neutral catalogue light." },
};

export const ENVIRONMENTS: Record<EnvironmentId, { label: string; light: string; dark: string; floor: string; floorDark: string }> = {
  "ivory-gallery": { label: "Ivory gallery", light: "#efe9df", dark: "#141210", floor: "#e5ddd0", floorDark: "#1c1916" },
  "night-gallery": { label: "Night gallery", light: "#1a1816", dark: "#0b0a09", floor: "#24201d", floorDark: "#151311" },
  "stone-room": { label: "Stone room", light: "#d9d1c4", dark: "#1d1b18", floor: "#cbc1b1", floorDark: "#26231f" },
  aubergine: { label: "Aubergine", light: "#d8cfd6", dark: "#171019", floor: "#c8bcc6", floorDark: "#211724" },
};

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

export function viewCamera(view: ViewId, style: DrapeStyleId = "nivi") {
  const seedha = style === "seedha";
  const v: Record<ViewId, { pos: [number, number, number]; target: [number, number, number]; }> = {
    full: { pos: [0, 0.98, 4.5], target: [0, 0.84, 0] },
    front: { pos: [0, 1.05, 2.85], target: [0, 0.9, 0] },
    "three-quarter": { pos: [1.85, 1.1, 2.15], target: [0, 0.9, 0] },
    side: { pos: [2.8, 1.05, 0.05], target: [0, 0.9, 0] },
    back: { pos: [-0.25, 1.1, -2.8], target: [0, 0.9, 0] },
    pallu: seedha ? { pos: [-0.35, 1.05, 1.25], target: [-0.05, 1.0, 0.2] } : { pos: [0.95, 1.12, -1.1], target: [0.16, 0.95, -0.2] },
    border: { pos: [0.55, 0.3, 1.0], target: [0.03, 0.14, 0.18] },
    weave: { pos: [0.12, 0.72, 0.72], target: [-0.02, 0.62, 0.18] },
  };
  return v[view];
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
  };

  constructor(tex: FabricTextures, sheen = 0.6, sheer = 0) {
    super({
      map: tex.map,
      roughnessMap: tex.material,
      metalnessMap: tex.material,
      roughness: 1,
      metalness: 1,
      normalMap: weaveNormalMap(),
      normalScale: new THREE.Vector2(0.28, 0.28),
      sheen: 0.08 + sheen * 0.22,
      sheenRoughness: 0.45 - sheen * 0.12,
      sheenColor: new THREE.Color("#6f6a64"),
      side: THREE.DoubleSide,
      transparent: sheer > 0.05,
      opacity: 1 - sheer * 0.3,
      envMapIntensity: 0.9,
    });
    this.uniformsExtra.uMap2.value = tex.map;
    this.uniformsExtra.uMat2.value = tex.material;
    this.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniformsExtra);
      shader.vertexShader = "varying float vSweepY;\n" + shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  vSweepY = (modelMatrix * vec4(transformed, 1.0)).y / 1.56;",
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
  setFibre(sheen: number, sheer: number) {
    this.sheen = 0.08 + sheen * 0.22;
    this.sheenRoughness = 0.45 - sheen * 0.12;
    const transparent = sheer > 0.05;
    if (transparent !== this.transparent) {
      this.transparent = transparent;
      this.needsUpdate = true;
    }
    this.opacity = 1 - sheer * 0.3;
  }
}

/* ───────────── soft floor shadow ───────────── */

function radialTexture(inner: string, outer: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ───────────── the studio ───────────── */

export interface StudioOptions {
  /** Use an existing scene (e.g. the one React Three Fiber owns). */
  scene?: THREE.Scene;
  transparentBackground?: boolean;
  beam?: boolean;
  shadows?: boolean;
}

export class Studio {
  readonly scene: THREE.Scene;
  readonly figure = new THREE.Group();
  readonly lights = new THREE.Group();
  mannequin: MannequinParts;
  drape: DrapeRig;
  fabric: FabricMaterial;
  config: DrapeConfig;
  theme: Theme = "light";
  private floor: THREE.Mesh;
  private shadowBlob: THREE.Mesh;
  private beam: THREE.Mesh | null = null;
  private key: THREE.SpotLight;
  private fill: THREE.DirectionalLight;
  private rim: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private opts: StudioOptions;

  constructor(textures: FabricTextures, config: DrapeConfig, opts: StudioOptions = {}) {
    this.opts = opts;
    this.scene = opts.scene ?? new THREE.Scene();
    this.config = { ...config };
    this.fabric = new FabricMaterial(textures);
    this.mannequin = createMannequin(config.pose);
    this.drape = new DrapeRig(this.fabric, config.style, config.pose);
    this.figure.add(this.mannequin.group);
    this.mannequin.group.add(this.drape.group);
    this.scene.add(this.figure);

    // floor
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: "#e5ddd0", roughness: 0.95 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.036;
    this.floor.receiveShadow = true;
    this.floor.visible = !opts.transparentBackground;
    this.scene.add(this.floor);

    this.shadowBlob = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({ map: radialTexture("rgba(0,0,0,0.42)", "rgba(0,0,0,0)"), transparent: true, depthWrite: false }),
    );
    this.shadowBlob.rotation.x = -Math.PI / 2;
    this.shadowBlob.position.y = -0.034;
    this.scene.add(this.shadowBlob);

    // lights
    this.hemi = new THREE.HemisphereLight("#fff6ea", "#3a332c", 0.6);
    this.key = new THREE.SpotLight("#ffe9cc", 60, 12, 0.42, 0.75, 1.6);
    this.key.position.set(-1.6, 4.2, 2.6);
    this.key.target.position.set(0, 0.9, 0);
    this.key.castShadow = !!opts.shadows;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.radius = 4;
    this.fill = new THREE.DirectionalLight("#dfe6ff", 0.6);
    this.fill.position.set(3, 1.5, 2);
    this.rim = new THREE.DirectionalLight("#fff0dc", 1.6);
    this.rim.position.set(1.5, 2.5, -3);
    this.lights.add(this.hemi, this.key, this.key.target, this.fill, this.rim);
    this.scene.add(this.lights);

    if (opts.beam) {
      // a whisper of a light shaft — only visible in dark mode
      const geo = new THREE.ConeGeometry(0.95, 4.6, 48, 1, true);
      geo.translate(0, -2.3, 0);
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uStrength: { value: 0 }, uColor: { value: new THREE.Color("#ffdcae") } },
        vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
          void main(){ vY = position.y; vec4 mv = modelViewMatrix * vec4(position,1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uStrength; uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV;
          void main(){ float along = smoothstep(-4.6, -2.6, vY) * (1.0 - smoothstep(-1.4, 0.0, vY));
          float edge = pow(abs(dot(vN, vV)), 1.6);
          gl_FragColor = vec4(uColor, along * edge * uStrength); }`,
      });
      this.beam = new THREE.Mesh(geo, mat);
      this.beam.position.copy(this.key.position);
      this.beam.lookAt(new THREE.Vector3(0, 0.4, 0));
      this.beam.rotateX(-Math.PI / 2);
      this.scene.add(this.beam);
    }

    this.applyFinish();
    this.setLighting(config.lighting);
    this.drape.update(1, 0);
  }

  /** Image-based reflections for sheen and zari. Needs the renderer. */
  attachRenderer(renderer: THREE.WebGLRenderer) {
    if (this.envTarget) return;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envTarget.texture;
    pmrem.dispose();
    this.setLighting(this.config.lighting);
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.applyFinish();
    this.setLighting(this.config.lighting);
  }

  setTextile(t: FabricTextures, fibre?: { sheen: number; sheer: number }) {
    this.fabric.setTextures(t);
    if (fibre) this.fabric.setFibre(fibre.sheen, fibre.sheer);
  }

  setBlouse(colour: string) {
    this.mannequin.blouse.color.set(colour);
  }

  configure(next: Partial<DrapeConfig>) {
    const prev = this.config;
    this.config = { ...prev, ...next };
    if (next.pose && next.pose !== prev.pose) {
      const blouse = this.mannequin.blouse.color.clone();
      this.mannequin.group.remove(this.drape.group);
      this.figure.remove(this.mannequin.group);
      this.mannequin = createMannequin(this.config.pose);
      this.mannequin.blouse.color.copy(blouse);
      this.mannequin.group.add(this.drape.group);
      this.figure.add(this.mannequin.group);
      this.applyFinish();
    }
    if ((next.style && next.style !== prev.style) || (next.pose && next.pose !== prev.pose)) {
      this.drape.configure(this.config.style, this.config.pose);
      this.drape.update(this.drape.progress, 0);
    }
    if (next.mannequin) this.applyFinish();
    if (next.lighting || next.environment) this.setLighting(this.config.lighting);
  }

  private applyFinish() {
    const f = MANNEQUIN_FINISHES[this.config.mannequin as MannequinId];
    this.mannequin.skin.color.set(this.theme === "dark" ? f.dark : f.light);
    this.mannequin.skin.roughness = f.roughness;
    const env = ENVIRONMENTS[this.config.environment];
    this.mannequin.plinth.color.set(this.theme === "dark" ? "#1f1c19" : "#ddd5c8");
    (this.floor.material as THREE.MeshStandardMaterial).color.set(this.theme === "dark" ? env.floorDark : env.floor);
    if (!this.opts.transparentBackground) {
      const bg = new THREE.Color(this.theme === "dark" ? env.dark : env.light);
      this.scene.background = bg;
      // the floor dissolves into the backdrop — no horizon line
      this.scene.fog = new THREE.Fog(bg, 4.2, 9);
    }
  }

  setLighting(id: LightingId) {
    this.config.lighting = id;
    const dark = this.theme === "dark";
    const k = this.key;
    const envI = (v: number) => (this.scene.environmentIntensity = v);
    switch (id) {
      case "daylight":
        this.hemi.color.set("#f4f6ff");
        this.hemi.groundColor.set("#6b625a");
        this.hemi.intensity = dark ? 0.9 : 1.3;
        k.color.set("#fff8f0");
        k.intensity = dark ? 45 : 55;
        k.angle = 0.6;
        k.position.set(-3, 3.2, 2.2);
        this.fill.intensity = 0.9;
        this.fill.color.set("#e8eeff");
        this.rim.intensity = 0.8;
        envI(dark ? 0.45 : 0.6);
        break;
      case "dusk":
        this.hemi.color.set("#ffd9b0");
        this.hemi.groundColor.set("#2a1d2e");
        this.hemi.intensity = dark ? 0.25 : 0.45;
        k.color.set("#ffb871");
        k.intensity = dark ? 70 : 75;
        k.angle = 0.5;
        k.position.set(-2.8, 1.9, 1.6);
        this.fill.color.set("#7d5b96");
        this.fill.intensity = dark ? 0.6 : 0.7;
        this.rim.color.set("#ffcf99");
        this.rim.intensity = 2.2;
        envI(dark ? 0.15 : 0.3);
        break;
      case "studio":
        this.hemi.color.set("#ffffff");
        this.hemi.groundColor.set("#8a837a");
        this.hemi.intensity = dark ? 0.9 : 1.1;
        k.color.set("#ffffff");
        k.intensity = 45;
        k.angle = 0.7;
        k.position.set(-1.8, 3.4, 3.2);
        this.fill.color.set("#ffffff");
        this.fill.intensity = 1.1;
        this.rim.color.set("#ffffff");
        this.rim.intensity = 1.2;
        envI(0.6);
        break;
      case "gallery":
      default:
        this.hemi.color.set("#fff4e6");
        this.hemi.groundColor.set("#2e2924");
        this.hemi.intensity = dark ? 0.22 : 0.75;
        k.color.set("#ffe6c4");
        k.intensity = dark ? 95 : 70;
        k.angle = dark ? 0.36 : 0.5;
        k.penumbra = 0.8;
        k.position.set(-1.4, 4.4, 2.4);
        this.fill.color.set(dark ? "#8a7a9e" : "#e4e8f4");
        this.fill.intensity = dark ? 0.25 : 0.6;
        this.rim.color.set("#ffe8c8");
        this.rim.intensity = dark ? 2.4 : 1.4;
        envI(dark ? 0.18 : 0.45);
        break;
    }
    if (this.beam) {
      (this.beam.material as THREE.ShaderMaterial).uniforms.uStrength.value = dark && id === "gallery" ? 0.07 : 0;
      this.beam.position.copy(k.position);
      this.beam.lookAt(new THREE.Vector3(0, 0.4, 0));
      this.beam.rotateX(-Math.PI / 2);
    }
  }

  dispose() {
    this.scene.remove(this.figure, this.lights, this.floor, this.shadowBlob);
    if (this.beam) this.scene.remove(this.beam);
    this.scene.environment = null;
    this.scene.fog = null;
    this.drape.dispose();
    this.envTarget?.dispose();
    this.figure.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry && m !== this.drape.skirt && m !== this.drape.pallu) m.geometry.dispose();
    });
  }
}

export type { DrapeStyleId, PoseId };
