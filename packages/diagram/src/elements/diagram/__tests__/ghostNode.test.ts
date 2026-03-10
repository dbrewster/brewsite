// Tests for ghost node semantics: label: undefined triggers merge, '' does not.

import { describe, it, expect } from 'vitest';
import { compileDiagram } from '../compile';
import { DiagramWidget } from '../widget';
import type { DiagramState, DiagramThemeRenderConfig } from '../types';

/** Minimal theme config that avoids asset loading in the test environment. */
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

function makeDefaultState(overrides: Partial<DiagramState> = {}): DiagramState {
  return {
    id: 'test',
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

describe('ghost node semantic fix (Finding 2)', () => {
  it('node with label absent compiles to label: undefined', () => {
    const state = compileDiagram({
      id: 'test',
      nodes: [{ id: 'a' }],
      edges: [],
      groups: [],
    });
    const node = state.nodes.find((n) => n.id === 'a')!;
    expect(node.label).toBeUndefined();
  });

  it('node with label empty string compiles to label: ""', () => {
    const state = compileDiagram({
      id: 'test',
      nodes: [{ id: 'a', label: '' }],
      edges: [],
      groups: [],
    });
    const node = state.nodes.find((n) => n.id === 'a')!;
    expect(node.label).toBe('');
  });

  it('mergeSnapshot inherits label from prev when current label is undefined (ghost)', () => {
    const prevDiagram = compileDiagram({
      id: 'd',
      nodes: [{ id: 'a', label: 'API Gateway', shape: 'rectangle' }],
      edges: [],
      groups: [],
    });
    const nextDiagram = compileDiagram({
      id: 'd',
      nodes: [{ id: 'a' /* ghost: label absent */ }],
      edges: [],
      groups: [],
    });
    const widget = new DiagramWidget('d', makeDefaultState({ id: 'd' }));
    const merged = widget.mergeSnapshot(prevDiagram, nextDiagram);
    const mergedNode = merged!.nodes.find((n) => n.id === 'a')!;
    expect(mergedNode.label).toBe('API Gateway');
  });

  it('mergeSnapshot does NOT inherit from prev when label is empty string', () => {
    const prevDiagram = compileDiagram({
      id: 'd',
      nodes: [{ id: 'a', label: 'API Gateway' }],
      edges: [],
      groups: [],
    });
    const nextDiagram = compileDiagram({
      id: 'd',
      nodes: [{ id: 'a', label: '' /* intentional empty */ }],
      edges: [],
      groups: [],
    });
    const widget = new DiagramWidget('d', makeDefaultState({ id: 'd' }));
    const merged = widget.mergeSnapshot(prevDiagram, nextDiagram);
    const mergedNode = merged!.nodes.find((n) => n.id === 'a')!;
    expect(mergedNode.label).toBe('');
  });
});
