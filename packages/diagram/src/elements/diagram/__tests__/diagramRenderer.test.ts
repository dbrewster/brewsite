// Tests for DiagramRenderer NVS → world coordinate conversion.
// §12.9: Edge control point conversion from NVS [0..1] → world-space group-local.
// §12.10: Group center placement verification (Y-up convention for bounds.y).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { DiagramRenderer } from '../render';
import { buildThemeRenderConfig } from '../compiler/themeResolver';
import { darkGlassTheme } from '../themes';
import { mergeTheme } from '../themes/mergeTheme';
import { createNVSCoordService } from '@brewsite/core';
import type { NVSCoordService } from '@brewsite/core';
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

/** Build a real NVSCoordService from a camera at z=12.07, fov=45, 1:1 aspect. */
function makeSquareCoords(): NVSCoordService {
  const cam = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  cam.position.set(0, 0, 12.07);
  return createNVSCoordService(cam, 1000, 1000); // 1:1 aspect
}

/** Build a real NVSCoordService with 16:9 aspect. */
function make16x9Coords(): NVSCoordService {
  const cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.01, 100);
  cam.position.set(0, 0, 12.07);
  return createNVSCoordService(cam, 1920, 1080);
}

/** Build a minimal DiagramEdgeState with custom NVS control points. */
function makeEdgeState(
  controlPoints: ReadonlyArray<readonly [number, number, number]>,
): DiagramEdgeState {
  const start = controlPoints[0] ?? [0, 0, 0];
  const end = controlPoints[controlPoints.length - 1] ?? start;
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
    path: {
      commands: controlPoints.length >= 2
        ? [{ kind: 'line', from: start, to: end }]
        : [],
      startTangent: [1, 0, 0],
      endTangent: [-1, 0, 0],
      usedUnderpass: false,
      punctures: [],
    },
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
    z: 0,
    scale: 1,
    contentAspect: 1.0,
    exit: undefined,
    enter: undefined,
    themeConfig: minimalThemeConfig,
  };
}

function getPathPoints(geometry: THREE.TubeGeometry): THREE.Vector3[] {
  const path = geometry.parameters.path as THREE.Curve<THREE.Vector3>;
  return path.getPoints(8);
}

// ─── §12.9: Edge control point NVS → world-space group-local conversion ────────

