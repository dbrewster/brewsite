import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createBezel, disposeBezel } from '../bezelGeometry';

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

describe('disposeBezel', () => {
  it('calls dispose on every mesh geometry and material', () => {
    const group = createBezel('chrome', 8, 5, 0.3);
    const meshes = group.children as THREE.Mesh[];

    // createBezel shares geometry instances between top/bottom and left/right
    // pairs, so a geometry spy may be called more than once (both are correct
    // — Three.js dispose() on an already-disposed geometry is a no-op).
    // We assert called *at least once* per mesh.
    const geomSpies = meshes.map((m) => vi.spyOn(m.geometry, 'dispose'));
    const matSpies = meshes.map((m) =>
      vi.spyOn(m.material as THREE.Material, 'dispose'),
    );

    disposeBezel(group);

    geomSpies.forEach((spy) => expect(spy).toHaveBeenCalled());
    // Each mesh has its own cloned material (cloneMaterial in createBezel),
    // so each material spy should be called exactly once.
    matSpies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
  });

  it('is a no-op for an empty group (variant none)', () => {
    const group = createBezel('none', 8, 5, 0.3);
    // Should not throw even though there are no children.
    expect(() => disposeBezel(group)).not.toThrow();
  });
});
