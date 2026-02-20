#!/usr/bin/env node
/**
 * Retarget FBX animations (e.g. CC_Base skeleton) onto a Mixamo-style GLB rig, and write the
 * resulting clips into the GLB so they can be selected at runtime.
 *
 * This script is intentionally pragmatic: it targets common humanoid bone names and is suitable
 * for idles, waves, and other light motions. For perfect retargeting, use a DCC/engine retargeter.
 *
 * Example:
 *   node scripts/retarget_fbx_animations_to_glb.mjs \
 *     --base public/assets/robot.ktx2.no-normals.glb \
 *     --out public/assets/robot.ktx2.no-normals.glb \
 *     --clip Breathing=public/assets/Breathing/breathing-m.fbx \
 *     --clip Waving=public/assets/Waving/elevator_greeting_m.fbx \
 *     --in-place-root
 */

import { readFileSync } from 'node:fs';
import { mkdirSync, rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';

import { AnimationClip, Skeleton, Vector3 } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';

function parseArgs(argv) {
  const args = {
    base: undefined,
    out: undefined,
    clips: [],
    inPlaceRoot: false,
    debug: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token) continue;

    if (token === '--base') {
      args.base = argv[++i];
      continue;
    }
    if (token === '--out') {
      args.out = argv[++i];
      continue;
    }
    if (token === '--clip') {
      const spec = argv[++i];
      if (!spec || !spec.includes('=')) throw new Error('Expected --clip in format Name=/path/to/clip.fbx');
      const [name, fbx] = spec.split('=', 2);
      if (!name?.trim()) throw new Error('Clip name cannot be empty.');
      if (!fbx?.trim()) throw new Error(`Clip "${name}" path cannot be empty.`);
      args.clips.push({ name: name.trim(), fbx: fbx.trim() });
      continue;
    }
    if (token === '--in-place-root') {
      args.inPlaceRoot = true;
      continue;
    }
    if (token === '--debug') {
      args.debug = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (!args.base) throw new Error('Missing required --base path.');
  if (!args.out) throw new Error('Missing required --out path.');
  if (!args.clips.length) throw new Error('At least one --clip is required.');

  return args;
}

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function stripNamespace(name) {
  const idx = name.lastIndexOf(':');
  return idx >= 0 ? name.slice(idx + 1) : name;
}

function stripMixamoPrefix(name) {
  return name.replace(/^mixamorig/i, '');
}

function normalizeTargetBoneName(name) {
  return stripMixamoPrefix(stripNamespace(name)).toLowerCase();
}

function quatMultiply(ax, ay, az, aw, bx, by, bz, bw) {
  // a * b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function fixHipsRotationToRest(clip, restQuat, debugLabel) {
  // retargetClip() produces tracks like ".bones[mixamorigHips].quaternion".
  // Some sources introduce a constant +90° X pre-rotation on hips; normalize
  // the hips track so the first frame matches the target rig's rest rotation.
  if (debugLabel) {
    const hipCandidates = clip.tracks.filter((t) => /hips/i.test(t.name) && /quaternion$/i.test(t.name));
    // eslint-disable-next-line no-console
    console.info(`[${debugLabel}] fix hips candidates:`, hipCandidates.map((t) => t.name));
  }
  const hipsQuatTrack = clip.tracks.find((t) => /\\.bones\\[[^\\]]*hips[^\\]]*\\]\\.quaternion$/i.test(t.name));
  if (!hipsQuatTrack) return clip;

  const v = hipsQuatTrack.values;
  if (debugLabel) {
    // eslint-disable-next-line no-console
    console.info(`[${debugLabel}] hips values type:`, v?.constructor?.name, 'len:', v?.length);
  }
  if (!v || v.length < 4) return clip;
  if (debugLabel) {
    // eslint-disable-next-line no-console
    console.info(`[${debugLabel}] fix hips before:`, hipsQuatTrack.name, Array.from(v.slice(0, 4)));
  }

  const x0 = v[0];
  const y0 = v[1];
  const z0 = v[2];
  const w0 = v[3];

  // Inverse of q0 (assuming q0 is normalized): q^-1 = (-x, -y, -z, w)
  const ix = -x0;
  const iy = -y0;
  const iz = -z0;
  const iw = w0;

  const [rx, ry, rz, rw] = restQuat;
  const [fx, fy, fz, fw] = quatMultiply(rx, ry, rz, rw, ix, iy, iz, iw);

  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i += 4) {
    const x = v[i + 0];
    const y = v[i + 1];
    const z = v[i + 2];
    const w = v[i + 3];

    // q' = fix * q, where fix = rest * inv(q0)
    const nx = fw * x + fx * w + fy * z - fz * y;
    const ny = fw * y - fx * z + fy * w + fz * x;
    const nz = fw * z + fx * y - fy * x + fz * w;
    const nw = fw * w - fx * x - fy * y - fz * z;

    // Normalize.
    const len = Math.hypot(nx, ny, nz, nw) || 1;
    out[i + 0] = nx / len;
    out[i + 1] = ny / len;
    out[i + 2] = nz / len;
    out[i + 3] = nw / len;
  }

  hipsQuatTrack.values = out;
  if (debugLabel) {
    // eslint-disable-next-line no-console
    console.info(`[${debugLabel}] fix hips after:`, hipsQuatTrack.name, Array.from(hipsQuatTrack.values.slice(0, 4)));
  }
  return clip;
}

