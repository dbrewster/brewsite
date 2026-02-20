import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

if (!globalThis.window) {
  globalThis.window = {
    URL: {
      createObjectURL: () => 'blob://fbx',
      revokeObjectURL: () => {},
    },
  };
}

if (!globalThis.document) {
  globalThis.document = {
    createElementNS: () => ({
      addEventListener: () => {},
      removeEventListener: () => {},
      setAttribute: () => {},
    }),
  };
}

THREE.ImageLoader.prototype.load = function load(_url, onLoad) {
  const image = { width: 0, height: 0 };
  if (onLoad) setTimeout(() => onLoad(image), 0);
  return image;
};

THREE.TextureLoader.prototype.load = function load(_url, onLoad) {
  const texture = new THREE.Texture();
  if (onLoad) setTimeout(() => onLoad(texture), 0);
  return texture;
};

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/inspect-fbx.mjs <path-to-fbx>');
  process.exit(1);
}

const buffer = await fs.readFile(input);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new FBXLoader();
const scene = loader.parse(arrayBuffer, path.dirname(input));

const nodeNames = new Set();
const meshNames = new Set();
const materialNames = new Set();

scene.traverse((obj) => {
  if (obj.name) nodeNames.add(obj.name);
  if (obj.isMesh) {
    if (obj.geometry?.name) meshNames.add(obj.geometry.name);
    if (obj.name) meshNames.add(obj.name);
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if (!mat) return;
      if (mat.name) materialNames.add(mat.name);
    });
  }
});

const list = (label, items) => {
  console.log(`${label}:`);
  [...items].sort().forEach((name) => console.log(`- ${name}`));
  console.log('');
};

list('Node names', nodeNames);
list('Mesh names', meshNames);
list('Material names', materialNames);

const materialProps = {};
scene.traverse((obj) => {
  if (!obj.isMesh) return;
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  mats.forEach((mat) => {
    if (!mat) return;
    const name = mat.name || 'unnamed';
    if (!materialProps[name]) {
      materialProps[name] = {
        type: mat.type,
        maps: {
          map: !!mat.map,
          emissiveMap: !!mat.emissiveMap,
          normalMap: !!mat.normalMap,
          roughnessMap: !!mat.roughnessMap,
          metalnessMap: !!mat.metalnessMap,
          aoMap: !!mat.aoMap,
          alphaMap: !!mat.alphaMap,
        },
      };
    }
  });
});

console.log('Material map support:');
for (const [name, info] of Object.entries(materialProps)) {
  console.log(`- ${name} (${info.type})`);
  Object.entries(info.maps).forEach(([key, value]) => {
    if (value) console.log(`  - ${key}`);
  });
}
