import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { NodeRenderer } from '../NodeRenderer';
import { InteractionRegistry } from '../InteractionRegistry';
import type { DiagramNodeState, DiagramThemeRenderConfig } from '../../types';
import type { IIconLoader } from '../IconLoader';
import { computeGlowScale } from '../../../_shared/glowSprite';
import { Text } from 'troika-three-text';

const themeConfig: DiagramThemeRenderConfig = {
  envMapUrl: null,
  envMapIntensity: 1,
  skyColor: '#000',
  horizonColor: '#000',
  nodeEnvMapIntensity: 0.15,
  nodeGlowIntensity: 0,
  nodeGlowSpread: 2.2,
  nodeCornerRadius: 0,
  use3DArrows: false,
  edgeSmoothness: 0.5,
  edgeMetalness: 0.3,
  edgeRoughness: 0.7,
  edgeFlowSpeed: 0.7,
  edgeFlowWidth: 0.18,
  edgeTubeRadialSegments: 8,
  groupBorderMetalness: 0.35,
  groupBorderRoughness: 0.45,
  groupBorderSideDarken: 0.40,
  groupBorderEdgeDarken: 0.45,
  edgeFlowPulseIntensity: 0.9,
  nodeLabelFontSizeBase: 0.28,
  nodeSublabelFontSizeBase: 0.18,
  fontUrl: '',
};

const makeNode = (overrides: Partial<DiagramNodeState> = {}): DiagramNodeState => ({
  id: 'n1',
  label: 'Node',
  sublabel: undefined,
  shape: 'rectangle',
  position: [0, 0, 0],
  size: [4, 2],
  thickness: 0.4,
  color: '#ffffff',
  sideColor: '#eeeeee',
  borderColor: '#111111',
  borderWidth: 0.05,
  borderHeight: 0.05,
  metalness: 0.2,
  roughness: 0.8,
  emissiveIntensity: 0,
  emissive: false,
  emissiveColor: '#ffffff',
  cornerRadius: 0,
  labelColor: '#000000',
  sublabelColor: '#000000',
  sublabelWrap: false,
  sublabelMaxLines: 2,
  labelPadding: 0,
  opacity: 1,
  clickable: false,
  enabled: true,
  iconUrl: '',
  iconScale: 0.6,
  iconStyle: 'flat',
  iconDepth: 0.1,
  iconColor: '#ffffff',
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
    renderer.getOrCreate(makeNode({ shape: 'hexagon' }), 'd1', themeConfig, parent);
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

  it('creates 3D border mesh when borderWidth and borderHeight are positive', () => {
    const entry = renderer.getOrCreate(
      makeNode({ borderWidth: 0.05, borderHeight: 0.05 }),
      'd1', themeConfig, parent,
    );
    expect(entry.border).toBeInstanceOf(THREE.Mesh);
  });

  it('border is null when borderWidth is zero', () => {
    const entry = renderer.getOrCreate(
      makeNode({ borderWidth: 0, borderHeight: 0.05 }),
      'd1', themeConfig, parent,
    );
    expect(entry.border).toBeNull();
  });

  it('border is null for unsupported shapes like cloud', () => {
    const entry = renderer.getOrCreate(
      makeNode({ shape: 'cloud', borderWidth: 0.05, borderHeight: 0.05 }),
      'd1', themeConfig, parent,
    );
    expect(entry.border).toBeNull();
  });

  it('border geometry is rebuilt when size changes', () => {
    const entry = renderer.getOrCreate(
      makeNode({ borderWidth: 0.05, borderHeight: 0.05 }),
      'd1', themeConfig, parent,
    );
    const before = entry.border?.geometry;
    renderer.getOrCreate(
      makeNode({ borderWidth: 0.05, borderHeight: 0.05, size: [6, 3] }),
      'd1', themeConfig, parent,
    );
    expect(entry.border).toBeInstanceOf(THREE.Mesh);
    expect(entry.border!.geometry).not.toBe(before);
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
    const [expectedW] = computeGlowScale(6, 3, 2.2);
    expect(glow.scale.x).toBeCloseTo(expectedW, 4);

    renderer.getOrCreate(makeNode({ color: '#00ff00', size: [6, 3] }), 'd1', noGlow, parent);
    expect(entry.glow).toBeUndefined();
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

  it('creates border mesh and glow on initial creation', () => {
    const glowTheme = { ...themeConfig, nodeGlowIntensity: 0.8 };
    const entry = renderer.getOrCreate(
      makeNode({ cornerRadius: 0.4, borderWidth: 0.05, borderHeight: 0.05 }),
      'd1',
      glowTheme,
      parent,
    );
    expect(entry.border).toBeInstanceOf(THREE.Mesh);
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

  it('updates border material color and opacity', () => {
    renderer.getOrCreate(
      makeNode({ borderColor: '#111111', borderWidth: 0.05, borderHeight: 0.05, opacity: 0.5 }),
      'd1',
      themeConfig,
      parent,
    );
    const entry = renderer.getOrCreate(
      makeNode({ borderColor: '#ff00ff', borderWidth: 0.05, borderHeight: 0.05, opacity: 0.2 }),
      'd1',
      themeConfig,
      parent,
    );
    expect(entry.border).toBeInstanceOf(THREE.Mesh);
    const wallMat = (entry.border!.material as THREE.Material[])[1] as THREE.MeshStandardMaterial;
    expect(wallMat.color.getHexString()).toBe('ff00ff');
    expect(wallMat.opacity).toBeCloseTo(0.2);
  });

  it('applies node emissiveColor to front/cap material', () => {
    const entry = renderer.getOrCreate(
      makeNode({ emissive: true, emissiveIntensity: 0.5, emissiveColor: '#00ffcc' }),
      'd1',
      themeConfig,
      parent,
    );
    const mats = entry.boxMesh.material as THREE.MeshStandardMaterial[];
    const emissiveMat = entry.materialCount === 2 ? mats[0] : mats[4];
    expect(emissiveMat?.emissive.getHexString()).toBe('00ffcc');
    expect(emissiveMat?.emissiveIntensity).toBeCloseTo(0.5, 6);
  });

  it('setNodeEmissiveOverride toggles emissive intensity at runtime', () => {
    const entry = renderer.getOrCreate(
      makeNode({ emissive: false, emissiveIntensity: 0.8 }),
      'd1',
      themeConfig,
      parent,
    );
    const mats = entry.boxMesh.material as THREE.MeshStandardMaterial[];
    const emissiveMat = entry.materialCount === 2 ? mats[0]! : mats[4]!;
    expect(emissiveMat.emissiveIntensity).toBeCloseTo(0, 6);

    renderer.setNodeEmissiveOverride('d1', 'n1', true);
    expect(emissiveMat.emissiveIntensity).toBeCloseTo(0.8, 6);

    renderer.setNodeEmissiveOverride('d1', 'n1', false);
    expect(emissiveMat.emissiveIntensity).toBeCloseTo(0, 6);
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

  it('dispose releases border, glow, and icon holder resources', () => {
    const glowTheme = { ...themeConfig, nodeGlowIntensity: 0.5 };
    renderer.getOrCreate(
      makeNode({ borderWidth: 0.05, borderHeight: 0.05, iconUrl: 'icon.svg' }),
      'd1',
      glowTheme,
      parent,
    );
    renderer.dispose('n1', 'd1', parent);
    expect(registry.meshes.size).toBe(0);
  });
});
