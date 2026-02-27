import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { GroupRenderer } from '../GroupRenderer';
import type { DiagramGroupState } from '../../types';
import { Text } from 'troika-three-text';

const makeGroup = (overrides: Partial<DiagramGroupState> = {}): DiagramGroupState => ({
  id: 'g1',
  label: 'Group',
  variant: 'boundary',
  orientation: 'vertical',
  bounds: { x: 0, y: 0, w: 4, h: 2, padding: 1 },
  color: '#333333',
  borderColor: '#ffffff',
  borderStyle: 'solid',
  fillOpacity: 0.2,
  borderOpacity: 0.8,
  ...overrides,
});

describe('GroupRenderer', () => {
  let renderer: GroupRenderer;
  let parent: THREE.Group;

  beforeEach(() => {
    vi.spyOn(Text.prototype, 'sync').mockImplementation(() => undefined);
    renderer = new GroupRenderer();
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
});
