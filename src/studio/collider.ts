import type { PoseId } from "@/lib/types";
import { BODY, armJoints, bodyRx, legJoints, shoulderCaps, torsoRz } from "./body";
import type { Collider } from "./cloth";

/**
 * The body as the cloth feels it. Built from the same analytic description
 * as the mannequin mesh, so fabric rests exactly on the visible surface.
 */

type V3 = { x: number; y: number; z: number };
const TORSO_TOP = 1.545;

function torsoD(x: number, y: number, z: number, m: number) {
  const th = Math.atan2(x, z);
  const rx = bodyRx(y) + m;
  const rz = torsoRz(y, th) + m;
  return Math.sqrt((x / rx) ** 2 + (z / rz) ** 2);
}

/** Torso: pushed out along the true surface normal (so cloth can rest on a sloping shoulder). */
export function torsoCollider(): Collider {
  const h = 0.0015;
  return (p, i, m) => {
    const k = 3 * i;
    let x = p[k];
    let y = p[k + 1];
    let z = p[k + 2];
    if (y < BODY.torsoBottom || y > TORSO_TOP) return false;
    let hit = false;
    for (let it = 0; it < 2; it++) {
      const d = torsoD(x, y, z, m);
      if (d >= 1) break;
      hit = true;
      const gx = (torsoD(x + h, y, z, m) - torsoD(x - h, y, z, m)) / (2 * h);
      const gy = y + h > TORSO_TOP || y - h < BODY.torsoBottom ? 0 : (torsoD(x, y + h, z, m) - torsoD(x, y - h, z, m)) / (2 * h);
      const gz = (torsoD(x, y, z + h, m) - torsoD(x, y, z - h, m)) / (2 * h);
      const g2 = gx * gx + gy * gy + gz * gz;
      if (g2 < 1e-6) break;
      const s = (1 - d) / g2;
      x += gx * s;
      y += gy * s;
      z += gz * s;
    }
    if (hit) {
      p[k] = x;
      p[k + 1] = y;
      p[k + 2] = z;
    }
    return hit;
  };
}

/** A capsule whose radius tapers from ra (at a) to rb (at b). */
export function taperedCapsule(a: V3, b: V3, ra: number, rb: number): Collider {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const ab2 = abx * abx + aby * aby + abz * abz;
  const minY = Math.min(a.y, b.y) - Math.max(ra, rb) - 0.03;
  const maxY = Math.max(a.y, b.y) + Math.max(ra, rb) + 0.03;
  return (p, i, m) => {
    const k = 3 * i;
    const y = p[k + 1];
    if (y < minY || y > maxY) return false;
    const px = p[k] - a.x;
    const py = y - a.y;
    const pz = p[k + 2] - a.z;
    const t = Math.min(1, Math.max(0, (px * abx + py * aby + pz * abz) / ab2));
    const dx = px - abx * t;
    const dy = py - aby * t;
    const dz = pz - abz * t;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const r = ra + (rb - ra) * t + m;
    if (d >= r || d < 1e-7) return false;
    const s = r / d;
    p[k] = a.x + abx * t + dx * s;
    p[k + 1] = a.y + aby * t + dy * s;
    p[k + 2] = a.z + abz * t + dz * s;
    return true;
  };
}

export function sphere(c: V3, r: number): Collider {
  return taperedCapsule(c, { x: c.x, y: c.y + 1e-4, z: c.z }, r, r);
}

export function floor(level = 0): Collider {
  return (p, i, m) => {
    const k = 3 * i + 1;
    if (p[k] >= level + m) return false;
    p[k] = level + m;
    return true;
  };
}

/** Every part of the body for a pose. */
export function bodyColliders(pose: PoseId): Collider[] {
  const out: Collider[] = [torsoCollider(), floor(0)];
  // neck
  out.push(taperedCapsule({ x: 0, y: 1.5, z: 0.005 }, { x: 0, y: 1.66, z: 0.005 }, 0.048, 0.042));
  for (const c of shoulderCaps(pose)) out.push(sphere(c, 0.052));
  for (const l of legJoints(pose)) {
    out.push(taperedCapsule(l.hip, l.knee, 0.088, 0.056));
    out.push(taperedCapsule(l.knee, l.ankle, 0.056, 0.034));
    out.push(taperedCapsule({ x: l.ankle.x, y: l.ankle.y + 0.005, z: l.ankle.z - 0.03 }, l.toe, 0.036, 0.024));
  }
  for (const j of armJoints(pose)) {
    // the upper arm includes the blouse sleeve
    out.push(taperedCapsule(j.sh, j.elbow, 0.058, 0.04));
    out.push(taperedCapsule(j.elbow, j.wrist, 0.036, 0.028));
    out.push(sphere({ x: j.wrist.x, y: j.wrist.y - 0.045, z: j.wrist.z }, 0.034));
  }
  return out;
}

/**
 * The outer surface of a finished skirt as a height × angle radius map, so
 * the pallu can lie on the skirt instead of passing through it.
 */
export function hullCollider(positions: Float32Array, top: number): Collider {
  const NY = 120;
  const NT = 96;
  const R = new Float32Array(NY * NT);
  const yAt = (y: number) => Math.min(NY - 1, Math.max(0, Math.round((y / top) * (NY - 1))));
  const tAt = (th: number) => ((Math.round(((th + Math.PI) / (2 * Math.PI)) * NT) % NT) + NT) % NT;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (y > top) continue;
    const b = yAt(y) * NT + tAt(Math.atan2(x, z));
    R[b] = Math.max(R[b], Math.hypot(x, z));
  }
  // dilate so gaps between grid samples are closed
  const D = new Float32Array(R);
  for (let yi = 0; yi < NY; yi++)
    for (let ti = 0; ti < NT; ti++) {
      let v = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dt = -2; dt <= 2; dt++) {
          const yy = Math.min(NY - 1, Math.max(0, yi + dy));
          v = Math.max(v, R[yy * NT + ((ti + dt + NT) % NT)]);
        }
      D[yi * NT + ti] = v;
    }
  return (p, i, m) => {
    const k = 3 * i;
    const y = p[k + 1];
    if (y > top || y < 0) return false;
    const x = p[k];
    const z = p[k + 2];
    const r = D[yAt(y) * NT + tAt(Math.atan2(x, z))];
    if (r === 0) return false;
    const d = Math.hypot(x, z);
    const want = r + m;
    if (d >= want || d < 1e-6) return false;
    p[k] = (x / d) * want;
    p[k + 2] = (z / d) * want;
    return true;
  };
}
