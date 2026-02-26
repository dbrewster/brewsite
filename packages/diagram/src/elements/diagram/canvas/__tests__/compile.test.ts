import { describe, it, expect, vi } from 'vitest';
import { compileCanvas, compilePipe } from '../compile';
import { compileDiagram } from '../../compile';
import type { DiagramPipeDSL } from '../types';
import type { DiagramDSL } from '../../types';

const makeDiagram = (id: string, nodeId: string, position: [number, number, number]): DiagramDSL => ({
  id,
  layout: 'manual',
  layoutSpacing: [2, 2],
  nodes: [
    { id: nodeId, label: nodeId, position },
  ],
  edges: [],
  groups: [],
});

describe('compilePipe', () => {
  it('produces at least 2 control points for a valid pipe', () => {
    const diagrams = [
      compileDiagram(makeDiagram('a', 'n1', [0, 0, 0])),
      compileDiagram(makeDiagram('b', 'n2', [5, 0, 0])),
    ];
    const pipe = compilePipe({ from: 'a.n1', to: 'b.n2' }, diagrams, 0);
    expect(pipe.controlPoints.length).toBeGreaterThanOrEqual(2);
  });

  it('warns and returns empty controlPoints for invalid dot-notation', () => {
    const diagrams = [compileDiagram(makeDiagram('a', 'n1', [0, 0, 0]))];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pipe = compilePipe({ from: 'invalid', to: 'a.n1' }, diagrams, 0);
    expect(warnSpy).toHaveBeenCalled();
    expect(pipe.controlPoints).toEqual([]);
    warnSpy.mockRestore();
  });

  it('warns and returns empty controlPoints for unresolvable diagramId', () => {
    const diagrams = [compileDiagram(makeDiagram('a', 'n1', [0, 0, 0]))];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pipe = compilePipe({ from: 'missing.n1', to: 'a.n1' }, diagrams, 0);
    expect(warnSpy).toHaveBeenCalled();
    expect(pipe.controlPoints).toEqual([]);
    warnSpy.mockRestore();
  });

  it('warns and returns empty controlPoints for unresolvable nodeId', () => {
    const diagrams = [compileDiagram(makeDiagram('a', 'n1', [0, 0, 0]))];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pipe = compilePipe({ from: 'a.missing', to: 'a.n1' }, diagrams, 0);
    expect(warnSpy).toHaveBeenCalled();
    expect(pipe.controlPoints).toEqual([]);
    warnSpy.mockRestore();
  });

  it('transforms node positions by diagram scale + position', () => {
    const diagram = compileDiagram({
      id: 'a',
      layout: 'manual',
      layoutSpacing: [2, 2],
      pivot: 'bottom-left',
      position: [10, 0, 0],
      scale: 2,
      nodes: [{ id: 'n1', label: 'n1', position: [2, 1, 0] }],
      edges: [],
      groups: [],
    });
    const other = compileDiagram(makeDiagram('b', 'n2', [0, 0, 0]));
    const pipe = compilePipe({ from: 'a.n1', to: 'b.n2' }, [diagram, other], 0);
    expect(pipe.controlPoints[0]).toEqual([14, 2, 0]);
  });
});

describe('compileCanvas', () => {
  it('applies canvas position/scale defaults', () => {
    const diagram = compileDiagram(makeDiagram('a', 'n1', [0, 0, 0]));
    const canvas = compileCanvas({ id: 'canvas' }, [diagram], []);
    expect(canvas.position).toEqual([0, 0, 0]);
    expect(canvas.scale).toBe(1);
  });

  it('stores compiled diagram states in output', () => {
    const diagram = compileDiagram(makeDiagram('a', 'n1', [0, 0, 0]));
    const canvas = compileCanvas({ id: 'canvas' }, [diagram], []);
    expect(canvas.diagrams[0]!.id).toBe('a');
  });

  it('compiles pipes using compiled diagram states', () => {
    const diagrams = [
      compileDiagram(makeDiagram('a', 'n1', [0, 0, 0])),
      compileDiagram(makeDiagram('b', 'n2', [5, 0, 0])),
    ];
    const pipes: DiagramPipeDSL[] = [{ from: 'a.n1', to: 'b.n2' }];
    const canvas = compileCanvas({ id: 'canvas' }, diagrams, pipes);
    expect(canvas.pipes[0]!.controlPoints.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty pipes array when no DiagramPipe children', () => {
    const diagram = compileDiagram(makeDiagram('a', 'n1', [0, 0, 0]));
    const canvas = compileCanvas({ id: 'canvas' }, [diagram], []);
    expect(canvas.pipes).toEqual([]);
  });
});

describe('routePipe', () => {
  it('produces 4 control points (start, 2 bezier, end)', () => {
    const diagrams = [
      compileDiagram(makeDiagram('a', 'n1', [0, 0, 0])),
      compileDiagram(makeDiagram('b', 'n2', [10, 0, 0])),
    ];
    const pipe = compilePipe({ from: 'a.n1', to: 'b.n2' }, diagrams, 0);
    expect(pipe.controlPoints.length).toBe(4);
  });

  it('arc midpoint is elevated relative to straight-line midpoint', () => {
    const diagrams = [
      compileDiagram(makeDiagram('a', 'n1', [0, 0, 0])),
      compileDiagram(makeDiagram('b', 'n2', [10, 0, 0])),
    ];
    const pipe = compilePipe({ from: 'a.n1', to: 'b.n2' }, diagrams, 0);
    const mid = pipe.controlPoints[1]!;
    const straightMidY = (pipe.controlPoints[0]![1] + pipe.controlPoints[3]![1]) / 2;
    expect(mid[1]).toBeGreaterThan(straightMidY);
  });
});
