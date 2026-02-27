import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EdgeRenderer } from '../EdgeRenderer';
import { EdgeMaterialFactory } from '../EdgeMaterialFactory';

const makeEdge = (overrides: Partial<{
  id: string;
  controlPoints: ReadonlyArray<readonly [number, number, number]>;
  thickness: number;
  color: string;
  opacity: number;
  style: 'solid' | 'dashed' | 'dotted';
  arrowStart?: string;
  arrowEnd?: string;
}> = {}) => ({
  id: 'e1',
  controlPoints: [[0, 0, 0], [1, 0, 0]] as const,
  thickness: 0.1,
  color: '#ff0000',
  opacity: 1,
  style: 'solid' as const,
  arrowStart: 'none',
  arrowEnd: 'open',
  ...overrides,
});

describe('EdgeRenderer', () => {
  let renderer: EdgeRenderer;
  let parent: THREE.Group;

  beforeEach(() => {
    renderer = new EdgeRenderer(new EdgeMaterialFactory());
    parent = new THREE.Group();
  });

  it('getOrCreate adds group to parent on first call', () => {
    renderer.getOrCreate(makeEdge(), parent);
    expect(parent.children.length).toBe(1);
  });

  it('getOrCreate same id → no duplicate in parent.children', () => {
    renderer.getOrCreate(makeEdge(), parent);
    renderer.getOrCreate(makeEdge(), parent);
    expect(parent.children.length).toBe(1);
  });

  it('controlPoints change → geometry disposed and rebuilt', () => {
    const entry = renderer.getOrCreate(makeEdge(), parent);
    const before = entry.tube.geometry;
    renderer.getOrCreate(makeEdge({ controlPoints: [[0, 0, 0], [2, 0, 0]] }), parent);
    const after = entry.tube.geometry;
    expect(after).not.toBe(before);
  });

  it('color change only → material disposed and rebuilt, geometry unchanged', () => {
    const sharedPoints = [[0, 0, 0], [1, 0, 0]] as const;
    const entry = renderer.getOrCreate(makeEdge({ controlPoints: sharedPoints }), parent);
    const geometryBefore = entry.tube.geometry;
    const materialBefore = entry.tube.material;
    renderer.getOrCreate(makeEdge({ color: '#00ff00', controlPoints: sharedPoints }), parent);
    expect(entry.tube.geometry).toBe(geometryBefore);
    expect(entry.tube.material).not.toBe(materialBefore);
  });

  it('dispose removes group from parent', () => {
    renderer.getOrCreate(makeEdge(), parent);
    renderer.dispose('e1', parent);
    expect(parent.children.length).toBe(0);
  });

  it('disposeAll clears all entries', () => {
    renderer.getOrCreate(makeEdge(), parent);
    renderer.getOrCreate(makeEdge({ id: 'e2' }), parent);
    renderer.disposeAll(parent);
    expect(parent.children.length).toBe(0);
  });

  it('edge with < 2 control points → group.visible = false', () => {
    const entry = renderer.getOrCreate(makeEdge({ controlPoints: [[0, 0, 0]] }), parent);
    expect(entry.group.visible).toBe(false);
  });
});
