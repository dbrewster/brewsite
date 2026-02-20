#!/usr/bin/env node
/**
 * Convert an FBX animation to a GLB, resample/prune/quantize, then
 * remap CC_Base bones to Mixamo naming and prune non-mixamo tracks.
 *
 * Usage:
 *   node scripts/convert_fbx_motion_to_mixamo_glb.mjs --input path/to/clip.fbx --output path/to/clip.mixamo.glb
 *   node scripts/convert_fbx_motion_to_mixamo_glb.mjs --input path/to/clip.fbx --output path/to/clip.mixamo.glb --fps 24
 *   node scripts/convert_fbx_motion_to_mixamo_glb.mjs --input path/to/clip.fbx --output path/to/clip.mixamo.glb --no-quantize
 *   node scripts/convert_fbx_motion_to_mixamo_glb.mjs --input path/to/clip.fbx --output path/to/clip.mixamo.glb --keep-root
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, quantize, resample } from '@gltf-transform/functions';

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const args = {
    input: undefined,
    output: undefined,
    fps: 30,
    resample: true,
    prune: true,
    quantize: true,
    keepRoot: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;
    if (token === '--input') {
      args.input = argv[++i];
      continue;
    }
    if (token === '--output') {
      args.output = argv[++i];
      continue;
    }
    if (token === '--fps') {
      const next = argv[++i];
      const parsed = Number.parseInt(next ?? '', 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --fps value: ${next}`);
      }
      args.fps = parsed;
      continue;
    }
    if (token === '--no-resample') {
      args.resample = false;
      continue;
    }
    if (token === '--no-prune') {
      args.prune = false;
      continue;
    }
    if (token === '--no-quantize') {
      args.quantize = false;
      continue;
    }
    if (token === '--keep-root') {
      args.keepRoot = true;
      continue;
    }
    if (token === '-h' || token === '--help') {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!args.input) throw new Error('Missing required --input path.');
  if (!args.output) throw new Error('Missing required --output path.');
  return args;
}

function printUsage() {
  // eslint-disable-next-line no-console
  console.log(`
Convert an FBX animation to a GLB and optimize it (resample + prune + quantize),
then remap CC_Base bones to Mixamo names and prune non-mixamo tracks.

Defaults:
  fps: 30

Usage:
  node scripts/convert_fbx_motion_to_mixamo_glb.mjs --input path/to/clip.fbx --output path/to/clip.mixamo.glb
  node scripts/convert_fbx_motion_to_mixamo_glb.mjs --input path/to/clip.fbx --output path/to/clip.mixamo.glb --fps 24
  node scripts/convert_fbx_motion_to_mixamo_glb.mjs --input path/to/clip.fbx --output path/to/clip.mixamo.glb --no-quantize
  node scripts/convert_fbx_motion_to_mixamo_glb.mjs --input path/to/clip.fbx --output path/to/clip.mixamo.glb --keep-root
`);
}

const MODEL_BONE_TYPES = new Set([
  'Head',
  'HeadTop_End',
  'Hips',
  'LeftArm',
  'LeftFoot',
  'LeftForeArm',
  'LeftHand',
  'LeftHandIndex1',
  'LeftHandIndex2',
  'LeftHandIndex3',
  'LeftHandIndex4',
  'LeftHandMiddle1',
  'LeftHandMiddle2',
  'LeftHandMiddle3',
  'LeftHandMiddle4',
  'LeftHandPinky1',
  'LeftHandPinky2',
  'LeftHandPinky3',
  'LeftHandPinky4',
  'LeftHandRing1',
  'LeftHandRing2',
  'LeftHandRing3',
  'LeftHandRing4',
  'LeftHandThumb1',
  'LeftHandThumb2',
  'LeftHandThumb3',
  'LeftHandThumb4',
  'LeftLeg',
  'LeftShoulder',
  'LeftToeBase',
  'LeftToe_End',
  'LeftUpLeg',
  'Neck',
  'RightArm',
  'RightFoot',
  'RightForeArm',
  'RightHand',
  'RightHandIndex1',
  'RightHandIndex2',
  'RightHandIndex3',
  'RightHandIndex4',
  'RightHandMiddle1',
  'RightHandMiddle2',
  'RightHandMiddle3',
  'RightHandMiddle4',
  'RightHandPinky1',
  'RightHandPinky2',
  'RightHandPinky3',
  'RightHandPinky4',
  'RightHandRing1',
  'RightHandRing2',
  'RightHandRing3',
  'RightHandRing4',
  'RightHandThumb1',
  'RightHandThumb2',
  'RightHandThumb3',
  'RightHandThumb4',
  'RightLeg',
  'RightShoulder',
  'RightToeBase',
  'RightToe_End',
  'RightUpLeg',
  'Spine',
  'Spine1',
  'Spine2',
]);

function stripNamespace(name) {
  const idx = name.lastIndexOf(':');
  return idx >= 0 ? name.slice(idx + 1) : name;
}

function mapCcToMixamo(name) {
  if (!name) return null;
  const raw = stripNamespace(name);
  if (raw.startsWith('mixamorig')) return raw;

  let n = raw;
  if (n.startsWith('CC_Base_')) n = n.slice('CC_Base_'.length);

  let side = '';
  if (n.startsWith('R_')) {
    side = 'Right';
    n = n.slice(2);
  } else if (n.startsWith('L_')) {
    side = 'Left';
    n = n.slice(2);
  }

  let mapped = null;
  switch (n) {
    case 'Hips':
    case 'Hip':
    case 'Pelvis':
      mapped = 'Hips';
      break;
    case 'Spine':
      mapped = 'Spine';
      break;
    case 'Spine01':
      mapped = 'Spine1';
      break;
    case 'Spine02':
      mapped = 'Spine2';
      break;
    case 'Neck':
      mapped = 'Neck';
      break;
    case 'Head':
      mapped = 'Head';
      break;
    case 'HeadTop_End':
      mapped = 'HeadTop_End';
      break;
    case 'Clavicle':
      mapped = side ? `${side}Shoulder` : null;
      break;
    case 'Upperarm':
      mapped = side ? `${side}Arm` : null;
      break;
    case 'Forearm':
      mapped = side ? `${side}ForeArm` : null;
      break;
    case 'Hand':
      mapped = side ? `${side}Hand` : null;
      break;
    case 'Thigh':
      mapped = side ? `${side}UpLeg` : null;
      break;
    case 'Calf':
      mapped = side ? `${side}Leg` : null;
      break;
    case 'Foot':
      mapped = side ? `${side}Foot` : null;
      break;
    case 'ToeBase':
      mapped = side ? `${side}ToeBase` : null;
      break;
    default:
      break;
  }

  if (!mapped) {
    const fingerMatch = n.match(/^(Thumb|Index|Middle|Ring|Pinky)(\\d)$/);
    if (fingerMatch && side) {
      mapped = `${side}Hand${fingerMatch[1]}${fingerMatch[2]}`;
    }
  }

  if (!mapped) return null;
  if (!MODEL_BONE_TYPES.has(mapped)) return null;
  return `mixamorig${mapped}`;
}

async function resolveFbx2GltfPath() {
  const platform = process.platform === 'darwin' ? 'Darwin' : process.platform === 'linux' ? 'Linux' : null;
  if (!platform) {
    throw new Error(`Unsupported platform for FBX2glTF: ${process.platform}`);
  }
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(scriptDir, '..');
  const fbxPath = path.join(rootDir, 'node_modules', 'fbx2gltf', 'bin', platform, 'FBX2glTF');
  await fs.access(fbxPath);
  return fbxPath;
}

async function convertFbxToGlb({ input, outputBase, fps, tmpDir }) {
  const fbx2gltf = await resolveFbx2GltfPath();
  await execFileAsync(fbx2gltf, [
    '--binary',
    '--anim-framerate',
    `bake${fps}`,
    '--fbx-temp-dir',
    tmpDir,
    '--output',
    outputBase,
    '--input',
    input,
  ]);
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  await fs.access(inputPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fbx-anim.'));
  const base = path.join(tmpDir, 'anim');
  const rawGlb = `${base}.glb`;

  try {
    await convertFbxToGlb({ input: inputPath, outputBase: base, fps: args.fps, tmpDir });
    await fs.access(rawGlb);

    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read(rawGlb);

    const transforms = [];
    if (args.resample) transforms.push(resample());
    if (args.prune) transforms.push(prune());
    if (args.quantize) {
      const meshCount = doc.getRoot().listMeshes().length;
      if (meshCount > 0) {
        transforms.push(quantize({ quantizationVolume: 'scene' }));
      } else {
        // eslint-disable-next-line no-console
        console.log('Skipping quantize: no meshes detected in animation-only GLB.');
      }
    }
    if (transforms.length > 0) {
      await doc.transform(...transforms);
    }

    const root = doc.getRoot();
    const nodes = root.listNodes();
    let renamedCount = 0;
    for (const node of nodes) {
      const name = node.getName();
      if (!name) continue;
      const mapped = mapCcToMixamo(name);
      if (!mapped || mapped === name) continue;
      node.setName(mapped);
      renamedCount += 1;
    }

    let removed = 0;
    let kept = 0;
    for (const animation of root.listAnimations()) {
      for (const channel of [...animation.listChannels()]) {
        const target = channel.getTargetNode();
        const name = target?.getName() ?? '';
        if (!name.startsWith('mixamorig')) {
          animation.removeChannel(channel);
          removed += 1;
          continue;
        }
        const pathKey = channel.getTargetPath();
        if (!args.keepRoot && name === 'mixamorigHips' && (pathKey === 'translation' || pathKey === 'rotation')) {
          animation.removeChannel(channel);
          removed += 1;
          continue;
        }
        kept += 1;
      }
    }

    await io.write(outputPath, doc);
    // eslint-disable-next-line no-console
    console.log(`Remapped ${renamedCount} nodes. Pruned channels. kept=${kept} removed=${removed}`);
    // eslint-disable-next-line no-console
    console.log(`Wrote ${outputPath}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

await main();
