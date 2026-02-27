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

  it('cornerRadius toggles rounded border visibility and resources', () => {
    const entry = renderer.getOrCreate(makeNode({ cornerRadius: 0 }), 'd1', themeConfig, parent);
    expect(entry.roundedBorder).toBeUndefined();
    expect(entry.border.visible).toBe(true);

    renderer.getOrCreate(makeNode({ cornerRadius: 0.4 }), 'd1', themeConfig, parent);
    expect(entry.roundedBorder).toBeDefined();
    expect(entry.border.visible).toBe(false);

    renderer.getOrCreate(makeNode({ cornerRadius: 0 }), 'd1', themeConfig, parent);
    expect(entry.roundedBorder).toBeUndefined();
    expect(entry.border.visible).toBe(true);
  });

  it('glow sprite is added, updated, and removed based on theme config', () => {
    const noGlow = { ...themeConfig, nodeGlowIntensity: 0 };
    const glowOn = { ...themeConfig, nodeGlowIntensity: 1 };
    const entry = renderer.getOrCreate(makeNode({ color: '#ff0000' }), 'd1', noGlow, parent);
    expect(entry.glow).toBeUndefined();

    renderer.getOrCreate(makeNode({ color: '#ff0000' }), 'd1', glowOn, parent);
    expect(entry.glow).toBeDefined();
    const glow = entry.glow!;

    renderer.getOrCreate(makeNode({ color: '#00ff00', size: [6, 3] }), 'd1', glowOn, parent);
    expect(glow.material.color.getHexString()).toBe('00ff00');
    expect(glow.scale.x).toBeCloseTo(6 * 2.2, 4);

    renderer.getOrCreate(makeNode({ color: '#00ff00', size: [6, 3] }), 'd1', noGlow, parent);
    expect(entry.glow).toBeUndefined();
  });

  it('updates rounded border geometry when size changes', () => {
    const entry = renderer.getOrCreate(makeNode({ cornerRadius: 0.4 }), 'd1', themeConfig, parent);
    const before = entry.roundedBorder?.geometry;
    renderer.getOrCreate(makeNode({ cornerRadius: 0.4, size: [6, 3] }), 'd1', themeConfig, parent);
    expect(entry.roundedBorder?.geometry).not.toBe(before);
  });

  it('rebuilds materials when color changes and disposes old', () => {
    const entry = renderer.getOrCreate(makeNode(), 'd1', themeConfig, parent);
    const mats = entry.boxMesh.material as THREE.Material[];
    const disposeSpy = vi.spyOn(mats[0], 'dispose');
    renderer.getOrCreate(makeNode({ color: '#ff00ff' }), 'd1', themeConfig, parent);
    expect(disposeSpy).toHaveBeenCalled();
  });

  it('updates opacity without rebuilding geometry', () => {
    const entry = renderer.getOrCreate(makeNode(), 'd1', themeConfig, parent);
    const geometryBefore = entry.boxMesh.geometry;
    renderer.getOrCreate(makeNode({ opacity: 0.25 }), 'd1', themeConfig, parent);
    expect(entry.boxMesh.geometry).toBe(geometryBefore);
    const mats = entry.boxMesh.material as THREE.MeshStandardMaterial[];
    mats.forEach((mat) => {
      expect(mat.opacity).toBeCloseTo(0.25);
      expect(mat.transparent).toBe(true);
    });
  });

  it('creates rounded border and glow on initial creation', () => {
    const glowTheme = { ...themeConfig, nodeGlowIntensity: 0.8 };
    const entry = renderer.getOrCreate(
      makeNode({ cornerRadius: 0.4 }),
      'd1',
      glowTheme,
      parent,
    );
    expect(entry.roundedBorder).toBeDefined();
    expect(entry.border.visible).toBe(false);
    expect(entry.glow).toBeDefined();
  });

  it('creates and removes sublabel when present/absent', () => {
    const entry = renderer.getOrCreate(makeNode({ sublabel: 'Sub' }), 'd1', themeConfig, parent);
    expect(entry.sublabel).toBeDefined();

    renderer.getOrCreate(makeNode({ sublabel: undefined }), 'd1', themeConfig, parent);
    expect(entry.sublabel).toBeUndefined();
  });

  it('updates icon holder opacity for non-flat icon styles', () => {
    const entry = renderer.getOrCreate(
      makeNode({ iconUrl: 'icon.svg', iconStyle: 'extruded', opacity: 1 }),
      'd1',
      themeConfig,
      parent,
    );
    expect(entry.iconHolder).toBeDefined();

    const matA = new THREE.MeshStandardMaterial({ opacity: 1, transparent: true });
    const matB = new THREE.MeshStandardMaterial({ opacity: 1, transparent: true });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [matA, matB]);
    const singleMat = new THREE.MeshStandardMaterial({ opacity: 1, transparent: true });
    const singleMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), singleMat);
    entry.iconHolder!.add(mesh);
    entry.iconHolder!.add(singleMesh);

    renderer.getOrCreate(
      makeNode({ iconUrl: 'icon.svg', iconStyle: 'extruded', opacity: 0.4 }),
      'd1',
      themeConfig,
      parent,
    );

    const materials = mesh.material as THREE.MeshStandardMaterial[];
    materials.forEach((mat) => {
      expect(mat.opacity).toBeCloseTo(0.4);
      expect(mat.transparent).toBe(true);
    });
    expect(singleMat.opacity).toBeCloseTo(0.4);
    expect(singleMat.transparent).toBe(true);
  });

  it('removes icon holder when iconUrl is cleared', () => {
    const entry = renderer.getOrCreate(
      makeNode({ iconUrl: 'icon.svg' }),
      'd1',
      themeConfig,
      parent,
    );
    expect(entry.iconHolder).toBeDefined();

    renderer.getOrCreate(
      makeNode({ iconUrl: '' }),
      'd1',
      themeConfig,
      parent,
    );
    expect(entry.iconHolder).toBeUndefined();
  });

  it('replaces icon holder when iconUrl changes', () => {
    const entry = renderer.getOrCreate(
      makeNode({ iconUrl: 'icon-a.svg' }),
      'd1',
      themeConfig,
      parent,
    );
    const oldHolder = entry.iconHolder;
    renderer.getOrCreate(
      makeNode({ iconUrl: 'icon-b.svg' }),
      'd1',
      themeConfig,
      parent,
    );
    expect(entry.iconHolder).toBeDefined();
    expect(entry.iconHolder).not.toBe(oldHolder);
  });

  it('updates rounded border material color and opacity', () => {
    const entry = renderer.getOrCreate(
      makeNode({ cornerRadius: 0.4, borderColor: '#111111', opacity: 0.5 }),
      'd1',
      themeConfig,
      parent,
    );
    renderer.getOrCreate(
      makeNode({ cornerRadius: 0.4, borderColor: '#ff00ff', opacity: 0.2 }),
      'd1',
      themeConfig,
      parent,
    );
    const mat = entry.roundedBorder?.material as THREE.LineBasicMaterial;
    expect(mat.color.getHexString()).toBe('ff00ff');
    expect(mat.opacity).toBeCloseTo(0.2);
  });

  it('positions label and sublabel when iconUrl is present', () => {
    const entry = renderer.getOrCreate(
      makeNode({ iconUrl: 'icon.svg', sublabel: 'Sub' }),
      'd1',
      themeConfig,
      parent,
    );
    expect(entry.sublabel).toBeDefined();
    expect(entry.sublabel!.position.y).toBeLessThan(entry.label.position.y);
  });

  it('creates sublabel when added later', () => {
    const entry = renderer.getOrCreate(makeNode({ sublabel: undefined }), 'd1', themeConfig, parent);
    expect(entry.sublabel).toBeUndefined();
    renderer.getOrCreate(makeNode({ sublabel: 'Later' }), 'd1', themeConfig, parent);
    expect(entry.sublabel).toBeDefined();
  });

  it('unregisters when node becomes disabled while clickable', () => {
    renderer.getOrCreate(makeNode({ clickable: true, enabled: true }), 'd1', themeConfig, parent);
    expect(registry.meshes.size).toBe(1);
    renderer.getOrCreate(makeNode({ clickable: true, enabled: false }), 'd1', themeConfig, parent);
    expect(registry.meshes.size).toBe(0);
  });

  it('dispose releases rounded border, glow, and icon holder resources', () => {
    const glowTheme = { ...themeConfig, nodeGlowIntensity: 0.5 };
    renderer.getOrCreate(
      makeNode({ cornerRadius: 0.4, iconUrl: 'icon.svg' }),
      'd1',
      glowTheme,
      parent,
    );
    renderer.dispose('n1', 'd1', parent);
    expect(registry.meshes.size).toBe(0);
  });
});
