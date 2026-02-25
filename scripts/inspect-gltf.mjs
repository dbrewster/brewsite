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
const materials = root.listMaterials();
const textures = root.listTextures();
const animations = root.listAnimations();

const meshNames = meshes.map((mesh) => mesh.getName()).filter(Boolean).sort();
const nodeNames = nodes.map((node) => node.getName()).filter(Boolean).sort();
const materialNames = materials.map((mat) => mat.getName()).filter(Boolean).sort();
const textureNames = textures.map((tex) => tex.getName()).filter(Boolean).sort();
const animationNames = animations.map((anim) => anim.getName()).filter(Boolean).sort();

console.log('Mesh names:');
meshNames.forEach((name) => console.log(`- ${name}`));

console.log('\nNode names:');
nodeNames.forEach((name) => console.log(`- ${name}`));

console.log('\nMaterial names:');
if (!materialNames.length) {
  console.log('- (none)');
} else {
  materialNames.forEach((name) => console.log(`- ${name}`));
}

console.log('\nTexture names:');
if (!textureNames.length) {
  console.log('- (none)');
} else {
  textureNames.forEach((name) => console.log(`- ${name}`));
}

console.log('\nAnimation names:');
if (!animationNames.length) {
  console.log('- (none)');
} else {
  animationNames.forEach((name) => console.log(`- ${name}`));
}

console.log('\nMaterial map support:');
if (!materials.length) {
  console.log('- (none)');
} else {
  materials.forEach((material) => {
    const name = material.getName() || '(unnamed)';
    const maps = [];
    if (material.getBaseColorTexture?.()) maps.push('baseColorTexture');
    if (material.getMetallicRoughnessTexture?.()) maps.push('metallicRoughnessTexture');
    if (material.getNormalTexture?.()) maps.push('normalTexture');
    if (material.getOcclusionTexture?.()) maps.push('occlusionTexture');
    if (material.getEmissiveTexture?.()) maps.push('emissiveTexture');
    const alphaMode = material.getAlphaMode?.();
    const metalness = material.getMetallicFactor?.();
    const roughness = material.getRoughnessFactor?.();
    console.log(`- ${name}`);
    if (alphaMode) console.log(`  - alphaMode: ${alphaMode}`);
    if (typeof metalness === 'number') console.log(`  - metalness: ${metalness}`);
    if (typeof roughness === 'number') console.log(`  - roughness: ${roughness}`);
    maps.forEach((map) => console.log(`  - ${map}`));
  });
}
