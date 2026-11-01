/**
 * Builds the Vibes model — a realistic woman, from MakeHuman's CC0 base mesh,
 * body targets, skeleton and skin weights — in each pose, and writes
 * public/model/{pose}.bin.
 *
 *   MH_ROOT=/path/to/makehuman-checkout npx tsx scripts/build-model.ts [pose…]
 *
 * The MakeHuman checkout is only needed to rebuild; the output files are committed.
 */
import { mkdirSync, writeFileSync } from "fs";
import * as THREE from "three";
import path from "path";
import { MODEL_POSES, encodeModel, quadsToTris, type ModelPoseId } from "../src/studio/modelFormat";
import { smoothChannel, subdivide, vertexNormals, type QuadMesh } from "./model/geometry";
import { applyTarget, jointPos, mhPath, readObj, readSkeleton, readWeights } from "./model/mh";
import { curlHand, mergePoses, skin, type Pose } from "./model/pose";
import { buildBlouse, buildHair, profileOf } from "./model/wardrobe";

const ROOT = process.env.MH_ROOT;
if (!ROOT) throw new Error("Set MH_ROOT to a MakeHuman source checkout (see docs/ARCHITECTURE.md)");
const HEIGHT = 1.72;

const obj = readObj(mhPath(ROOT, "3dobjs", "base.obj"));
const v = new Float64Array(obj.v);
const T = (p: string, w: number) => applyTarget(v, mhPath(ROOT, "targets", p), w);
// a young woman with a model's proportions — slender, not exaggerated
T("macrodetails/universal-female-young-averagemuscle-averageweight.target", 1);
T("macrodetails/proportions/female-young-averagemuscle-averageweight-idealproportions.target", 1);
T("macrodetails/height/female-young-averagemuscle-averageweight-maxheight.target", 0.25);
T("stomach/stomach-pregnant-decr.target", 0.35);
T("hip/hip-scale-horiz-incr.target", 0.15);
T("buttocks/buttocks-volume-incr.target", 0.2);
const sk = readSkeleton(mhPath(ROOT, "rigs", "default.mhskel"));
const weights = readWeights(mhPath(ROOT, "rigs", "default_weights.mhw"));

// body faces only (the base mesh also carries helper geometry)
const bodyFaces = obj.faces.filter((f) => f.group === "body");
const used = new Map<number, number>();
for (const f of bodyFaces) for (const i of f.v) if (!used.has(i)) used.set(i, used.size);

const X = [1, 0, 0] as [number, number, number];
const Y = [0, 1, 0] as [number, number, number];
const Z = [0, 0, 1] as [number, number, number];

/**
 * Poses. Rotations are about rest-frame axes at each joint.
 * Her left is +x. Positive rotation about +z swings a left limb up and out.
 */
function poseFor(id: ModelPoseId): Pose {
  const hands = mergePoses(curlHand(v, sk, "L", 22), curlHand(v, sk, "R", 26));
  const common: Pose = {
    // arms down from the A-pose, carried just off the body, elbows softly bent
    // carried just clear of the hips, so the saree falls between hand and body
    "upperarm01.L": [{ axis: Z, deg: -28 }, { axis: X, deg: 4 }],
    "upperarm01.R": [{ axis: Z, deg: 28 }, { axis: X, deg: 4 }],
    "lowerarm01.L": [{ axis: X, deg: 38 }, { axis: Z, deg: -4 }],
    "lowerarm01.R": [{ axis: X, deg: 38 }, { axis: Z, deg: 4 }],
    // legs together from the rig's A-stance
    "upperleg01.L": [{ axis: Z, deg: -5.5 }],
    "upperleg01.R": [{ axis: Z, deg: 5.5 }],
    "wrist.L": [{ axis: Z, deg: -4 }],
    "wrist.R": [{ axis: Z, deg: 4 }],
  };
  if (id === "poised") {
    // weight on her right leg: the left hip drops a touch, the left knee relaxes forward
    return mergePoses(hands, common, {
      root: [{ axis: Z, deg: -1.6 }],
      spine03: [{ axis: Z, deg: 1.8 }, { axis: Y, deg: -4 }],
      neck01: [{ axis: Z, deg: -2.5 }, { axis: Y, deg: 6 }],
      "upperleg01.L": [{ axis: X, deg: -7 }, { axis: Z, deg: 1.5 }],
      "lowerleg01.L": [{ axis: X, deg: 12 }],
      "foot.L": [{ axis: Y, deg: 14 }, { axis: X, deg: -4 }],
      "upperleg01.R": [{ axis: Z, deg: -1.4 }],
      "foot.R": [{ axis: Y, deg: -6 }],
      "clavicle.L": [{ axis: Z, deg: 1.5 }],
    });
  }
  if (id === "ease") {
    // weight on her left leg, the right knee soft; the right arm carried a little forward
    return mergePoses(hands, common, {
      root: [{ axis: Z, deg: 1.8 }, { axis: Y, deg: 6 }],
      spine03: [{ axis: Z, deg: -2 }, { axis: Y, deg: -3 }],
      neck01: [{ axis: Z, deg: 3 }, { axis: Y, deg: -9 }],
      "upperarm01.R": [{ axis: X, deg: -5 }],
      "lowerarm01.R": [{ axis: X, deg: 6 }],
      "upperarm01.L": [{ axis: X, deg: 6 }],
      "upperleg01.R": [{ axis: X, deg: -8 }, { axis: Z, deg: -1.5 }],
      "lowerleg01.R": [{ axis: X, deg: 13 }],
      "foot.R": [{ axis: Y, deg: -16 }],
      "upperleg01.L": [{ axis: Z, deg: 1.4 }],
      "foot.L": [{ axis: Y, deg: 8 }],
    });
  }
  // turn: body a quarter turned, the gaze back over the shoulder
  return mergePoses(hands, common, {
    root: [{ axis: Y, deg: -14 }, { axis: Z, deg: -1.2 }],
    spine03: [{ axis: Y, deg: 10 }],
    neck01: [{ axis: Y, deg: 16 }, { axis: Z, deg: -3 }],
    "upperleg01.L": [{ axis: X, deg: -6 }],
    "lowerleg01.L": [{ axis: X, deg: 10 }],
    "foot.L": [{ axis: Y, deg: 20 }],
  });
}

