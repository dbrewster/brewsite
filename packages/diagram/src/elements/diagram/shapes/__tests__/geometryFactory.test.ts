import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createShapeGeometry } from '../geometryFactory';

describe('createShapeGeometry', () => {
  it('returns BoxGeometry for default flow:rect', () => {
    const { geometry } = createShapeGeometry('flow:rect', [4, 2], 0.4);
    expect(geometry).toBeInstanceOf(THREE.BoxGeometry);
  });

  it('returns rotated BoxGeometry for flow:diamond', () => {
    const { geometry } = createShapeGeometry('flow:diamond', [4, 2], 0.4);
    expect(geometry).toBeInstanceOf(THREE.BoxGeometry);
    const bbox = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position'));
    expect(bbox.getSize(new THREE.Vector3()).x).toBeGreaterThan(2);
  });

  it('returns CylinderGeometry for flow:cylinder', () => {
    const { geometry } = createShapeGeometry('flow:cylinder', [4, 2], 0.4);
    expect(geometry).toBeInstanceOf(THREE.CylinderGeometry);
  });

  it('returns SphereGeometry for flow:oval', () => {
    const { geometry } = createShapeGeometry('flow:oval', [4, 2], 0.4);
    expect(geometry).toBeInstanceOf(THREE.SphereGeometry);
  });

  it('returns CylinderGeometry for flow:hexagon', () => {
    const { geometry } = createShapeGeometry('flow:hexagon', [4, 2], 0.4);
    expect(geometry).toBeInstanceOf(THREE.CylinderGeometry);
  });
});
