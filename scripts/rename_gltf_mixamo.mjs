#!/usr/bin/env node
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { NodeIO } = require('@gltf-transform/core');
const {
  KHRTextureBasisu,
  KHRDracoMeshCompression,
  KHRTextureTransform,
} = require('@gltf-transform/extensions');

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/rename_gltf_mixamo.mjs <input.glb> <output.glb>');
  process.exit(1);
}

const io = new NodeIO().registerExtensions([
  KHRTextureBasisu,
  KHRDracoMeshCompression,
  KHRTextureTransform,
]);

const doc = await io.read(inputPath);
const root = doc.getRoot();

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
