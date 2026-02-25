// Three.js geometry factory for diagram node shapes.
// Three.js only — no React, no compiler imports.

import * as THREE from 'three';
import type { DiagramShapeVariant } from './shapeVariants';

export type ShapeGeometrySpec = {
  geometry: THREE.BufferGeometry;
  rotation?: THREE.Euler;
};

const applyScaleZ = (geometry: THREE.BufferGeometry, scale: number): void => {
  geometry.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, scale));
};

export function createShapeGeometry(
  shape: DiagramShapeVariant,
  size: readonly [number, number],
  depth: number,
): ShapeGeometrySpec {
  const [width, height] = size;

  switch (shape) {
    case 'flow:diamond': {
      const geometry = new THREE.BoxGeometry(width, height, depth);
      geometry.rotateZ(Math.PI / 4);
      return { geometry };
    }
    case 'flow:cylinder':
    case 'flow:queue': {
      const radius = width / 2;
      const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      applyScaleZ(geometry, Math.max(0.01, depth / Math.max(0.01, width)));
      return { geometry };
    }
    case 'flow:cylinder-stack': {
      const radius = width / 2;
      const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      applyScaleZ(geometry, Math.max(0.01, depth / Math.max(0.01, width)));
      return { geometry };
    }
    case 'flow:oval': {
      const geometry = new THREE.SphereGeometry(0.5, 24, 16);
      geometry.scale(width, height, depth);
      return { geometry };
    }
    case 'flow:hexagon': {
      const radius = width / 2;
      const geometry = new THREE.CylinderGeometry(radius, radius, height, 6);
      applyScaleZ(geometry, Math.max(0.01, depth / Math.max(0.01, width)));
      return { geometry };
    }
    default: {
      const geometry = new THREE.BoxGeometry(width, height, depth);
      return { geometry };
    }
  }
}
