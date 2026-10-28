import * as THREE from "three";
import type { MannequinId, PoseId } from "@/lib/types";

/**
 * The mannequin body is defined analytically. The same functions build the
 * visible mesh AND act as the collision envelope for the drape, so fabric
 * always sits on the body without a physics engine.
 *
 * Units are metres. Floor is y = 0. The figure faces +z; her left is +x.
 */

export const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

type Key = [y: number, v: number];
function curve(keys: Key[], y: number) {
  if (y <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [y1, v1] = keys[i];
    const [y0, v0] = keys[i - 1];
    if (y <= y1) {
      const t = (y - y0) / (y1 - y0);
      const s = t * t * (3 - 2 * t);
      return v0 + (v1 - v0) * s;
    }
  }
  return keys[keys.length - 1][1];
}

/** Half-width (x) of the torso. */
const RX: Key[] = [
  [0.78, 0.165],
  [0.92, 0.178],
  [1.04, 0.128],
  [1.18, 0.138],
  [1.3, 0.15],
  [1.41, 0.168],
  [1.46, 0.165],
  [1.5, 0.11],
  [1.53, 0.05],
  [1.54, 0.046],
];
/** Half-depth (z) of the torso. */
const RZ: Key[] = [
  [0.78, 0.112],
  [0.92, 0.118],
  [1.04, 0.088],
  [1.18, 0.096],
  [1.3, 0.104],
  [1.41, 0.088],
  [1.48, 0.07],
  [1.53, 0.046],
  [1.54, 0.044],
];

export const BODY = {
  waist: 1.04,
  hip: 0.92,
  bust: 1.3,
  shoulder: 1.46,
  neckTop: 1.6,
  torsoBottom: 0.78,
  headY: 1.69,
};

export function bodyRx(y: number) {
  return curve(RX, y);
}
export function bodyRz(y: number) {
  return curve(RZ, y);
}
/** Bust adds a forward bulge on the front half. */
export function bustBulge(y: number) {
  return 0.028 * smooth(1.18, 1.27, y) * (1 - smooth(1.31, 1.4, y));
}
/** The seat: a soft rounded bulge low on the back — what the skirt drapes over. */
export function seatBulge(y: number) {
  return 0.036 * smooth(0.76, 0.88, y) * (1 - smooth(0.93, 1.03, y));
}
/** A gentle lower-belly curve below the navel. */
export function bellyBulge(y: number) {
  return 0.012 * smooth(0.86, 0.94, y) * (1 - smooth(0.98, 1.05, y));
}

/** Half-depth of the torso in direction θ, including bust, belly and seat. */
export function torsoRz(y: number, theta: number) {
  const c = Math.cos(theta);
  const front = Math.max(0, c);
  const back = Math.max(0, -c);
  // the seat is two rounded forms, fuller off-centre than on the spine
  const seat = seatBulge(y) * back * back * (0.75 + 0.25 * Math.abs(Math.sin(theta * 2)));
  return bodyRz(y) + (bustBulge(y) + bellyBulge(y)) * front * front + seat;
}

/** Point on the torso surface for height y, angle θ (0 = front, +π/2 = her left). */
export function torsoPoint(y: number, theta: number, offset = 0, out = new THREE.Vector3()) {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  return out.set(s * (bodyRx(y) + offset), y, c * (torsoRz(y, theta) + offset));
}

/* ───────────── skirt envelope (the pleated lower drape) ───────────── */

export const SKIRT = { top: 1.045, hem: 0.012 };

/** Skirt half-width / half-depth at height y (before pleat displacement). */
export function skirtRx(y: number) {
  const hipR = 0.19;
  if (y > BODY.hip) return Math.max(bodyRx(y) + 0.01, hipR - (y - BODY.hip) * 0.45);
  // hips → hem: falls nearly straight with a gentle flare
  const t = (BODY.hip - y) / (BODY.hip - SKIRT.hem);
  return hipR + 0.055 * t * t + 0.012 * t;
}
export function skirtRz(y: number) {
  if (y > BODY.hip) return Math.max(bodyRz(y) + 0.01, 0.128 - (y - BODY.hip) * 0.3);
  const t = (BODY.hip - y) / (BODY.hip - SKIRT.hem);
  return 0.128 + 0.06 * t * t + 0.02 * t;
}

/** Combined envelope — anything outside this does not intersect body or skirt. */
export function envelope(y: number) {
  if (y > BODY.waist) {
    return { rx: bodyRx(y), rz: bodyRz(y) + bustBulge(y) * 0.9 };
  }
  return { rx: Math.max(bodyRx(Math.max(y, BODY.torsoBottom)), skirtRx(y)) + 0.012, rz: Math.max(bodyRz(Math.max(y, BODY.torsoBottom)), skirtRz(y)) + 0.03 };
}