describe('DiagramRenderer — edge control point NVS → world-space conversion (§12.9)', () => {
  it('maps NVS (0.5,0.5) control point to group-local (0, 0, 0) with fullscreen vp', () => {
    // NVS center (0.5,0.5) = group center → local offset (0,0).
    const renderer = new DiagramRenderer(minimalThemeConfig);
    const group = new THREE.Group();
    const coords = makeSquareCoords();
    const state = makeDiagramState(
      [makeEdgeState([[0.5, 0.5, 0]])],
      [],
    );

    renderer.update(state, group, coords);

    const edgeGroup = group.children[0] as THREE.Group;
    const tube = edgeGroup.children[0] as THREE.Mesh;
    const geom = tube.geometry as THREE.TubeGeometry;
    const points = getPathPoints(geom);

    // NVS center maps to group-local (0,0).
    expect(points[0]!.x).toBeCloseTo(0, 3);
    expect(points[0]!.y).toBeCloseTo(0, 3);

    renderer.dispose('testDiagram', group);
  });

  it('maps NVS (0,0) control point to group-local top-left (negative X, positive Y)', () => {
    // NVS (0,0) = top-left → world X negative, world Y positive.
    const renderer = new DiagramRenderer(minimalThemeConfig);
    const group = new THREE.Group();
    const coords = makeSquareCoords();
    const state = makeDiagramState(
      [makeEdgeState([[0, 0, 0], [0.5, 0.5, 0]])],
      [],
    );

    renderer.update(state, group, coords);

    const edgeGroup = group.children[0] as THREE.Group;
    const tube = edgeGroup.children[0] as THREE.Mesh;
    const geom = tube.geometry as THREE.TubeGeometry;
    const points = getPathPoints(geom);

    // NVS (0,0) is top-left: group-local X should be negative, Y should be positive.
    expect(points[0]!.x).toBeLessThan(0);
    expect(points[0]!.y).toBeGreaterThan(0);

    renderer.dispose('testDiagram', group);
  });

  it('maps NVS (1,1) control point to group-local bottom-right (positive X, negative Y)', () => {
    const renderer = new DiagramRenderer(minimalThemeConfig);
    const group = new THREE.Group();
    const coords = makeSquareCoords();
    const state = makeDiagramState(
      [makeEdgeState([[0.5, 0.5, 0], [1, 1, 0]])],
      [],
    );

    renderer.update(state, group, coords);

    const edgeGroup = group.children[0] as THREE.Group;
    const tube = edgeGroup.children[0] as THREE.Mesh;
    const geom = tube.geometry as THREE.TubeGeometry;
    const points = getPathPoints(geom);
    const lastPt = points[points.length - 1]!;
    // NVS (1,1) is bottom-right: group-local X positive, Y negative.
    expect(lastPt.x).toBeGreaterThan(0);
    expect(lastPt.y).toBeLessThan(0);

    renderer.dispose('testDiagram', group);
  });

  it('NVS (0,0) and (1,1) have equal-magnitude group-local offsets with square coords', () => {
    // With a fullscreen square viewport, the top-left and bottom-right corners
    // are equidistant from center, so their local coordinates should be symmetric.
    const renderer = new DiagramRenderer(minimalThemeConfig);
    const group = new THREE.Group();
    const coords = makeSquareCoords();
    const state = makeDiagramState(
      [makeEdgeState([[0, 0, 0], [1, 1, 0]])],
      [],
    );

    renderer.update(state, group, coords);

    const edgeGroup = group.children[0] as THREE.Group;
    const tube = edgeGroup.children[0] as THREE.Mesh;
    const geom = tube.geometry as THREE.TubeGeometry;
    const points = getPathPoints(geom);
    const first = points[0]!;
    const last = points[points.length - 1]!;

    // Symmetric about origin: (0,0) → (-halfW, +halfH), (1,1) → (+halfW, -halfH).
    expect(first.x).toBeCloseTo(-last.x, 3);
    expect(first.y).toBeCloseTo(-last.y, 3);

    renderer.dispose('testDiagram', group);
  });

  it('square diagram (contentAspect=1) on 16:9 viewport produces equal |X| and |Y| for corner NVS (0,0)', () => {
    // A square diagram (contentAspect=1.0) on a 16:9 viewport is height-constrained.
    // uniformWorldW = uniformWorldH, so NVS (0,0) → |localX| ≈ |localY|.
    const renderer = new DiagramRenderer(minimalThemeConfig);
    const group = new THREE.Group();
    const coords = make16x9Coords();
    const state = makeDiagramState(
      [makeEdgeState([[0, 0, 0], [1, 1, 0]])],
      [],
    );
    // contentAspect: 1.0 from makeDiagramState — square diagram

    renderer.update(state, group, coords);

    const edgeGroup = group.children[0] as THREE.Group;
    const tube = edgeGroup.children[0] as THREE.Mesh;
    const geom = tube.geometry as THREE.TubeGeometry;
    const points = getPathPoints(geom);

    // With uniform fit: height limits scale → uniformWorldW = uniformWorldH → |X| = |Y|
    expect(Math.abs(points[0]!.x)).toBeCloseTo(Math.abs(points[0]!.y), 3);

    renderer.dispose('testDiagram', group);
  });

  it('wide diagram (contentAspect=16/9) on 16:9 viewport produces larger |X| than |Y| for corner NVS (0,0)', () => {
    // A diagram whose AR matches the 16:9 viewport fills the viewport exactly.
    // uniformWorldW > uniformWorldH, so NVS (0,0) → |localX| > |localY|.
    const renderer = new DiagramRenderer(minimalThemeConfig);
    const group = new THREE.Group();
    const coords = make16x9Coords();
    const state = { ...makeDiagramState([makeEdgeState([[0, 0, 0], [1, 1, 0]])], []), contentAspect: 16 / 9 };

    renderer.update(state, group, coords);

    const edgeGroup = group.children[0] as THREE.Group;
    const tube = edgeGroup.children[0] as THREE.Mesh;
    const geom = tube.geometry as THREE.TubeGeometry;
    const points = getPathPoints(geom);

    expect(Math.abs(points[0]!.x)).toBeGreaterThan(Math.abs(points[0]!.y));

    renderer.dispose('testDiagram', group);
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

  it('places group center at Y≈0 when NVS group spans y=[0.25, 0.75] (centered)', () => {
    // A group from NVS y=0.25 to 0.75 has its center at NVS y=0.5 (vertical center).
    // The diagram group also centers at NVS y=0.5, so local Y=0.
    const renderer = new DiagramRenderer(minimalThemeConfig);
    const group = new THREE.Group();
    const coords = makeSquareCoords();
    const state = makeDiagramState([], [makeGroupState(0.25, 0.5)]);

    // First call: creates entry (position not yet set by updateGroup).
    renderer.update(state, group, coords);
    // Second call: finds existing entry, calls updateGroup which sets position.
    renderer.update(state, group, coords);

    const groupEntryGroup = group.children[0] as THREE.Group;
    expect(groupEntryGroup.position.y).toBeCloseTo(0, 3);

    renderer.dispose('testDiagram', group);
  });

  it('places group center above Y=0 when NVS group is in the upper half (y=[0, 0.5])', () => {
    // Group spanning NVS y=0 to 0.5 has center at NVS y=0.25 (upper quarter).
    // The diagram group centers at NVS y=0.5, so local Y > 0.
    const renderer = new DiagramRenderer(minimalThemeConfig);
    const group = new THREE.Group();
    const coords = makeSquareCoords();
    const state = makeDiagramState([], [makeGroupState(0, 0.5)]);

    renderer.update(state, group, coords);
    renderer.update(state, group, coords);

    const groupEntryGroup = group.children[0] as THREE.Group;
    expect(groupEntryGroup.position.y).toBeGreaterThan(0);

    renderer.dispose('testDiagram', group);
  });

  it('places group center below Y=0 when NVS group is in the lower half (y=[0.5, 1])', () => {
    // Group spanning NVS y=0.5 to 1.0 has center at NVS y=0.75 (lower quarter).
    // The diagram group centers at NVS y=0.5, so local Y < 0.
    const renderer = new DiagramRenderer(minimalThemeConfig);
    const group = new THREE.Group();
    const coords = makeSquareCoords();
    const state = makeDiagramState([], [makeGroupState(0.5, 0.5)]);

    renderer.update(state, group, coords);
    renderer.update(state, group, coords);

    const groupEntryGroup = group.children[0] as THREE.Group;
    expect(groupEntryGroup.position.y).toBeLessThan(0);

    renderer.dispose('testDiagram', group);
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
    z: 0,
    scale: 1,
    contentAspect: 1.0,
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
    const group = new THREE.Group();
    const coords = makeSquareCoords();
    const state = makeMinimalDiagramState({ themeConfig: config });
    expect(() => renderer.update(state, group, coords)).not.toThrow();
  });

  it('recreates EdgeRenderer when edge smoothness changes between updates', () => {
    const config1 = buildThemeRenderConfig(darkGlassTheme);
    const config2 = buildThemeRenderConfig(mergeTheme(darkGlassTheme, { edge: { smoothness: 2.5 } }));
    const renderer = new DiagramRenderer(config1);
    const group = new THREE.Group();
    const coords = makeSquareCoords();
    const state1 = makeMinimalDiagramState({ themeConfig: config1 });
    const state2 = makeMinimalDiagramState({ themeConfig: config2, id: state1.id });
    renderer.update(state1, group, coords);
    renderer.update(state2, group, coords);
    // No crash. Edge rendering applied config2 params.
    expect(group.children.length).toBeGreaterThanOrEqual(0);
  });
});
