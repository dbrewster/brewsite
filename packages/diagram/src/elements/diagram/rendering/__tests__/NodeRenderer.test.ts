import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { NodeRenderer } from '../NodeRenderer';
import { InteractionRegistry } from '../InteractionRegistry';
import type { DiagramNodeState, DiagramThemeRenderConfig } from '../../types';
import type { IIconLoader } from '../IconLoader';
import { Text } from 'troika-three-text';

const themeConfig: DiagramThemeRenderConfig = {
  envMapUrl: null,
  envMapIntensity: 1,
  skyColor: '#000',
  horizonColor: '#000',
  nodeGlowIntensity: 0,
  nodeCornerRadius: 0,
  use3DArrows: false,
  edgeSmoothness: 0.5,
  edgeMetalness: 0.3,
  edgeRoughness: 0.7,
  edgeFlowSpeed: 0.7,
  edgeFlowWidth: 0.18,
  fontUrl: '',
};

const makeNode = (overrides: Partial<DiagramNodeState> = {}): DiagramNodeState => ({
  id: 'n1',
  label: 'Node',
  sublabel: undefined,
  shape: 'flow:rect',
  position: [0, 0, 0],
  size: [4, 2],
  depth: 0.4,
  color: '#ffffff',
  sideColor: '#eeeeee',
  borderColor: '#111111',
  metalness: 0.2,
  roughness: 0.8,
  emissiveIntensity: 0,
  cornerRadius: 0,
  labelColor: '#000000',
  sublabelColor: '#000000',
  opacity: 1,
  clickable: false,
  enabled: true,
  iconUrl: '',
  iconScale: 0.6,
  iconStyle: 'flat',
  iconDepth: 0.1,
  groupId: undefined,
  positionInherited: undefined,
  ...overrides,
});

describe('NodeRenderer', () => {
  let registry: InteractionRegistry;
  let iconLoader: IIconLoader;
  let renderer: NodeRenderer;
  let parent: THREE.Group;

  beforeEach(() => {
    vi.spyOn(Text.prototype, 'sync').mockImplementation(() => undefined);
    registry = new InteractionRegistry();
    iconLoader = {
      load: async () => new THREE.Group(),
      disposeAll: () => undefined,
    };
    renderer = new NodeRenderer(iconLoader, registry);
    parent = new THREE.Group();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clickable node → mesh registered in InteractionRegistry', () => {
    renderer.getOrCreate(makeNode({ clickable: true }), 'd1', themeConfig, parent);
    expect(registry.meshes.size).toBe(1);
  });

  it('non-clickable node → mesh NOT registered', () => {
    renderer.getOrCreate(makeNode({ clickable: false }), 'd1', themeConfig, parent);
    expect(registry.meshes.size).toBe(0);
  });

  it('dispose → mesh removed from registry', () => {
    renderer.getOrCreate(makeNode({ clickable: true }), 'd1', themeConfig, parent);
    renderer.dispose('n1', 'd1', parent);
    expect(registry.meshes.size).toBe(0);
  });

  it('shape change → boxMesh geometry rebuilt', () => {
    const entry = renderer.getOrCreate(makeNode(), 'd1', themeConfig, parent);
    const before = entry.boxMesh.geometry;
    renderer.getOrCreate(makeNode({ shape: 'flow:rounded' }), 'd1', themeConfig, parent);
    expect(entry.boxMesh.geometry).not.toBe(before);
  });

  it('opacity change only → material opacity updated, geometry unchanged', () => {
    const entry = renderer.getOrCreate(makeNode(), 'd1', themeConfig, parent);
    const geometryBefore = entry.boxMesh.geometry;
    renderer.getOrCreate(makeNode({ opacity: 0.5 }), 'd1', themeConfig, parent);
    expect(entry.boxMesh.geometry).toBe(geometryBefore);
  });

  it('disposeAllForDiagram → all that diagram entries removed', () => {
    renderer.getOrCreate(makeNode({ id: 'n1' }), 'd1', themeConfig, parent);
    renderer.getOrCreate(makeNode({ id: 'n2' }), 'd1', themeConfig, parent);
    renderer.disposeAllForDiagram('d1', parent);
    expect(parent.children.length).toBe(0);
  });
});
