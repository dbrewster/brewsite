#!/usr/bin/env node
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { NodeIO } = require('@gltf-transform/core');
const {
  KHRTextureBasisu,
  KHRDracoMeshCompression,
  KHRTextureTransform,
} = require('@gltf-transform/extensions');

const [, , inputPath, outputPath, ...rest] = process.argv;

let target = 'mixamo';
for (let i = 0; i < rest.length; i += 1) {
  const token = rest[i];
  if (token === '--target') {
    target = rest[i + 1] ?? '';
    i += 1;
  }
}

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/rename_gltf_mixamo.mjs <input.glb> <output.glb> [--target mixamo|cc_base]');
  process.exit(1);
}

const io = new NodeIO().registerExtensions([
  KHRTextureBasisu,
  KHRDracoMeshCompression,
  KHRTextureTransform,
]);

const doc = await io.read(inputPath);
const root = doc.getRoot();

if (target !== 'mixamo' && target !== 'cc_base') {
  console.error(`Unknown --target "${target}". Expected "mixamo" or "cc_base".`);
  process.exit(1);
}

const stripNamespace = (name) => {
  if (!name) return name;
  const idx = name.lastIndexOf(':');
  return idx >= 0 ? name.slice(idx + 1) : name;
};

const stripMixamoPrefix = (name) => {
  if (!name) return name;
  return name.replace(/^mixamorig:?/i, '');
};

const normalizeToken = (name) => {
  if (!name) return '';
  return stripNamespace(name).trim();
};

const parseSideSuffix = (name) => {
  const lower = name.toLowerCase();
  const match = lower.match(/^(.*?)([._-])(l|r)$/);
  if (!match) return null;
  return {
    base: match[1],
    side: match[3] === 'l' ? 'L' : 'R',
  };
};

const mapMixamoToCcBase = (name) => {
  if (!name) return null;
  const raw = stripMixamoPrefix(stripNamespace(name));
  const lower = raw.toLowerCase();

  const table = {
    hips: 'CC_Base_Hip',
    pelvis: 'CC_Base_Pelvis',
    spine: 'CC_Base_Waist',
    spine1: 'CC_Base_Spine01',
    spine2: 'CC_Base_Spine02',
    neck: 'CC_Base_NeckTwist02',
    head: 'CC_Base_Head',
    leftshoulder: 'CC_Base_L_Clavicle',
    leftarm: 'CC_Base_L_Upperarm',
    leftforearm: 'CC_Base_L_Forearm',
    lefthand: 'CC_Base_L_Hand',
    leftupleg: 'CC_Base_L_Thigh',
    leftleg: 'CC_Base_L_Calf',
    leftfoot: 'CC_Base_L_Foot',
    lefttoebase: 'CC_Base_L_ToeBase',
    rightshoulder: 'CC_Base_R_Clavicle',
    rightarm: 'CC_Base_R_Upperarm',
    rightforearm: 'CC_Base_R_Forearm',
    righthand: 'CC_Base_R_Hand',
    rightupleg: 'CC_Base_R_Thigh',
    rightleg: 'CC_Base_R_Calf',
    rightfoot: 'CC_Base_R_Foot',
    righttoebase: 'CC_Base_R_ToeBase',
  };

  if (table[lower]) return table[lower];

  const fingerMatch = raw.match(/^(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky)(\d)$/i);
  if (fingerMatch) {
    const side = fingerMatch[1].toLowerCase() === 'left' ? 'L' : 'R';
    const finger = fingerMatch[2].toLowerCase();
    const idx = fingerMatch[3];
    // CC_Base uses 3 joints; skip 4 to avoid duplicate names.
    if (idx === '4') return null;
    const fingerMap = {
      thumb: 'Thumb',
      index: 'Index',
      middle: 'Mid',
      ring: 'Ring',
      pinky: 'Pinky',
    };
    const ccFinger = fingerMap[finger];
    return ccFinger ? `CC_Base_${side}_${ccFinger}${idx}` : null;
  }

  return null;
};

