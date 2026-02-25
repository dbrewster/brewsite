import { describe, it, expect } from 'vitest';
import { functionalDiagramTransitionSpec } from '../compile';
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
  cameraTarget: [0, 0, 0],
  cameraDistance: 20,
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

    it('edge control points interpolate at t=0.5', () => {
      const fromEdge = makeEdge('edge-1', [
        [0, 0, 0],
        [5, 0, 0],
      ]);
      const toEdge = makeEdge('edge-1', [
        [0, 0, 0],
        [10, 0, 0],
      ]);
      const from = makeState([makeNode('a', 0), makeNode('b', 0)], [fromEdge], 0);
      const to = makeState([makeNode('a', 0), makeNode('b', 0)], [toEdge], 0);
      const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(0.5);
      expect(result.edges[0]!.controlPoints[1]![0]).toBeCloseTo(7.5);
    });

    it('cameraTarget blends from from.cameraTarget to to.cameraTarget', () => {
      const from = makeState([makeNode('a', 0)], [], 0);
      const to = { ...makeState([makeNode('a', 0)], [], 0), cameraTarget: [10, 0, 0] as const };
      const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(0.5);
      expect(result.cameraTarget[0]).toBeCloseTo(5);
    });

    it('cameraDistance blends from from.cameraDistance to to.cameraDistance', () => {
      const from = makeState([makeNode('a', 0)], [], 0);
      const to = { ...makeState([makeNode('a', 0)], [], 0), cameraDistance: 40 };
      const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(0.5);
      expect(result.cameraDistance).toBeCloseTo(30);
    });
  });
});
