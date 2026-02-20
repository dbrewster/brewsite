import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization, KHRTextureBasisu, KHRTextureTransform } from '@gltf-transform/extensions';
import path from 'node:path';
import process from 'node:process';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/inspect-gltf.mjs <path-to-glb>');
  process.exit(1);
}

const io = new NodeIO().registerExtensions([KHRMeshQuantization, KHRTextureBasisu, KHRTextureTransform]);
const document = await io.read(input);
const root = document.getRoot();

const meshes = root.listMeshes();
const nodes = root.listNodes();

const meshNames = meshes.map((mesh) => mesh.getName()).filter(Boolean).sort();
const nodeNames = nodes.map((node) => node.getName()).filter(Boolean).sort();

console.log('Mesh names:');
meshNames.forEach((name) => console.log(`- ${name}`));

console.log('\nNode names:');
nodeNames.forEach((name) => console.log(`- ${name}`));
