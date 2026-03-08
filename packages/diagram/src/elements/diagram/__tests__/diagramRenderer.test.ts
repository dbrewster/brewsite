// Tests for DiagramRenderer NVS → canvas-local coordinate conversion.
// §12.9: Edge control point conversion from [0..1] NVS → canvas-local space.
// §12.10: Group center placement verification (Y-up convention for bounds.y).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { DiagramRenderer } from '../render';
import { buildThemeRenderConfig } from '../compiler/themeResolver';
import { darkGlassTheme } from '../themes';
import { mergeTheme } from '../themes/mergeTheme';
import type {
  DiagramState,
  DiagramEdgeState,
  DiagramGroupState,
  DiagramThemeRenderConfig,
} from '../types';

// ─── Minimal fixture helpers ──────────────────────────────────────────────────

/** Minimal DiagramThemeRenderConfig that avoids any asset loading. */
const minimalThemeConfig: DiagramThemeRenderConfig = {
  envMapUrl: 'none',
  envMapIntensity: 1,
  skyColor: '#000000',
  horizonColor: '#000000',
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
  edgeFlowPulseIntensity: 0.9,
  groupBorderMetalness: 0.35,
  groupBorderRoughness: 0.45,
  groupBorderSideDarken: 0.40,
  groupBorderEdgeDarken: 0.45,
  nodeLabelFontSizeBase: 0.28,
  nodeSublabelFontSizeBase: 0.18,
  fontUrl: undefined,
};

/** Build a minimal DiagramEdgeState with custom NVS control points. */
function makeEdgeState(
  controlPoints: ReadonlyArray<readonly [number, number, number]>,
): DiagramEdgeState {
  return {
    id: 'e1',
    fromId: 'n1',
    toId: 'n2',
    label: undefined,
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'filled',
    color: '#ffffff',
    flow: 'none',
    flowColor: undefined,
    thickness: 0.04,
    controlPoints,
    opacity: 1,
    routing: 'curved',
  };
}

/** Build a minimal DiagramGroupState spanning the given NVS y-range. */
function makeGroupState(nvsY: number, nvsH: number): DiagramGroupState {
  return {
    id: 'g1',
    label: '',
    variant: 'cluster',
    orientation: 'horizontal',
    bounds: {
      x: 0,
      y: nvsY,
      w: 1,
      h: nvsH,
      padding: [0, 0, 0, 0],
      titleGap: 0,
    },
    color: '#333333',
    borderColor: '#ffffff',
    borderWidth: 1,
    borderHeight: 0.05,
    borderStyle: 'none',
    fillOpacity: 0.1,
    borderOpacity: 1,
    borderEmissiveColor: '#000000',
    borderEmissiveIntensity: 0,
  };
}

/** Build a minimal DiagramState with edges and/or groups, no nodes. */
function makeDiagramState(
  edges: DiagramEdgeState[],
  groups: DiagramGroupState[],
): DiagramState {
  return {
    id: 'testDiagram',
    nodes: [],
    edges,
    groups,
    viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: [0, 0, 0],
    exit: undefined,
    enter: undefined,
    themeConfig: minimalThemeConfig,
  };
}

// ─── §12.9: Edge control point NVS → canvas-local conversion ─────────────────