const mapRoboZeroToCcBase = (name) => {
  const raw = normalizeToken(name);
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const sideInfo = parseSideSuffix(lower);
  const base = sideInfo ? sideInfo.base : lower;
  const side = sideInfo ? sideInfo.side : null;

  if (base.endsWith('_base') || base.includes('stretch')) return null;

  if (base === 'root' || base === 'root.x') return 'CC_Base_Hip';
  if (base === 'spine_01' || base === 'spine_01.x') return 'CC_Base_Waist';
  if (base === 'neck' || base === 'neck.x') return 'CC_Base_NeckTwist02';
  if (base === 'head' || base === 'head.x') return 'CC_Base_Head';

  if (!side) return null;

  const sideMap = {
    shoulder: 'CC_Base_{SIDE}_Clavicle',
    arm_twist: 'CC_Base_{SIDE}_Upperarm',
    forearm_twist: 'CC_Base_{SIDE}_Forearm',
    hand: 'CC_Base_{SIDE}_Hand',
    thigh_twist: 'CC_Base_{SIDE}_Thigh',
    leg_twist: 'CC_Base_{SIDE}_Calf',
    foot: 'CC_Base_{SIDE}_Foot',
    toes_01: 'CC_Base_{SIDE}_ToeBase',
  };

  if (sideMap[base]) return sideMap[base].replace('{SIDE}', side);

  const fingerMatch = base.match(/^(thumb|index|middle|ring|pinky)(\d)$/);
  if (fingerMatch) {
    const finger = fingerMatch[1];
    const idx = fingerMatch[2];
    const fingerMap = {
      thumb: 'Thumb',
      index: 'Index',
      middle: 'Mid',
      ring: 'Ring',
      pinky: 'Pinky',
    };
    const ccFinger = fingerMap[finger];
    return ccFinger ? `CC_Base_${side}_${ccFinger}${idx}` : null;
  }

  return null;
};

const mapCyborgToCcBase = (name, node) => {
  const raw = normalizeToken(name);
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const base = lower.replace(/\.\d+$/, '');

  if (base === 'hip') return 'CC_Base_Hip';
  if (base === 'waist') return 'CC_Base_Waist';
  if (base === 'chest') return 'CC_Base_Spine02';
  if (base === 'neck') return 'CC_Base_NeckTwist02';
  if (base === 'head') return 'CC_Base_Head';

  const sideMap = {
    shoulder: 'CC_Base_{SIDE}_Clavicle',
    arm: 'CC_Base_{SIDE}_Upperarm',
    forearm: 'CC_Base_{SIDE}_Forearm',
    hand: 'CC_Base_{SIDE}_Hand',
    thigh: 'CC_Base_{SIDE}_Thigh',
    shin: 'CC_Base_{SIDE}_Calf',
    foot: 'CC_Base_{SIDE}_Foot',
  };

  if (!sideMap[base]) return null;
  const x = node?.getWorldTranslation?.()[0] ?? 0;
  if (Math.abs(x) < 1e-5) return null;
  const side = x < 0 ? 'L' : 'R';
  return sideMap[base].replace('{SIDE}', side);
};

if (target === 'cc_base') {
  let renamedNodes = 0;
  for (const node of root.listNodes()) {
    const name = node.getName();
    if (!name) continue;

    let mapped = null;
    if (/^mixamorig/i.test(name)) {
      mapped = mapMixamoToCcBase(name);
    }
    if (!mapped) {
      mapped = mapRoboZeroToCcBase(name);
    }
    if (!mapped) {
      mapped = mapCyborgToCcBase(name, node);
    }

    if (!mapped || mapped === name) continue;
    node.setName(mapped);
    renamedNodes += 1;
  }
  await io.write(outputPath, doc);
  console.log(`Renamed ${renamedNodes} node(s) to CC_Base.`);
  console.log(`Wrote ${outputPath}`);
  process.exit(0);
}

const normalizeMixamoName = (name) => {
  if (!name) return name;
  if (name.startsWith('mixamorig:')) return name;
  if (name.startsWith('mixamorig')) {
    return name.replace(/^mixamorig:?/, 'mixamorig:');
  }
  return name;
};

let renamedNodes = 0;
let renamedMeshes = 0;

for (const node of root.listNodes()) {
  const name = node.getName();
  const normalized = normalizeMixamoName(name);
  if (normalized && normalized !== name) {
    node.setName(normalized);
    renamedNodes += 1;
  }
}

for (const mesh of root.listMeshes()) {
  const name = mesh.getName();
  const normalized = normalizeMixamoName(name);
  if (normalized && normalized !== name) {
    mesh.setName(normalized);
    renamedMeshes += 1;
  }
}

await io.write(outputPath, doc);

console.log(`Renamed ${renamedNodes} node(s), ${renamedMeshes} mesh(es).`);
console.log(`Wrote ${outputPath}`);
