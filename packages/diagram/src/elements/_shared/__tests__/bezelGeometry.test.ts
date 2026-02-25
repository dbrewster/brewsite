import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBezel } from '../bezelGeometry';

describe('createBezel', () => {
  it('returns empty group for none', () => {
    const group = createBezel('none', 10, 6, 0.3);
    expect(group.children.length).toBe(0);
  });

  it('creates four strips for dark variant', () => {
    const group = createBezel('dark', 10, 6, 0.3);
    expect(group.children.length).toBe(4);
    group.children.forEach((child) => {
      expect(child).toBeInstanceOf(THREE.Mesh);
    });
  });

  it('uses reduced thickness for thin', () => {
    const group = createBezel('thin', 10, 6, 0.5);
    const top = group.children[0] as THREE.Mesh;
    const geom = top.geometry as THREE.BoxGeometry;
    const params = geom.parameters as { height?: number };
    expect(params.height).toBeCloseTo(0.5 * 0.4, 4);
  });
});
