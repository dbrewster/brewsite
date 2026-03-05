import { describe, it, expect } from 'vitest';
import { makeSimpleContext } from '@brewsite/core';
import { functionalDiagramCanvasTransitionSpec } from '../compile';
import type { DiagramCanvasState } from '../types';
import type { DiagramState, DiagramNodeState } from '../../types';

const makeNode = (id: string, opacity = 1): DiagramNodeState => ({
  id,
  label: id,
  sublabel: undefined,
  shape: 'flow:rect',
  position: [0, 0, 0],
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

const makeDiagram = (id: string): DiagramState => ({
  id,
  nodes: [makeNode('n1')],
  edges: [],
  groups: [],
  bounds: { x: 0, y: 0, w: 4, h: 2, minZ: 0, maxZ: 0 },
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  pivot: 'center',
  exit: null,
  enter: null,
});

const makeCanvas = (overrides: Partial<DiagramCanvasState> = {}): DiagramCanvasState => ({
  id: 'canvas',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  diagrams: [makeDiagram('d1')],
  pipes: [
    {
      id: 'pipe-1',
      fromDiagramId: 'd1',
      fromNodeId: 'n1',
      toDiagramId: 'd1',
      toNodeId: 'n1',
      label: undefined,
      style: 'solid',
      arrowStart: 'none',
      arrowEnd: 'open',
      color: '#667788',
      thickness: 0.08,
      opacity: 1,
      controlPoints: [
        [0, 0, 0],
        [1, 1, 0],
        [2, 1, 0],
        [3, 0, 0],
      ],
    },
  ],
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
  ...overrides,
});

describe('functionalDiagramCanvasTransitionSpec', () => {
  describe('exitFn', () => {
    it('fades all diagram node opacities to 0 at t=1', () => {
      const state = makeCanvas();
      const result = functionalDiagramCanvasTransitionSpec.exitFn(state)(makeSimpleContext(1));
      expect(result.diagrams[0]!.nodes[0]!.opacity).toBeCloseTo(0);
    });

    it('fades pipe opacities to 0 at t=1', () => {
      const state = makeCanvas();
      const result = functionalDiagramCanvasTransitionSpec.exitFn(state)(makeSimpleContext(1));
      expect(result.pipes[0]!.opacity).toBeCloseTo(0);
    });

    it('applies diagram exit config (to position + fade)', () => {
      const diagram = { ...makeDiagram('d1'), exit: { to: [5, 0, 0], fade: true, easing: 'linear' as const } };
      const state = makeCanvas({ diagrams: [diagram] });
      const result = functionalDiagramCanvasTransitionSpec.exitFn(state)(makeSimpleContext(1));
      expect(result.diagrams[0]!.position).toEqual([5, 0, 0]);
      expect(result.diagrams[0]!.nodes[0]!.opacity).toBeCloseTo(0);
    });
  });

  describe('enterFn', () => {
    it('fades all diagram node opacities from 0 at t=0', () => {
      const state = makeCanvas();
      const result = functionalDiagramCanvasTransitionSpec.enterFn(state)(makeSimpleContext(0));
      expect(result.diagrams[0]!.nodes[0]!.opacity).toBeCloseTo(0);
    });

    it('applies diagram enter config (from position + fade)', () => {
      const diagram = { ...makeDiagram('d1'), enter: { from: [-5, 0, 0], fade: true, easing: 'linear' as const } };
      const state = makeCanvas({ diagrams: [diagram] });
      const result = functionalDiagramCanvasTransitionSpec.enterFn(state)(makeSimpleContext(0));
      expect(result.diagrams[0]!.position).toEqual([-5, 0, 0]);
      expect(result.diagrams[0]!.nodes[0]!.opacity).toBeCloseTo(0);
    });
  });

  describe('interpolateFn', () => {
    it('interpolates canvas position/rotation/scale', () => {
      const from = makeCanvas();
      const to = makeCanvas({ position: [10, 0, 0], rotation: [0, 1, 0], scale: 2 });
      const result = functionalDiagramCanvasTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
      expect(result.position[0]).toBeCloseTo(5);
      expect(result.rotation[1]).toBeCloseTo(0.5);
      expect(result.scale).toBeCloseTo(1.5);
    });

    it('interpolates child diagram node positions', () => {
      const fromDiagram = { ...makeDiagram('d1') };
      const toDiagram = { ...makeDiagram('d1'), nodes: [{ ...makeNode('n1'), position: [10, 0, 0] }] };
      const from = makeCanvas({ diagrams: [fromDiagram] });
      const to = makeCanvas({ diagrams: [toDiagram] });
      const result = functionalDiagramCanvasTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
      expect(result.diagrams[0]!.nodes[0]!.position[0]).toBeCloseTo(5);
    });

    it('fades in new diagrams that have no prior state', () => {
      const from = makeCanvas({ diagrams: [], pipes: [] });
      const to = makeCanvas({ diagrams: [makeDiagram('d1')] });
      const result = functionalDiagramCanvasTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0));
      expect(result.diagrams[0]!.nodes[0]!.opacity).toBeCloseTo(0);
    });

    it('fades out diagrams removed from state', () => {
      const from = makeCanvas({ diagrams: [makeDiagram('d1')] });
      const to = makeCanvas({ diagrams: [], pipes: [] });
      const result = functionalDiagramCanvasTransitionSpec.interpolateFn(from, to)(makeSimpleContext(1));
      expect(result.diagrams[0]!.nodes[0]!.opacity).toBeCloseTo(0);
    });

    it('interpolates pipe opacities', () => {
      const from = makeCanvas();
      const to = makeCanvas({ pipes: [{ ...from.pipes[0]!, opacity: 0.2 }] });
      const result = functionalDiagramCanvasTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
      expect(result.pipes[0]!.opacity).toBeCloseTo(0.6);
    });
  });
});