/** Push a point outside the envelope (elliptical radial projection). */
export function pushOutside(p: THREE.Vector3, margin: number) {
  const { rx, rz } = envelope(p.y);
  const ex = rx + margin;
  const ez = rz + margin;
  const d = Math.sqrt((p.x / ex) ** 2 + (p.z / ez) ** 2);
  if (d < 1 && d > 1e-5) {
    p.x /= d;
    p.z /= d;
  }
  return p;
}

/* ───────────── Mannequin mesh ───────────── */

export const MANNEQUIN_FINISHES: Record<MannequinId, { label: string; light: string; dark: string; roughness: number }> = {
  ivory: { label: "Ivory plaster", light: "#e6ddcf", dark: "#cfc4b3", roughness: 0.62 },
  stone: { label: "Warm stone", light: "#c9bba6", dark: "#a8987f", roughness: 0.75 },
  graphite: { label: "Graphite satin", light: "#4a4541", dark: "#2b2826", roughness: 0.42 },
};

/**
 * Poses. `kneeL/kneeR` push a knee forward (a relaxed, weight-free leg),
 * `footL/footR` turn the foot out — real women rarely stand symmetrically,
 * and the drape reads that through the fabric.
 */
export const POSES: Record<PoseId, { label: string; arms: boolean; head: boolean; headTilt: number; armL: number; armR: number; hipShift: number; kneeL: number; kneeR: number; footL: number; footR: number; stance: number }> = {
  classic: { label: "Classic", arms: true, head: true, headTilt: 0.04, armL: 0.13, armR: 0.13, hipShift: 0, kneeL: 0.028, kneeR: 0.004, footL: 0.28, footR: 0.12, stance: 0.07 },
  contrapposto: { label: "Contrapposto", arms: true, head: true, headTilt: -0.09, armL: 0.08, armR: 0.24, hipShift: 0.012, kneeL: 0.06, kneeR: 0, footL: 0.45, footR: 0.1, stance: 0.06 },
  dressform: { label: "Dress form", arms: false, head: false, headTilt: 0, armL: 0, armR: 0, hipShift: 0, kneeL: 0.012, kneeR: 0.012, footL: 0.15, footR: 0.15, stance: 0.07 },
};

/** Hip, knee, ankle and toe for each leg (her left = +x). */
export function legJoints(pose: PoseId) {
  const p = POSES[pose];
  return [1, -1].map((side) => {
    const knee = side > 0 ? p.kneeL : p.kneeR;
    const turn = side > 0 ? p.footL : p.footR;
    // a relaxed leg brings the knee forward and slightly inward, the heel a touch higher
    const hip = new THREE.Vector3(side * 0.088, 0.86, -0.006);
    const kneeP = new THREE.Vector3(side * (0.075 - knee * 0.35), 0.47 - knee * 0.15, 0.012 + knee);
    const ankle = new THREE.Vector3(side * (p.stance - knee * 0.25), 0.075 + knee * 0.3, -0.012 + knee * 0.2);
    const toe = ankle.clone().add(new THREE.Vector3(side * Math.sin(turn) * 0.12, -0.05 - knee * 0.25, Math.cos(turn) * 0.12));
    return { side, hip, knee: kneeP, ankle, toe };
  });
}

/** Shoulder caps — rounded deltoids the pallu rests over. */
export function shoulderCaps(pose: PoseId) {
  if (!POSES[pose].arms) return [new THREE.Vector3(0.15, 1.442, -0.004), new THREE.Vector3(-0.15, 1.442, -0.004)];
  return [new THREE.Vector3(0.162, 1.448, -0.004), new THREE.Vector3(-0.162, 1.448, -0.004)];
}

export function armJoints(pose: PoseId) {
  const p = POSES[pose];
  if (!p.arms) return [];
  return [1, -1].map((side) => {
    const spread = side > 0 ? p.armL : p.armR;
    return {
      side,
      sh: new THREE.Vector3(side * 0.168, 1.445, -0.004),
      elbow: new THREE.Vector3(side * (0.19 + spread * 0.32), 1.17, -0.02),
      wrist: new THREE.Vector3(side * (0.205 + spread * 0.62), 0.92, side > 0 ? 0.02 : 0.03),
    };
  });
}

const _ab = new THREE.Vector3();
const _ap = new THREE.Vector3();
/** Push a point out of a capsule (used for the arms). */
export function pushOutsideCapsule(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, r: number) {
  _ab.subVectors(b, a);
  const t = Math.min(1, Math.max(0, _ap.subVectors(p, a).dot(_ab) / _ab.lengthSq()));
  const cx = a.x + _ab.x * t, cy = a.y + _ab.y * t, cz = a.z + _ab.z * t;
  const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < r && d > 1e-6) {
    const k = r / d;
    p.set(cx + dx * k, cy + dy * k, cz + dz * k);
  }
  return p;
}

