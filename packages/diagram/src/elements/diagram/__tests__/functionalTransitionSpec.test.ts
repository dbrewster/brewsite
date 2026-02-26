import { describe, it, expect } from 'vitest';
import { functionalDiagramTransitionSpec, applyDiagramEnter, applyDiagramExit } from '../compile';
import type { DiagramNodeState, DiagramEdgeState, DiagramState } from '../types';

const makeNode = (id: string, z: number, opacity = 1): DiagramNodeState => ({
  id,
  label: id,
  sublabel: undefined,
  shape: 'flow:rect',
  position: [0, 0, z],
  size: [4, 2],
  depth: 0.4,
  color: '#2a2d3e',
  sideColor: '#1f2231',
  borderColor: '#3a3d4f',
  metalness: 0.15,
  roughness: 0.65,
  labelColor: '#ffffff',
  sublabelColor: '#a0a8c0',
  opacity,
  clickable: false,
  enabled: true,
  iconUrl: undefined,
  iconScale: 0.6,
  groupId: undefined,
});

const makeEdge = (id: string, controlPoints: ReadonlyArray<readonly [number, number, number]>, opacity = 1): DiagramEdgeState => ({
  id,
  fromId: 'a',
  toId: 'b',
  label: undefined,
  style: 'solid',
  arrowStart: 'none',
  arrowEnd: 'open',
  color: '#555e7a',
  thickness: 0.04,
  controlPoints,
  opacity,
});

const makeState = (nodes: DiagramNodeState[], edges: DiagramEdgeState[], z: number): DiagramState => ({
  id: 'test',
  nodes,
  edges,
  groups: [],
  bounds: { x: 0, y: 0, w: 4, h: 2, minZ: z, maxZ: z },
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  pivot: 'center',
  exit: null,
  enter: null,
});

describe('functionalDiagramTransitionSpec', () => {
  describe('exitFn', () => {
    it('at t=0 returns fromState opacity unchanged', () => {
      const from = makeState([makeNode('a', 0, 0.8)], [], 0);
      const result = functionalDiagramTransitionSpec.exitFn(from)(0);
      expect(result.nodes[0]!.opacity).toBeCloseTo(0.8);
    });

    it('at t=1 returns opacity 0 on all nodes', () => {
      const from = makeState([makeNode('a', 0, 0.8)], [], 0);
      const result = functionalDiagramTransitionSpec.exitFn(from)(1);
      expect(result.nodes[0]!.opacity).toBeCloseTo(0);
    });
  });

  describe('enterFn', () => {
    it('at t=0 returns opacity 0 on all nodes', () => {
      const to = makeState([makeNode('a', 0, 0.8)], [], 0);
      const result = functionalDiagramTransitionSpec.enterFn(to)(0);
      expect(result.nodes[0]!.opacity).toBeCloseTo(0);
    });

    it('at t=1 returns toState opacity unchanged', () => {
      const to = makeState([makeNode('a', 0, 0.8)], [], 0);
      const result = functionalDiagramTransitionSpec.enterFn(to)(1);
      expect(result.nodes[0]!.opacity).toBeCloseTo(0.8);
    });
  });

  describe('interpolateFn', () => {
    it('at t=0 node position matches fromState z=0', () => {
      const from = makeState([makeNode('a', 0)], [], 0);
      const to = makeState([makeNode('a', -50)], [], -50);
      const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(0);
      expect(result.nodes.find((node) => node.id === 'a')!.position[2]).toBe(0);
    });

    it('at t=1 node position matches toState z=-50', () => {
      const from = makeState([makeNode('a', 0)], [], 0);
      const to = makeState([makeNode('a', -50)], [], -50);
      const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(1);
      expect(result.nodes.find((node) => node.id === 'a')!.position[2]).toBe(-50);
    });

    it('at t=0.5 node position is midpoint between from and to', () => {
      const from = makeState([makeNode('a', 0)], [], 0);
      const to = makeState([makeNode('a', -50)], [], -50);
      const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(0.5);
      expect(result.nodes.find((node) => node.id === 'a')!.position[2]).toBeCloseTo(-25);
    });

    it('node absent from fromState fades in (opacity 0 at t=0, full at t=1)', () => {
      const from = makeState([makeNode('a', 0)], [], 0);
      const to = makeState([makeNode('a', 0), makeNode('b', 0, 0.6)], [], 0);
      const resultStart = functionalDiagramTransitionSpec.interpolateFn(from, to)(0);
      const resultEnd = functionalDiagramTransitionSpec.interpolateFn(from, to)(1);
      expect(resultStart.nodes.find((node) => node.id === 'b')!.opacity).toBeCloseTo(0);
      expect(resultEnd.nodes.find((node) => node.id === 'b')!.opacity).toBeCloseTo(0.6);
    });

    it('node absent from toState fades out (full at t=0, opacity 0 at t=1)', () => {
      const from = makeState([makeNode('a', 0), makeNode('c', 0, 0.7)], [], 0);
      const to = makeState([makeNode('a', 0)], [], 0);
      const resultStart = functionalDiagramTransitionSpec.interpolateFn(from, to)(0);
      const resultEnd = functionalDiagramTransitionSpec.interpolateFn(from, to)(1);
      expect(resultStart.nodes.find((node) => node.id === 'c')!.opacity).toBeCloseTo(0.7);
      expect(resultEnd.nodes.find((node) => node.id === 'c')!.opacity).toBeCloseTo(0);
    });

    it('edge control points track live node positions during interpolation', () => {
      // Node 'b' moves from z=0 to z=-10 during the transition.
      // The edge must track the moving node, not hold a static pre-compiled position.
      const nodeA = { ...makeNode('a', 0), position: [-5, 0, 0] as const };
      const fromB = { ...makeNode('b', 0), position: [5, 0, 0] as const };
      const toB   = { ...makeNode('b', 0), position: [5, 0, -10] as const };
      const edge = makeEdge('a-b-0', [], 1);
      const edgeWithIds = { ...edge, fromId: 'a', toId: 'b' };
      const from = makeState([nodeA, fromB], [edgeWithIds], 0);
      const to   = makeState([nodeA, toB],   [edgeWithIds], 0);

      const resultMid = functionalDiagramTransitionSpec.interpolateFn(from, to)(0.5);
      const pts = resultMid.edges[0]!.controlPoints;

      // Live routing should produce at least 2 control points.
      expect(pts.length).toBeGreaterThanOrEqual(2);
      // Start point (near 'a' at [-5,0,0]) should have negative x.
      expect(pts[0]![0]).toBeLessThan(0);
      // End point (near 'b' at [5,0,-5] at t=0.5) should have positive x.
      expect(pts[pts.length - 1]![0]).toBeGreaterThan(0);
      // End point z should reflect node b's interpolated z (-5 at t=0.5, not the
      // pre-compiled 0 or -10).
      expect(pts[pts.length - 1]![2]).toBeLessThan(0);
      expect(pts[pts.length - 1]![2]).toBeGreaterThan(-10);
    });
  });
});

