import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { GroupRenderer } from '../GroupRenderer';
import type { DiagramGroupState } from '../../types';
import { Text } from 'troika-three-text';
import { GroupInteractionRegistry } from '../GroupInteractionRegistry';

const makeGroup = (overrides: Partial<DiagramGroupState> = {}): DiagramGroupState => ({
  id: 'g1',
  label: 'Group',
  variant: 'boundary',
  orientation: 'vertical',
  bounds: { x: 0, y: 0, w: 4, h: 2, padding: [1, 1, 1, 1], titleGap: 0.5 },
  color: '#333333',
  borderColor: '#ffffff',
  borderWidth: 1.5,
  borderHeight: 1,
  borderStyle: 'solid',
  fillOpacity: 0.2,
  borderOpacity: 0.8,
  ...overrides,
});

describe('GroupRenderer', () => {
  let renderer: GroupRenderer;
  let registry: GroupInteractionRegistry;
  let parent: THREE.Group;

  beforeEach(() => {
    vi.spyOn(Text.prototype, 'sync').mockImplementation(() => undefined);
    registry = new GroupInteractionRegistry();
    renderer = new GroupRenderer(registry);
    parent = new THREE.Group();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getOrCreate adds group to parent', () => {
    renderer.getOrCreate(makeGroup(), 'd1', parent);
    expect(parent.children.length).toBe(1);
  });

  it('dispose removes group from parent', () => {
    renderer.getOrCreate(makeGroup(), 'd1', parent);
    renderer.dispose('g1', 'd1', parent);
    expect(parent.children.length).toBe(0);
  });

  it('disposeAllForDiagram removes all diagram groups', () => {
    renderer.getOrCreate(makeGroup({ id: 'g1' }), 'd1', parent);
    renderer.getOrCreate(makeGroup({ id: 'g2' }), 'd1', parent);
    renderer.disposeAllForDiagram('d1', parent);
    expect(parent.children.length).toBe(0);
  });

  it('updates geometry when bounds change', () => {
    const entry = renderer.getOrCreate(makeGroup(), 'd1', parent);
    const before = entry.fill.geometry;
    renderer.getOrCreate(makeGroup({ bounds: { x: 0, y: 0, w: 6, h: 3, padding: [1, 1, 1, 1], titleGap: 0.5 } }), 'd1', parent);
    expect(entry.fill.geometry).not.toBe(before);
  });

  it('switches border material between solid and dashed', () => {
    const entry = renderer.getOrCreate(makeGroup({ borderStyle: 'solid' }), 'd1', parent);
    expect(entry.border).toBeDefined();
    expect(entry.border?.children.length).toBe(2);
    renderer.getOrCreate(makeGroup({ borderStyle: 'dashed' }), 'd1', parent);
    expect(entry.border).toBeDefined();
    expect(entry.border?.children.length).toBe(2);
  });

  it('omits border when borderStyle is none', () => {
    const entry = renderer.getOrCreate(makeGroup({ borderStyle: 'none' }), 'd1', parent);
    expect(entry.border).toBeUndefined();
  });

  it('applies group borderWidth to border material', () => {
    const base = renderer.getOrCreate(makeGroup({ borderWidth: 1.0 }), 'd1', parent);
    const wide = renderer.getOrCreate(makeGroup({ id: 'g2', borderWidth: 2.25 }), 'd1', parent);
    const baseMesh = base.border?.children[0] as THREE.Mesh;
    const wideMesh = wide.border?.children[0] as THREE.Mesh;
    const baseGeom = baseMesh.geometry as THREE.ExtrudeGeometry;
    const wideGeom = wideMesh.geometry as THREE.ExtrudeGeometry;
    baseGeom.computeBoundingBox();
    wideGeom.computeBoundingBox();
    const baseWidth = (baseGeom.boundingBox?.max.x ?? 0) - (baseGeom.boundingBox?.min.x ?? 0);
    const wideWidth = (wideGeom.boundingBox?.max.x ?? 0) - (wideGeom.boundingBox?.min.x ?? 0);
    expect(wideWidth).toBeGreaterThan(baseWidth);
  });

  it('applies group borderHeight to border mesh depth', () => {
    const entry = renderer.getOrCreate(makeGroup({ borderHeight: 1.75 }), 'd1', parent);
    expect(entry.border).toBeDefined();
    const ring = entry.border?.children[0] as THREE.Mesh;
    const box = new THREE.Box3().setFromObject(ring);
    const size = new THREE.Vector3();
    box.getSize(size);
    expect(size.z).toBeCloseTo(1.75, 3);
  });

  it('positions the title in the top padding band above group content', () => {
    const state = makeGroup({
      bounds: { x: 0, y: 0, w: 20, h: 12, padding: [2, 1, 1, 1], titleGap: 0.75 },
    });
    renderer.getOrCreate(state, 'd1', parent);
    const entry = renderer.getOrCreate(state, 'd1', parent);

    const contentTopY = state.bounds.h / 2 - state.bounds.padding[0];
    expect(entry.label.position.y).toBeGreaterThan(contentTopY);
  });
});