function torsoGeometry(y0: number, y1: number | ((theta: number) => number), offset: number, rings = 72, segs = 72) {
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= rings; i++) {
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      const top = typeof y1 === "number" ? y1 : y1(th);
      const y = y0 + ((top - y0) * i) / rings;
      torsoPoint(y, th, offset, v);
      pos.push(v.x, v.y, v.z);
      uv.push(j / segs, i / rings);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j;
      const b = a + segs + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  geo.setIndex(idx);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

function limb(from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number) {
  const len = from.distanceTo(to);
  const pts: THREE.Vector2[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // tapered with rounded ends
    const cap = Math.sin(Math.min(1, t * 6) * Math.PI * 0.5) * Math.sin(Math.min(1, (1 - t) * 8) * Math.PI * 0.5);
    const r = (r0 + (r1 - r0) * t) * (0.25 + 0.75 * cap);
    pts.push(new THREE.Vector2(Math.max(0.001, r), -t * len));
  }
  const geo = new THREE.LatheGeometry(pts, 28);
  const m = new THREE.Mesh(geo);
  m.position.copy(from);
  const dir = to.clone().sub(from).normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  return m;
}

export interface MannequinParts {
  group: THREE.Group;
  skin: THREE.MeshStandardMaterial;
  blouse: THREE.MeshPhysicalMaterial;
  plinth: THREE.MeshStandardMaterial;
}

/**
 * Builds the single reusable mannequin. Every saree in the archive is
 * presented on this same figure.
 */
export function createMannequin(pose: PoseId = "classic"): MannequinParts {
  const p = POSES[pose];
  const group = new THREE.Group();
  group.name = "mannequin";
  const skin = new THREE.MeshStandardMaterial({ color: "#e6ddcf", roughness: 0.62, metalness: 0 });
  const blouse = new THREE.MeshPhysicalMaterial({ color: "#5a1f2e", roughness: 0.55, sheen: 0.8, sheenRoughness: 0.45 });
  const plinth = new THREE.MeshStandardMaterial({ color: "#d8d0c3", roughness: 0.9 });

  // torso: legs are implied beneath the skirt; torso continues under the skirt
  const torso = new THREE.Mesh(torsoGeometry(BODY.torsoBottom, 1.54, 0), skin);
  group.add(torso);
  // blouse — fitted from under the bust over the shoulders, with a soft scooped neckline
  const neckline = (th: number) => {
    const c = Math.cos(th);
    const front = Math.max(0, c);
    const back = Math.max(0, -c);
    const side = Math.abs(Math.sin(th));
    return 1.535 - 0.085 * front ** 1.6 - 0.05 * back ** 2 - 0.004 * side;
  };
  const blouseMesh = new THREE.Mesh(torsoGeometry(1.205, neckline, 0.004, 52, 96), blouse);
  group.add(blouseMesh);

  // legs and feet — the drape falls over these, and the toes peep out beneath the pleats
  for (const l of legJoints(pose)) {
    const thigh = limb(l.hip, l.knee, 0.088, 0.056);
    const calf = limb(l.knee, l.ankle, 0.056, 0.034);
    const foot = limb(l.ankle.clone().add(new THREE.Vector3(0, 0.005, -0.03)), l.toe, 0.034, 0.022);
    for (const m of [thigh, calf, foot]) {
      m.material = skin;
      group.add(m);
    }
  }

  if (p.head) {
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.046, 0.12, 32), skin);
    neck.position.set(0, 1.575, 0.005);
    group.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 48, 32), skin);
    head.scale.set(0.82, 1.08, 0.94);
    head.position.set(0, BODY.headY, 0.018);
    head.rotation.z = p.headTilt;
    group.add(head);
    // a quiet chignon — reads as feminine without a face
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.048, 32, 24), skin);
    bun.position.set(0, BODY.headY - 0.03, -0.085);
    group.add(bun);
  } else {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.046, 0.04, 32), skin);
    cap.position.set(0, 1.56, 0);
    group.add(cap);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 24, 16), plinth);
    knob.position.set(0, 1.6, 0);
    group.add(knob);
  }

  if (p.arms) {
    for (const { side, sh, elbow, wrist } of armJoints(pose)) {
      const upper = limb(sh, elbow, 0.046, 0.036);
      const fore = limb(elbow, wrist, 0.035, 0.026);
      upper.material = skin;
      fore.material = skin;
      const sleeve = limb(sh.clone().add(new THREE.Vector3(-side * 0.03, 0.012, 0)), sh.clone().lerp(elbow, 0.4), 0.056, 0.045);
      sleeve.material = blouse;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 16), skin);
      hand.scale.set(0.55, 1.7, 0.85);
      hand.position.copy(wrist).add(new THREE.Vector3(side * 0.006, -0.045, 0));
      group.add(upper, fore, sleeve, hand);
    }
  }

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.035, 96), plinth);
  base.position.y = -0.0175;
  base.receiveShadow = true;
  group.add(base);

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  group.position.x = p.hipShift;
  return { group, skin, blouse, plinth };
}
