import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { GroupRenderer } from '../GroupRenderer';
import type { DiagramGroupState, DiagramThemeRenderConfig } from '../../types';
import { Text } from 'troika-three-text';
import { GroupInteractionRegistry } from '../GroupInteractionRegistry';

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
  borderEmissiveColor: '#ffffff',
  borderEmissiveIntensity: 0,
  labelColor: '#ffffff',
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
    renderer.getOrCreate(makeGroup(), 'd1', parent, themeConfig);
    expect(parent.children.length).toBe(1);
  });

  it('dispose removes group from parent', () => {
    renderer.getOrCreate(makeGroup(), 'd1', parent, themeConfig);
    renderer.dispose('g1', 'd1', parent);
    expect(parent.children.length).toBe(0);
  });

  it('disposeAllForDiagram removes all diagram groups', () => {
    renderer.getOrCreate(makeGroup({ id: 'g1' }), 'd1', parent, themeConfig);
    renderer.getOrCreate(makeGroup({ id: 'g2' }), 'd1', parent, themeConfig);
    renderer.disposeAllForDiagram('d1', parent);
    expect(parent.children.length).toBe(0);
  });

  it('updates geometry when bounds change', () => {
    const entry = renderer.getOrCreate(makeGroup(), 'd1', parent, themeConfig);
    const before = entry.fill.geometry;
    renderer.getOrCreate(makeGroup({ bounds: { x: 0, y: 0, w: 6, h: 3, padding: [1, 1, 1, 1], titleGap: 0.5 } }), 'd1', parent, themeConfig);
    expect(entry.fill.geometry).not.toBe(before);
  });

  it('switches border material between solid and dashed', () => {
    const entry = renderer.getOrCreate(makeGroup({ borderStyle: 'solid' }), 'd1', parent, themeConfig);
    expect(entry.border).toBeDefined();
    expect(entry.border?.children.length).toBe(2);
    renderer.getOrCreate(makeGroup({ borderStyle: 'dashed' }), 'd1', parent, themeConfig);
    expect(entry.border).toBeDefined();
    expect(entry.border?.children.length).toBe(2);
  });

  it('omits border when borderStyle is none', () => {
    const entry = renderer.getOrCreate(makeGroup({ borderStyle: 'none' }), 'd1', parent, themeConfig);
    expect(entry.border).toBeUndefined();
  });

  it('applies group borderWidth to border material', () => {
    const base = renderer.getOrCreate(makeGroup({ borderWidth: 1.0 }), 'd1', parent, themeConfig);
    const wide = renderer.getOrCreate(makeGroup({ id: 'g2', borderWidth: 2.25 }), 'd1', parent, themeConfig);
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
    const entry = renderer.getOrCreate(makeGroup({ borderHeight: 1.75 }), 'd1', parent, themeConfig);
    expect(entry.border).toBeDefined();
    const ring = entry.border?.children[0] as THREE.Mesh;
    const box = new THREE.Box3().setFromObject(ring);
    const size = new THREE.Vector3();
    box.getSize(size);
    expect(size.z).toBeCloseTo(1.75, 3);
  });

  it('applies border emissive color and intensity to border materials', () => {
    const entry = renderer.getOrCreate(makeGroup({
      borderEmissiveColor: '#00ffcc',
      borderEmissiveIntensity: 0.7,
    }), 'd1', parent, themeConfig);
    const ring = entry.border?.children[0] as THREE.Mesh;
    const materials = ring.material as THREE.MeshStandardMaterial[];
    expect(materials[0].emissive.getHexString()).toBe('00ffcc');
    expect(materials[0].emissiveIntensity).toBeCloseTo(0.7, 6);
    expect(materials[1].emissive.getHexString()).toBe('00ffcc');
    expect(materials[1].emissiveIntensity).toBeCloseTo(0.7, 6);
  });

  it('positions the title in the top padding band above group content', () => {
    const state = makeGroup({
      bounds: { x: 0, y: 0, w: 20, h: 12, padding: [2, 1, 1, 1], titleGap: 0.75 },
    });
    renderer.getOrCreate(state, 'd1', parent, themeConfig);
    const entry = renderer.getOrCreate(state, 'd1', parent, themeConfig);

    const contentTopY = state.bounds.h / 2 - state.bounds.padding[0];
    expect(entry.label.position.y).toBeGreaterThan(contentTopY);
  });

  it('creates point lights for compiled edge lights', () => {
    const entry = renderer.getOrCreate(makeGroup({
      edgeLights: {
        lights: [
          { index: 0, side: 'top', indexOnSide: 0, position: [-1, 1, 0.5], color: '#ff0000' },
          { index: 1, side: 'top', indexOnSide: 1, position: [1, 1, 0.5], color: '#00ff00' },
        ],
        intensity: 0.6,
        distance: 3,
        decay: 2,
      },
    }), 'd1', parent, themeConfig);
    expect(entry.edgeLights).toBeDefined();
    expect(entry.edgeLights?.children.length).toBe(2);
    expect(entry.edgeLights?.children[0]).toBeInstanceOf(THREE.PointLight);
  });

  it('rebuilds edge lights when compiled light state changes', () => {
    const entry = renderer.getOrCreate(makeGroup({
      edgeLights: {
        lights: [{ index: 0, side: 'top', indexOnSide: 0, position: [0, 1, 0.5], color: '#ff0000' }],
        intensity: 0.6,
        distance: 3,
        decay: 2,
      },
    }), 'd1', parent, themeConfig);
    const before = entry.edgeLights;
    renderer.getOrCreate(makeGroup({
      edgeLights: {
        lights: [{ index: 0, side: 'top', indexOnSide: 0, position: [0, 1, 0.5], color: '#00ff00' }],
        intensity: 0.6,
        distance: 3,
        decay: 2,
      },
    }), 'd1', parent, themeConfig);
    expect(entry.edgeLights).toBeDefined();
    expect(entry.edgeLights).not.toBe(before);
    const light = entry.edgeLights?.children[0] as THREE.PointLight;
    expect(light.color.getHexString()).toBe('00ff00');
  });

  it('renders group title label with state.labelColor, not hardcoded white', () => {
    const state = makeGroup({ label: 'My Group', labelColor: '#00ff00' });
    renderer.getOrCreate(state, 'd1', parent, themeConfig);
    const entry = renderer.getOrCreate(state, 'd1', parent, themeConfig);
    expect(entry.label.color).toBe('#00ff00');
  });
});