describe('applyDiagramExit', () => {
  it('with no exit config: fades nodes and edges to 0 at t=1', () => {
    const state = makeState([makeNode('a', 0, 0.6)], [makeEdge('e', [[0, 0, 0], [1, 0, 0]], 0.8)], 0);
    const result = applyDiagramExit(state, 1);
    expect(result.nodes[0]!.opacity).toBeCloseTo(0);
    expect(result.edges[0]!.opacity).toBeCloseTo(0);
  });

  it('with exit config {to, fade:true}: moves position and fades', () => {
    const state = { ...makeState([makeNode('a', 0)], [], 0), exit: { to: [10, 0, 0], fade: true, easing: 'linear' as const } };
    const result = applyDiagramExit(state, 1);
    expect(result.position).toEqual([10, 0, 0]);
    expect(result.nodes[0]!.opacity).toBeCloseTo(0);
  });

  it('with exit config {scaleTo:0}: shrinks scale to 0 at t=1', () => {
    const state = { ...makeState([makeNode('a', 0)], [], 0), exit: { scaleTo: 0, fade: false, easing: 'linear' as const } };
    const result = applyDiagramExit(state, 1);
    expect(result.scale).toBeCloseTo(0);
  });

  it('applies easing: spring produces non-linear t mapping', () => {
    const state = { ...makeState([makeNode('a', 0)], [], 0), exit: { scaleTo: 0, fade: false, easing: 'spring' as const } };
    const mid = applyDiagramExit(state, 0.5);
    expect(mid.scale).not.toBeCloseTo(0.5);
  });
});

describe('applyDiagramEnter', () => {
  it('with no enter config: fades nodes in from 0 at t=0', () => {
    const state = makeState([makeNode('a', 0, 0.6)], [], 0);
    const result = applyDiagramEnter(state, 0);
    expect(result.nodes[0]!.opacity).toBeCloseTo(0);
  });

  it('with enter config {from}: starts at from position at t=0', () => {
    const state = { ...makeState([makeNode('a', 0)], [], 0), enter: { from: [-10, 0, 0], fade: false, easing: 'linear' as const } };
    const result = applyDiagramEnter(state, 0);
    expect(result.position).toEqual([-10, 0, 0]);
  });

  it('with enter config {scaleFrom:0}: starts at scale 0', () => {
    const state = { ...makeState([makeNode('a', 0)], [], 0), enter: { scaleFrom: 0, fade: false, easing: 'linear' as const } };
    const result = applyDiagramEnter(state, 0);
    expect(result.scale).toBeCloseTo(0);
  });
});

describe('interpolateFn — diagram transform', () => {
  it('interpolates diagram position at t=0.5', () => {
    const from = makeState([makeNode('a', 0)], [], 0);
    const to = { ...makeState([makeNode('a', 0)], [], 0), position: [10, 0, 0] };
    const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(0.5);
    expect(result.position[0]).toBeCloseTo(5);
  });

  it('interpolates diagram scale at t=0.5', () => {
    const from = makeState([makeNode('a', 0)], [], 0);
    const to = { ...makeState([makeNode('a', 0)], [], 0), scale: 3 };
    const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(0.5);
    expect(result.scale).toBeCloseTo(2);
  });
});
