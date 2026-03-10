// Tests for DiagramWidget: initialize, apply, dispose, mergeSnapshot.
// §9.3b: initialize/apply/dispose lifecycle
// §9.3c: mergeSnapshot ghost-node semantics

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { DiagramWidget } from '../widget';
import type { DiagramState, DiagramNodeState, DiagramThemeRenderConfig } from '../types';
import { createNVSCoordService } from '@brewsite/core';
import type { WidgetRenderContext } from '@brewsite/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal theme config that avoids any asset loading (envMapUrl: 'none'). */
const testThemeConfig: DiagramThemeRenderConfig = {
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

function makeDefaultDiagramState(id: string, overrides: Partial<DiagramState> = {}): DiagramState {
  return {
    id,
    viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: [0, 0, 0],
    z: 0,
    scale: 1,
    contentAspect: 1.0,
    nodes: [],
    edges: [],
    groups: [],
    exit: undefined,
    enter: undefined,
    themeConfig: testThemeConfig,
    ...overrides,
  };
}

function makeRenderContext(cam?: THREE.PerspectiveCamera): WidgetRenderContext {
  const camera = cam ?? (() => {
    const c = new THREE.PerspectiveCamera(45, 16 / 9, 0.01, 100);
    c.position.set(0, 0, 12.07);
    return c;
  })();
  return {
    clock: { deltaSeconds: 0.016, wallTimeSeconds: 0 },
    effectiveDeltaSeconds: 0.016,
    globalProgress: 0,
    variables: { get: () => undefined, getNamespace: () => ({}) },
    extra: undefined,
    tick: null,
    coords: createNVSCoordService(camera, 1920, 1080),
  };
}

function makeState(
  nodes: Array<Partial<DiagramNodeState> & { id: string }>,
): DiagramState {
  return makeDefaultDiagramState('d1', {
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.label,
      sublabel: undefined,
      shape: n.shape ?? 'rectangle',
      iconUrl: n.iconUrl,
      iconScale: n.iconScale ?? 0.6,
      sublabelColor: n.sublabelColor,
      position: n.position ?? [0.5, 0.5, 0],
      size: n.size ?? [0.1, 0.05],
      thickness: n.thickness ?? 0.05,
      color: '#ffffff',
      borderColor: '#ffffff',
      metalness: 0.35,
      roughness: 0.45,
      emissiveIntensity: 0,
      labelColor: '#ffffff',
      opacity: 1,
      visible: true,
      positionInherited: n.positionInherited,
      groupId: undefined,
    } as DiagramNodeState)),
  });
}

// ─── §9.3b: initialize / apply / dispose ─────────────────────────────────────

describe('DiagramWidget — initialize and apply', () => {
  it('apply() positions diagramGroup at world coords for viewportBounds center', () => {
    const cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.01, 100);
    cam.position.set(0, 0, 12.07);
    const coords = createNVSCoordService(cam, 1920, 1080);

    const state = makeDefaultDiagramState('d1', {
      viewportBounds: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
      tiltRotation: [0.3, 0, 0],
      z: 0,
    });

    const widget = new DiagramWidget('d1', state);
    const scene = new THREE.Scene();
    widget.initialize({ scene, widgetId: 'd1' });

    expect(scene.children).toHaveLength(1); // diagramGroup added

    const ctx = makeRenderContext(cam);
    widget.apply(state, ctx);

    // diagramGroup should be the first child.
    const group = scene.children[0] as THREE.Group;
    expect(group).toBeDefined();

    // Center of viewportBounds { x:0.25, y:0.25, w:0.5, h:0.5 } is at NVS (0.5, 0.5)
    // which maps to world (0, 0, 0) with this camera.
    const [expectedX, expectedY, expectedZ] = coords.toWorld(0.5, 0.5, 0);
    expect(group.position.x).toBeCloseTo(expectedX, 3);
    expect(group.position.y).toBeCloseTo(expectedY, 3);
    expect(group.position.z).toBeCloseTo(expectedZ, 3);

    // Tilt rotation should be applied.
    expect(group.rotation.x).toBeCloseTo(state.tiltRotation[0], 5);

    widget.dispose();
  });

  it('diagramGroup.name includes widgetId', () => {
    const state = makeDefaultDiagramState('my-diagram');
    const widget = new DiagramWidget('my-diagram', state);
    const scene = new THREE.Scene();
    widget.initialize({ scene, widgetId: 'my-diagram' });

    const group = scene.children[0] as THREE.Group;
    expect(group.name).toBe('diagram:my-diagram');

    widget.dispose();
  });

  it('apply() sets group.scale from state.scale', () => {
    const state = makeDefaultDiagramState('d1', { scale: 2.5 });
    const widget = new DiagramWidget('d1', state);
    const scene = new THREE.Scene();
    widget.initialize({ scene, widgetId: 'd1' });

    widget.apply(state, makeRenderContext());

    const group = scene.children[0] as THREE.Group;
    expect(group.scale.x).toBeCloseTo(2.5, 5);
    expect(group.scale.y).toBeCloseTo(2.5, 5);
    expect(group.scale.z).toBeCloseTo(2.5, 5);

    widget.dispose();
  });
});