const out = path.join(process.cwd(), "public", "model");
mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);

for (const id of MODEL_POSES) {
  if (only.length && !only.includes(id)) continue;
  const t = Date.now();
  const { pos: posed, world } = skin(v, sk, weights, poseFor(id));

  // region channels from the skin weights, carried through subdivision
  const region = (prefixes: string[]) => {
    const a = new Float64Array(used.size);
    for (const [bone, list] of Object.entries(weights)) {
      if (!prefixes.some((p) => bone.startsWith(p))) continue;
      for (const [i, w] of list) {
        const j = used.get(i);
        if (j !== undefined) a[j] += w;
      }
    }
    return a;
  };
  const pos = new Float64Array(used.size * 3);
  for (const [i, j] of used) for (let a = 0; a < 3; a++) pos[j * 3 + a] = posed[i * 3 + a];
  const quads = new Uint32Array(bodyFaces.length * 4);
  bodyFaces.forEach((f, k) => quads.set(f.v.map((i) => used.get(i)!), k * 4));
  let mesh: QuadMesh = {
    pos,
    quads,
    attrs: {
      arm: region(["upperarm", "lowerarm", "wrist", "metacarpal", "finger", "shoulder01"]),
      head: region(["head", "neck02", "neck03", "jaw", "eye", "oculi", "orbicularis", "oris", "risorius", "levator", "temporalis", "special", "tongue"]),
      leg: region(["upperleg", "lowerleg", "foot", "toe"]),
    },
  };
  mesh = subdivide(mesh);
  for (const k of Object.keys(mesh.attrs)) mesh.attrs[k] = smoothChannel(mesh.attrs[k], mesh.quads, 2);

  // metres, feet on the floor
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < mesh.pos.length; i += 3) {
    minY = Math.min(minY, mesh.pos[i]);
    maxY = Math.max(maxY, mesh.pos[i]);
  }
  const k = HEIGHT / (maxY - minY);
  for (let i = 0; i < mesh.pos.length; i += 3) {
    mesh.pos[i] *= k;
    mesh.pos[i + 1] = (mesh.pos[i + 1] - minY) * k;
    mesh.pos[i + 2] *= k;
  }
  // centre her: the torso's cross-section at the hips sits on the vertical axis
  let cx = 0;
  let cz = 0;
  let cn = 0;
  for (let i = 0; i < mesh.pos.length / 3; i++) {
    const y = mesh.pos[i * 3 + 1];
    if (y < 0.98 || y > 1.1 || mesh.attrs.arm[i] > 0.2 || mesh.attrs.leg[i] > 0.3) continue;
    cx += mesh.pos[i * 3];
    cz += mesh.pos[i * 3 + 2];
    cn++;
  }
  cx /= cn;
  cz /= cn;
  for (let i = 0; i < mesh.pos.length; i += 3) {
    mesh.pos[i] -= cx;
    mesh.pos[i + 2] -= cz;
  }
  const normals = vertexNormals(mesh.pos, mesh.quads);
  // joints in the pose: the bone's transform applied to its rest joint
  const joint = (b: string, end: "head" | "tail" = "head") => {
    const p = new THREE.Vector3(...jointPos(v, sk, sk.bones[b][end])).applyMatrix4(world[b]);
    return [p.x * k - cx, (p.y - minY) * k, p.z * k - cz] as [number, number, number];
  };

  const landmarks = {
    neck: joint("neck01"),
    head: joint("head"),
    chin: joint("jaw", "tail"),
    shoulderL: joint("upperarm01.L"),
    shoulderR: joint("upperarm01.R"),
    elbowL: joint("lowerarm01.L"),
    elbowR: joint("lowerarm01.R"),
    wristL: joint("wrist.L"),
    wristR: joint("wrist.R"),
    hipL: joint("upperleg01.L"),
    hipR: joint("upperleg01.R"),
    kneeL: joint("lowerleg01.L"),
    kneeR: joint("lowerleg01.R"),
    ankleL: joint("foot.L"),
    ankleR: joint("foot.R"),
    spine: joint("spine03"),
  };
  const profile = profileOf(mesh, landmarks);
  const blouse = buildBlouse(mesh, normals, landmarks, profile);
  const hair = buildHair(mesh, normals, landmarks);
  writeFileSync(path.join(out, `${id}.bin`), Buffer.from(encodeModel({ id, body: { pos: mesh.pos, normal: normals, index: quadsToTris(mesh.quads) }, blouse, hair, landmarks, profile, height: HEIGHT })));
  console.log(`${id.padEnd(8)} ${mesh.pos.length / 3} verts  ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