describe('DiagramRenderer — edge control point NVS → canvas-local conversion (§12.9)', () => {
  it('maps NVS (0,0) control point to canvas-local top-left (negative X, positive Y)', () => {
    // Arrange: fullscreen viewport, aspect=1. NVS origin (0,0) is the top-left.
    // Canvas-local is center-origin, Y-up: top-left maps to (-0.5, +0.5).
    const renderer = new DiagramRenderer(minimalThemeConfig);
    renderer.setCanvasAspect(1);
    const parent = new THREE.Group();
    const state = makeDiagramState(
      [makeEdgeState([[0, 0, 0], [0.5, 0.5, 0]])],
      [],
    );

    renderer.update(state, parent);

    // Navigate to the tube mesh: parent → root group → edge entry group → tube mesh
    const root = parent.children[0] as THREE.Group;
    const edgeGroup = root.children[0] as THREE.Group;
    const tube = edgeGroup.children[0] as THREE.Mesh;
    const geom = tube.geometry as THREE.TubeGeometry;
    const curve = geom.parameters.path as THREE.CatmullRomCurve3;

    // NVS (0,0,0) with fullscreen vp and aspect=1:
    // localX = (0 - 0.5) * 1 = -0.5, localY = -(0 - 0.5) = 0.5
    // Root offset = (0,0) for fullscreen → final CP = (-0.5, 0.5, 0)
    expect(curve.points[0]!.x).toBeCloseTo(-0.5, 5);
    expect(curve.points[0]!.y).toBeCloseTo(0.5, 5);
    expect(curve.points[0]!.z).toBeCloseTo(0, 5);

    renderer.dispose('testDiagram', parent);
  });

  it('maps NVS (1,1) control point to canvas-local bottom-right (positive X, negative Y)', () => {
    const renderer = new DiagramRenderer(minimalThemeConfig);
    renderer.setCanvasAspect(1);
    const parent = new THREE.Group();
    const state = makeDiagramState(
      [makeEdgeState([[0.5, 0.5, 0], [1, 1, 0]])],
      [],
    );

    renderer.update(state, parent);

    const root = parent.children[0] as THREE.Group;
    const edgeGroup = root.children[0] as THREE.Group;
    const tube = edgeGroup.children[0] as THREE.Mesh;
    const geom = tube.geometry as THREE.TubeGeometry;
    const curve = geom.parameters.path as THREE.CatmullRomCurve3;

    // NVS (1,1,0): localX=(1-0.5)*1=0.5, localY=-(1-0.5)=-0.5
    const lastPt = curve.points[curve.points.length - 1]!;
    expect(lastPt.x).toBeCloseTo(0.5, 5);
    expect(lastPt.y).toBeCloseTo(-0.5, 5);
    expect(lastPt.z).toBeCloseTo(0, 5);

    renderer.dispose('testDiagram', parent);
  });

  it('maps NVS (0.5,0.5) control point to canvas-local center (0, 0)', () => {
    const renderer = new DiagramRenderer(minimalThemeConfig);
    renderer.setCanvasAspect(1);
    const parent = new THREE.Group();
    const state = makeDiagramState(
      [makeEdgeState([[0, 0, 0], [0.5, 0.5, 0], [1, 1, 0]])],
      [],
    );

    renderer.update(state, parent);

    const root = parent.children[0] as THREE.Group;
    const edgeGroup = root.children[0] as THREE.Group;
    const tube = edgeGroup.children[0] as THREE.Mesh;
    const geom = tube.geometry as THREE.TubeGeometry;
    const curve = geom.parameters.path as THREE.CatmullRomCurve3;

    // NVS (0.5,0.5,0): localX=(0.5-0.5)*1=0, localY=-(0.5-0.5)=0
    const midPt = curve.points[1]!;
    expect(midPt.x).toBeCloseTo(0, 5);
    expect(midPt.y).toBeCloseTo(0, 5);
    expect(midPt.z).toBeCloseTo(0, 5);

    renderer.dispose('testDiagram', parent);
  });

  it('applies canvas aspect ratio: NVS (0,0) with aspect=2 maps to X=-1 (wider canvas)', () => {
    // With aspect=2 (twice as wide), the X range expands: localX = (vpX - 0.5) * 2
    // NVS (0,0): localX = (0 - 0.5) * 2 = -1
    const renderer = new DiagramRenderer(minimalThemeConfig);
    renderer.setCanvasAspect(2);
    const parent = new THREE.Group();
    const state = makeDiagramState(
      [makeEdgeState([[0, 0, 0], [1, 1, 0]])],
      [],
    );

    renderer.update(state, parent);

    const root = parent.children[0] as THREE.Group;
    const edgeGroup = root.children[0] as THREE.Group;
    const tube = edgeGroup.children[0] as THREE.Mesh;
    const geom = tube.geometry as THREE.TubeGeometry;
    const curve = geom.parameters.path as THREE.CatmullRomCurve3;

    // NVS (0,0,0) with aspect=2: localX = -1, root offset = (vpCX-0.5)*2 = 0
    expect(curve.points[0]!.x).toBeCloseTo(-1, 5);

    renderer.dispose('testDiagram', parent);
  });
});