function findFirstSkinnedMesh(root) {
  let found = null;
  root.traverse((obj) => {
    if (found) return;
    if ('isSkinnedMesh' in obj && obj.isSkinnedMesh) {
      found = obj;
    }
  });
  return found;
}

function findBones(root) {
  const bones = [];
  root.traverse((obj) => {
    if ('isBone' in obj && obj.isBone) bones.push(obj);
  });
  return bones;
}

function countBoneDescendants(rootBone) {
  let count = 0;
  rootBone.traverse((obj) => {
    if ('isBone' in obj && obj.isBone) count++;
  });
  return count;
}

function pickRootBone(bones) {
  const roots = bones.filter((b) => !(b.parent && 'isBone' in b.parent && b.parent.isBone));
  if (!roots.length) return bones[0] ?? null;
  roots.sort((a, b) => countBoneDescendants(b) - countBoneDescendants(a));
  return roots[0] ?? null;
}

function collectBonesDepthFirst(rootBone) {
  const ordered = [];
  rootBone.traverse((obj) => {
    if ('isBone' in obj && obj.isBone) ordered.push(obj);
  });
  return ordered;
}

function buildSkeletonFromFbxGroup(group) {
  const bones = findBones(group);
  if (!bones.length) return null;
  const rootBone = pickRootBone(bones);
  if (!rootBone) return null;
  group.updateMatrixWorld(true);
  rootBone.updateMatrixWorld(true);
  const ordered = collectBonesDepthFirst(rootBone);
  return new Skeleton(ordered);
}

function loadGltfSceneFromBuffer(arrayBuffer) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(
      arrayBuffer,
      '',
      (gltf) => {
        resolve(gltf.scene);
      },
      (err) => reject(err),
    );
  });
}

function loadFbxFromBuffer(arrayBuffer) {
  const loader = new FBXLoader();
  return loader.parse(arrayBuffer, '');
}

