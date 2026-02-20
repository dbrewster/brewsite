#!/usr/bin/env node
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { NodeIO } = require('@gltf-transform/core');
const { prune } = require('@gltf-transform/functions');
const {
  KHRTextureBasisu,
  KHRDracoMeshCompression,
  KHRTextureTransform,
} = require('@gltf-transform/extensions');

const [, , inputPath, outputPath, flag] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/strip_normal_maps.mjs <input.glb> <output.glb> [--strip]');
  process.exit(1);
}

const shouldStrip = flag === '--strip';

if (!shouldStrip) {
  const fs = require('node:fs/promises');
  await fs.copyFile(inputPath, outputPath);
  console.log('Normal maps preserved (no --strip flag).');
  console.log(`Wrote ${outputPath}`);
  process.exit(0);
}

const io = new NodeIO().registerExtensions([
  KHRTextureBasisu,
  KHRDracoMeshCompression,
  KHRTextureTransform,
]);
const doc = await io.read(inputPath);

let cleared = 0;
for (const material of doc.getRoot().listMaterials()) {
  if (material.getNormalTexture()) {
    material.setNormalTexture(null);
    cleared += 1;
  }
}

await doc.transform(prune());
await io.write(outputPath, doc);

console.log(`Stripped normal maps from ${cleared} material(s).`);
console.log(`Wrote ${outputPath}`);
