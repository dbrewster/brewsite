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

if (target === 'cc_base') {
  let renamedNodes = 0;
  for (const node of root.listNodes()) {
    const name = node.getName();
    if (!name || !/^mixamorig/i.test(name)) continue;
    const mapped = mapMixamoToCcBase(name);
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