function buildMixamoToCcBaseNameMap(targetBones) {
  const map = {};

  const set = (target, source) => {
    map[target] = source;
  };

  const normalize = (n) => normalizeTargetBoneName(n);

  for (const bone of targetBones) {
    const name = bone.name;
    const n = normalize(name);

    // Core.
    if (n === 'hips') set(name, 'CC_Base_Hip');
    else if (n === 'spine') set(name, 'CC_Base_Waist');
    else if (n === 'spine1') set(name, 'CC_Base_Spine01');
    else if (n === 'spine2') set(name, 'CC_Base_Spine02');
    else if (n === 'neck') set(name, 'CC_Base_NeckTwist02');
    else if (n === 'head') set(name, 'CC_Base_Head');

    // Legs.
    else if (n === 'leftupleg') set(name, 'CC_Base_L_Thigh');
    else if (n === 'leftleg') set(name, 'CC_Base_L_Calf');
    else if (n === 'leftfoot') set(name, 'CC_Base_L_Foot');
    else if (n === 'lefttoebase') set(name, 'CC_Base_L_ToeBase');
    else if (n === 'rightupleg') set(name, 'CC_Base_R_Thigh');
    else if (n === 'rightleg') set(name, 'CC_Base_R_Calf');
    else if (n === 'rightfoot') set(name, 'CC_Base_R_Foot');
    else if (n === 'righttoebase') set(name, 'CC_Base_R_ToeBase');

    // Arms.
    else if (n === 'leftshoulder') set(name, 'CC_Base_L_Clavicle');
    else if (n === 'leftarm') set(name, 'CC_Base_L_Upperarm');
    else if (n === 'leftforearm') set(name, 'CC_Base_L_Forearm');
    else if (n === 'lefthand') set(name, 'CC_Base_L_Hand');
    else if (n === 'rightshoulder') set(name, 'CC_Base_R_Clavicle');
    else if (n === 'rightarm') set(name, 'CC_Base_R_Upperarm');
    else if (n === 'rightforearm') set(name, 'CC_Base_R_Forearm');
    else if (n === 'righthand') set(name, 'CC_Base_R_Hand');

    // Fingers (approximate).
    else if (/^lefthandthumb(\d)$/.test(n)) {
      const d = Number(n.match(/^lefthandthumb(\d)$/)?.[1] ?? 0);
      if (d >= 1 && d <= 3) set(name, `CC_Base_L_Thumb${d}`);
    } else if (/^righthandthumb(\d)$/.test(n)) {
      const d = Number(n.match(/^righthandthumb(\d)$/)?.[1] ?? 0);
      if (d >= 1 && d <= 3) set(name, `CC_Base_R_Thumb${d}`);
    } else if (/^lefthandindex(\d)$/.test(n)) {
      const d = Number(n.match(/^lefthandindex(\d)$/)?.[1] ?? 0);
      if (d >= 1 && d <= 3) set(name, `CC_Base_L_Index${d}`);
    } else if (/^righthandindex(\d)$/.test(n)) {
      const d = Number(n.match(/^righthandindex(\d)$/)?.[1] ?? 0);
      if (d >= 1 && d <= 3) set(name, `CC_Base_R_Index${d}`);
    } else if (/^lefthandmiddle(\d)$/.test(n)) {
      const d = Number(n.match(/^lefthandmiddle(\d)$/)?.[1] ?? 0);
      if (d >= 1 && d <= 3) set(name, `CC_Base_L_Mid${d}`);
    } else if (/^righthandmiddle(\d)$/.test(n)) {
      const d = Number(n.match(/^righthandmiddle(\d)$/)?.[1] ?? 0);
      if (d >= 1 && d <= 3) set(name, `CC_Base_R_Mid${d}`);
    } else if (/^lefthandring(\d)$/.test(n)) {
      const d = Number(n.match(/^lefthandring(\d)$/)?.[1] ?? 0);
      if (d >= 1 && d <= 3) set(name, `CC_Base_L_Ring${d}`);
    } else if (/^righthandring(\d)$/.test(n)) {
      const d = Number(n.match(/^righthandring(\d)$/)?.[1] ?? 0);
      if (d >= 1 && d <= 3) set(name, `CC_Base_R_Ring${d}`);
    } else if (/^lefthandpinky(\d)$/.test(n)) {
      const d = Number(n.match(/^lefthandpinky(\d)$/)?.[1] ?? 0);
      if (d >= 1 && d <= 3) set(name, `CC_Base_L_Pinky${d}`);
    } else if (/^righthandpinky(\d)$/.test(n)) {
      const d = Number(n.match(/^righthandpinky(\d)$/)?.[1] ?? 0);
      if (d >= 1 && d <= 3) set(name, `CC_Base_R_Pinky${d}`);
    }
  }

  return map;
}

