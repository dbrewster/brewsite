// Three.js geometry factory for diagram node shapes.
// Three.js only — no React, no compiler imports.

import * as THREE from 'three';
import type { DiagramShapeVariant } from './shapeVariants';

export type ShapeGeometrySpec = {
  geometry: THREE.BufferGeometry;
  rotation?: THREE.Euler;
  /**
   * Number of material groups in the geometry.
   * 6 = BoxGeometry (right/left/top/bottom/front/back)
   * 2 = ExtrudeGeometry rounded box (caps group 0 = front+back, sides group 1 = walls)
   */
  materialCount: 2 | 6;
};

const applyScaleZ = (geometry: THREE.BufferGeometry, scale: number): void => {
  geometry.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, scale));
};

/**
 * Creates a THREE.Shape path for a rounded rectangle centered at the origin.
 * Used for both ExtrudeGeometry (rounded boxes) and LineLoop border outlines.
 * cornerRadius is clamped to at most 49.9% of half-width/height to prevent collapse.
 */
export function createRoundedRectShape(w: number, h: number, cornerRadius: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(Math.abs(cornerRadius), hw * 0.499, hh * 0.499);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

/**
 * Creates a BufferGeometry for a rounded rectangle LineLoop outline.
 * Points lie at Z = depth/2 + 0.005 so the outline sits just in front of the node face.
 */
export function createRoundedBorderGeometry(
  w: number,
  h: number,
  depth: number,
  cornerRadius: number,
): THREE.BufferGeometry {
  const shape = createRoundedRectShape(w, h, cornerRadius);
  const pts2d = shape.getPoints(48);
  const z = depth / 2 + 0.005;
  const points3d = pts2d.map((p) => new THREE.Vector3(p.x, p.y, z));
  // Close the loop explicitly — LineLoop also closes implicitly, but an extra
  // identical final point avoids a visual gap at the seam on some drivers.
  points3d.push(new THREE.Vector3(pts2d[0].x, pts2d[0].y, z));
  return new THREE.BufferGeometry().setFromPoints(points3d);
}

export function createShapeGeometry(
  shape: DiagramShapeVariant,
  size: readonly [number, number],
  depth: number,
  cornerRadius = 0,
): ShapeGeometrySpec {
  const [width, height] = size;

  switch (shape) {
    case 'flow:diamond': {
      const geometry = new THREE.BoxGeometry(width, height, depth);
      geometry.rotateZ(Math.PI / 4);
      return { geometry, materialCount: 6 };
    }
    case 'flow:cylinder':
    case 'flow:queue': {
      const radius = width / 2;
      const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      applyScaleZ(geometry, Math.max(0.01, depth / Math.max(0.01, width)));
      return { geometry, materialCount: 6 };
    }
    case 'flow:cylinder-stack': {
      const radius = width / 2;
      const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      applyScaleZ(geometry, Math.max(0.01, depth / Math.max(0.01, width)));
      return { geometry, materialCount: 6 };
    }
    case 'flow:oval': {
      const geometry = new THREE.SphereGeometry(0.5, 24, 16);
      geometry.scale(width, height, depth);
      return { geometry, materialCount: 6 };
    }
    case 'flow:hexagon': {
      const radius = width / 2;
      const geometry = new THREE.CylinderGeometry(radius, radius, height, 6);
      applyScaleZ(geometry, Math.max(0.01, depth / Math.max(0.01, width)));
      return { geometry, materialCount: 6 };
    }
    default: {
      if (cornerRadius > 0) {
        // Rounded rectangle via ExtrudeGeometry.
        // ExtrudeGeometry group indices: 0 = caps (front+back), 1 = side walls.
        const roundedShape = createRoundedRectShape(width, height, cornerRadius);
        const extrudeGeo = new THREE.ExtrudeGeometry(roundedShape, {
          depth,
          bevelEnabled: false,
        });
        // ExtrudeGeometry extrudes from Z=0 to Z=depth; center along Z axis.
        extrudeGeo.translate(0, 0, -depth / 2);
        return { geometry: extrudeGeo, materialCount: 2 };
      }
      const geometry = new THREE.BoxGeometry(width, height, depth);
      return { geometry, materialCount: 6 };
    }
  }
}