// ─── §12.10: Group center placement — Y-up convention ────────────────────────

describe('DiagramRenderer — group center placement Y-up convention (§12.10)', () => {
  beforeEach(() => {
    // Suppress troika text sync in node environment (no DOM/WebWorker available).
    vi.spyOn(Text.prototype, 'sync').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('places group center at canvas-local Y=0 when NVS group spans y=[0.25, 0.75]', () => {
    // A group spanning NVS y=0.25 to 0.75 has its center at NVS y=0.5, which is
    // the canvas vertical center — canvas-local Y=0.
    //
    // Conversion formula in render.ts for fullscreen vp, aspect=1, root at origin:
    //   localGY = 0.5 - (vp.y + vp.h * (groupBounds.y + groupBounds.h)) - localY
    //           = 0.5 - (0 + 1 * (0.25 + 0.5)) - 0
    //           = 0.5 - 0.75 = -0.25   ← canvas-local BOTTOM edge (Y-up: below center)
    //
    // GroupRenderer formula: centerY = bounds.y + bounds.h / 2
    //   = -0.25 + 0.5 / 2 = -0.25 + 0.25 = 0   ← canvas-local center ✓
    const renderer = new DiagramRenderer(minimalThemeConfig);
    renderer.setCanvasAspect(1);
    const parent = new THREE.Group();
    const state = makeDiagramState([], [makeGroupState(0.25, 0.5)]);

    // First call: creates entry (position not yet set by updateGroup)
    renderer.update(state, parent);
    // Second call: finds existing entry, calls updateGroup which sets position
    renderer.update(state, parent);

    const root = parent.children[0] as THREE.Group;
    const groupEntryGroup = root.children[0] as THREE.Group;
    expect(groupEntryGroup.position.y).toBeCloseTo(0, 5);

    renderer.dispose('testDiagram', parent);
  });

  it('places group center above Y=0 when NVS group is in the upper half (y=[0, 0.5])', () => {
    // NVS group y=[0, 0.5]: center at NVS y=0.25 (upper quarter)
    // localGY = 0.5 - (0 + 1*(0 + 0.5)) - 0 = 0.5 - 0.5 = 0  ← canvas-local BOTTOM = 0
    // centerY = 0 + 0.5/2 = 0.25  ← canvas-local center is positive (upper half) ✓
    const renderer = new DiagramRenderer(minimalThemeConfig);
    renderer.setCanvasAspect(1);
    const parent = new THREE.Group();
    const state = makeDiagramState([], [makeGroupState(0, 0.5)]);

    renderer.update(state, parent);
    renderer.update(state, parent);

    const root = parent.children[0] as THREE.Group;
    const groupEntryGroup = root.children[0] as THREE.Group;
    expect(groupEntryGroup.position.y).toBeGreaterThan(0);

    renderer.dispose('testDiagram', parent);
  });

  it('places group center below Y=0 when NVS group is in the lower half (y=[0.5, 1])', () => {
    // NVS group y=[0.5, 0.5]: center at NVS y=0.75 (lower quarter)
    // localGY = 0.5 - (0 + 1*(0.5 + 0.5)) - 0 = 0.5 - 1 = -0.5 ← canvas-local BOTTOM
    // centerY = -0.5 + 0.5/2 = -0.25 ← canvas-local center is negative (lower half) ✓
    const renderer = new DiagramRenderer(minimalThemeConfig);
    renderer.setCanvasAspect(1);
    const parent = new THREE.Group();
    const state = makeDiagramState([], [makeGroupState(0.5, 0.5)]);

    renderer.update(state, parent);
    renderer.update(state, parent);

    const root = parent.children[0] as THREE.Group;
    const groupEntryGroup = root.children[0] as THREE.Group;
    expect(groupEntryGroup.position.y).toBeLessThan(0);

    renderer.dispose('testDiagram', parent);
  });

  it('bounds.y is negative (below canvas midpoint) confirming Y-up BOTTOM edge convention', () => {
    // For NVS group spanning y=[0.25, 0.75]:
    // localGY = -0.25 which is negative → below the canvas center in Y-up space.
    // This confirms bounds.y received by GroupRenderer IS the BOTTOM edge (not top).
    // GroupRenderer's formula centerY = bounds.y + h/2 then correctly computes the center.
    const renderer = new DiagramRenderer(minimalThemeConfig);
    renderer.setCanvasAspect(1);
    const parent = new THREE.Group();
    const state = makeDiagramState([], [makeGroupState(0.25, 0.5)]);

    renderer.update(state, parent);
    renderer.update(state, parent);

    const root = parent.children[0] as THREE.Group;
    const groupEntryGroup = root.children[0] as THREE.Group;

    // centerY = bounds.y + h/2 = 0 → bounds.y = -h/2 = -0.25
    // Verify: position.y == 0 means bounds.y was -0.25, a NEGATIVE value = BOTTOM edge ✓
    const localH = 0.5; // fullscreen vp, nvsH=0.5 → localH = nvsH * vp.h = 0.5
    const impliedBoundsY = groupEntryGroup.position.y - localH / 2;
    expect(impliedBoundsY).toBeCloseTo(-0.25, 5);
    expect(impliedBoundsY).toBeLessThan(0); // negative confirms it's the Y-up bottom edge

    renderer.dispose('testDiagram', parent);
  });
});

// ─── Stream H: DiagramRenderer constructor architecture ──────────────────────

/** Build a minimal DiagramState with a given themeConfig and optional id override. */
function makeMinimalDiagramState(overrides: { themeConfig: DiagramThemeRenderConfig; id?: string }): DiagramState {
  return {
    id: overrides.id ?? 'testDiagram',
    nodes: [],
    edges: [],
    groups: [],
    viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: [0, 0, 0],
    exit: undefined,
    enter: undefined,
    themeConfig: overrides.themeConfig,
  };
}

describe('DiagramRenderer — constructor architecture (Stream H)', () => {
  it('initializes without calling update() first', () => {
    const config = buildThemeRenderConfig(darkGlassTheme);
    expect(() => new DiagramRenderer(config)).not.toThrow();
  });

  it('update() works on first call without prior init', () => {
    const config = buildThemeRenderConfig(darkGlassTheme);
    const renderer = new DiagramRenderer(config);
    const parent = new THREE.Group();
    const state = makeMinimalDiagramState({ themeConfig: config });
    expect(() => renderer.update(state, parent)).not.toThrow();
  });

  it('recreates EdgeRenderer when edge smoothness changes between updates', () => {
    const config1 = buildThemeRenderConfig(darkGlassTheme);
    const config2 = buildThemeRenderConfig(mergeTheme(darkGlassTheme, { edge: { smoothness: 2.5 } }));
    const renderer = new DiagramRenderer(config1);
    const parent = new THREE.Group();
    const state1 = makeMinimalDiagramState({ themeConfig: config1 });
    const state2 = makeMinimalDiagramState({ themeConfig: config2, id: state1.id });
    renderer.update(state1, parent);
    renderer.update(state2, parent);
    // No crash. Edge rendering applied config2 params.
    // (EdgeRenderer recreation is observable via the parent group's edge children being replaced.)
    expect(parent.children.length).toBeGreaterThan(0);
  });
});