function buildBaseNodeLookup(doc) {
  const nodes = doc.getRoot().listNodes();
  const byExact = new Map();
  const byShortLower = new Map();

  for (const node of nodes) {
    const name = node.getName();
    if (!name) continue;
    byExact.set(name, node);
    byShortLower.set(stripNamespace(name).toLowerCase(), node);
  }

  const resolve = (boneName) => {
    const exact = byExact.get(boneName);
    if (exact) return exact;
    const key = normalizeTargetBoneName(boneName);
    return byShortLower.get(key) ?? null;
  };

  return { resolve };
}

function addThreeClipToGltfDoc({ doc, clip, nodeLookup, inPlaceRoot }) {
  const anim = doc.createAnimation(clip.name);

  for (const track of clip.tracks) {
    const m = track.name.match(/^\.(?:bones)\[([^\]]+)\]\.(position|quaternion)$/);
    if (!m) continue;
    const boneName = m[1];
    const prop = m[2];

    const node = nodeLookup.resolve(boneName);
    if (!node) continue;

    const targetPath = prop === 'position' ? 'translation' : 'rotation';
    const times = track.times;
    const values = track.values;

    const timeAccessor = doc.createAccessor(`${clip.name}__${boneName}__t`).setArray(new Float32Array(times)).setType('SCALAR');
    let valueArray = values instanceof Float32Array ? values : new Float32Array(values);

    if (inPlaceRoot && targetPath === 'translation' && normalizeTargetBoneName(boneName) === 'hips') {
      const next = new Float32Array(valueArray.length);
      next.set(valueArray);
      for (let i = 0; i < next.length; i += 3) {
        next[i + 0] = 0;
        next[i + 2] = 0;
      }
      valueArray = next;
    }

    const valueAccessor = doc.createAccessor(`${clip.name}__${boneName}__v`).setArray(valueArray).setType(
      targetPath === 'rotation' ? 'VEC4' : 'VEC3',
    );

    const sampler = doc.createAnimationSampler(`${clip.name}__${boneName}`);
    sampler.setInput(timeAccessor);
    sampler.setOutput(valueAccessor);
    sampler.setInterpolation('LINEAR');
    anim.addSampler(sampler);

    const channel = doc.createAnimationChannel(`${clip.name}__${boneName}`);
    channel.setSampler(sampler);
    channel.setTargetNode(node);
    channel.setTargetPath(targetPath);
    anim.addChannel(channel);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

  const tempRoot = mkdtempSync(path.join(tmpdir(), 'brewflow-retarget-'));
  const processingGlb = path.join(tempRoot, 'robot.processing.glb');

  try {
    // Load base GLB for writing (gltf-transform).
    const baseDoc = await io.read(args.base);
    const nodeLookup = buildBaseNodeLookup(baseDoc);
    const incomingClipNames = new Set(args.clips.map((c) => c.name));
    // Remove existing animations with the same names to avoid duplicates when iterating.
    const baseRoot = baseDoc.getRoot();
    for (const anim of [...baseRoot.listAnimations()]) {
      const name = anim.getName();
      if (name && incomingClipNames.has(name)) {
        baseRoot.removeRef('animations', anim);
      }
    }
    await baseDoc.transform(prune());
    const baseHipsNode =
      baseDoc
        .getRoot()
        .listNodes()
        .find((n) => normalizeTargetBoneName(n.getName() ?? '') === 'hips') ?? null;
    const baseHipsRotation = baseHipsNode?.getRotation() ?? [0, 0, 0, 1];
    if (args.debug) {
      // eslint-disable-next-line no-console
      console.info('Base hips rotation:', baseHipsRotation);
    }

    // Write a "processing" GLB without textures/materials, so GLTFLoader doesn't need KTX2.
    // (We only need the skeleton for retargeting.)
    {
      const doc = await io.read(args.base);
      const root = doc.getRoot();
      for (const mesh of root.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
          prim.setMaterial(null);
        }
      }
      for (const mat of root.listMaterials()) mat.dispose();
      for (const tex of root.listTextures()) tex.dispose();
      await io.write(processingGlb, doc);
    }

    const targetSceneBuf = toArrayBuffer(readFileSync(processingGlb));
    const targetScene = await loadGltfSceneFromBuffer(targetSceneBuf);
    const targetMesh = findFirstSkinnedMesh(targetScene);
    if (!targetMesh) throw new Error(`No SkinnedMesh found in base GLB: ${args.base}`);

    const targetBones = targetMesh.skeleton.bones;
    const namesMap = buildMixamoToCcBaseNameMap(targetBones);

    // SkeletonUtils uses `options.hip` against the mapped source bone name.
    const sourceHipName = 'CC_Base_Hip';

    for (const clipSpec of args.clips) {
      const fbxBuf = toArrayBuffer(readFileSync(clipSpec.fbx));
      const fbxGroup = loadFbxFromBuffer(fbxBuf);
      const sourceMesh = findFirstSkinnedMesh(fbxGroup);
      const sourceSkeleton = sourceMesh ? sourceMesh.skeleton : buildSkeletonFromFbxGroup(fbxGroup);
      if (!sourceSkeleton) throw new Error(`No Skeleton/Bones found in FBX: ${clipSpec.fbx}`);

      const sourceClips = fbxGroup.animations ?? [];
      if (!sourceClips.length) throw new Error(`No animation clips found in FBX: ${clipSpec.fbx}`);

      // Prefer the clip with the most tracks.
      const sourceClip = [...sourceClips].sort((a, b) => b.tracks.length - a.tracks.length)[0];
      const renamedSource = sourceClip.clone();
      renamedSource.name = clipSpec.name;

      const converted = retargetClip(targetMesh, sourceSkeleton, renamedSource, {
        names: namesMap,
        hip: sourceHipName,
        hipInfluence: new Vector3(1, 1, 1),
        preserveBoneMatrix: true,
        preserveBonePositions: true,
        useTargetMatrix: false,
      });

      // Ensure deterministic naming.
      const fixed = fixHipsRotationToRest(converted, baseHipsRotation, args.debug ? clipSpec.name : null);
      const finalClip = new AnimationClip(clipSpec.name, fixed.duration, fixed.tracks);
      if (args.debug) {
        const hipsTrack = finalClip.tracks.find((t) => /hips/i.test(t.name) && /quaternion$/i.test(t.name));
        if (hipsTrack) {
          // eslint-disable-next-line no-console
          console.info(`[${clipSpec.name}] hips track:`, hipsTrack.name);
          // eslint-disable-next-line no-console
          console.info(`[${clipSpec.name}] hips quat0:`, Array.from(hipsTrack.values.slice(0, 4)));
        } else {
          // eslint-disable-next-line no-console
          console.warn(`[${clipSpec.name}] hips quaternion track not found.`);
          // eslint-disable-next-line no-console
          console.info(`[${clipSpec.name}] sample track names:`, finalClip.tracks.slice(0, 12).map((t) => t.name));
        }
      }

      // Persist into the base GLB.
      addThreeClipToGltfDoc({
        doc: baseDoc,
        clip: finalClip,
        nodeLookup,
        inPlaceRoot: args.inPlaceRoot,
      });

      if (args.debug) {
        // eslint-disable-next-line no-console
        console.log(`Retargeted "${clipSpec.name}" from FBX "${path.basename(clipSpec.fbx)}" (tracks=${finalClip.tracks.length})`);
      }
    }

    const outDir = path.dirname(args.out);
    mkdirSync(outDir, { recursive: true });
    const outTemp = path.join(outDir, `.tmp.${path.basename(args.out)}.${Date.now()}.glb`);
    await io.write(outTemp, baseDoc);
    renameSync(outTemp, args.out);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

await main();