describe('DiagramWidget — dispose lifecycle', () => {
  it('dispose() removes group from scene', () => {
    const widget = new DiagramWidget('d1', makeDefaultDiagramState('d1'));
    const scene = new THREE.Scene();
    widget.initialize({ scene, widgetId: 'd1' });
    expect(scene.children).toHaveLength(1);

    widget.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('dispose() a second time does not throw', () => {
    const widget = new DiagramWidget('d1', makeDefaultDiagramState('d1'));
    const scene = new THREE.Scene();
    widget.initialize({ scene, widgetId: 'd1' });

    widget.dispose();
    expect(() => widget.dispose()).not.toThrow();
  });
});

// ─── §9.3c: mergeSnapshot ────────────────────────────────────────────────────

describe('DiagramWidget — mergeSnapshot', () => {
  const widget = new DiagramWidget('d1', makeDefaultDiagramState('d1'));

  it('(a) returns next when prev is undefined', () => {
    const next = makeState([{ id: 'nodeA', label: 'A' }]);
    expect(widget.mergeSnapshot(undefined, next)).toBe(next);
  });

  it('(b) returns undefined when next is undefined', () => {
    expect(widget.mergeSnapshot(makeState([{ id: 'nodeA', label: 'A' }]), undefined)).toBeUndefined();
  });

  it('(c) passes through node with label set and no positionInherited', () => {
    const prev = makeState([{ id: 'n1', label: 'Old', position: [0.2, 0.3, 0] }]);
    const next = makeState([{ id: 'n1', label: 'New', position: [0.5, 0.5, 0] }]);
    const result = widget.mergeSnapshot(prev, next)!;
    expect(result.nodes[0]!.label).toBe('New');
    expect(result.nodes[0]!.position[0]).toBe(0.5);
  });

  it('(d) inherits label/shape/iconUrl from prev when label is undefined in next', () => {
    const prev = makeState([{ id: 'n1', label: 'Ghost', shape: 'circle' }]);
    const next = makeState([{ id: 'n1', label: undefined }]);
    const result = widget.mergeSnapshot(prev, next)!;
    expect(result.nodes[0]!.label).toBe('Ghost');
    expect(result.nodes[0]!.shape).toBe('circle');
  });

  it('(e) inherits position/size/thickness from prev when positionInherited=true', () => {
    const prev = makeState([{ id: 'n1', label: 'A', position: [0.1, 0.2, 0], size: [0.3, 0.15] }]);
    const next = makeState([{ id: 'n1', label: 'A', positionInherited: true }]);
    const result = widget.mergeSnapshot(prev, next)!;
    expect(result.nodes[0]!.position[0]).toBeCloseTo(0.1);
    expect(result.nodes[0]!.size[0]).toBeCloseTo(0.3);
    expect(result.nodes[0]!.positionInherited).toBeUndefined();
  });

  it('(f) passes through next node not found in prev', () => {
    const prev = makeState([]);
    const next = makeState([{ id: 'n-new', label: 'Brand new' }]);
    const result = widget.mergeSnapshot(prev, next)!;
    expect(result.nodes[0]!.label).toBe('Brand new');
  });
});
