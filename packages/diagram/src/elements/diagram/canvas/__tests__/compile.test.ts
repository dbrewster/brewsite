import { describe, it, expect, vi } from 'vitest';
import { compileCanvas, compilePipe } from '../compile';
import { compileDiagram } from '../../compile';
import type { DiagramPipeDSL } from '../types';
import type { DiagramDSL } from '../../types';

const makeDiagram = (id: string, nodeId: string, position: [number, number, number]): DiagramDSL => ({
  id,
  layout: { kind: 'manual' },
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
    const warns: Array<{ code: string }> = [];
    const pipe = compilePipe({ from: 'invalid', to: 'a.n1' }, diagrams, 0, 'curved', 'sides', (code) => warns.push({ code }));
    expect(warns[0]!.code).toBe('INVALID_PIPE_REF');
    expect(pipe.controlPoints).toEqual([]);
  });

  it('warns and returns empty controlPoints for unresolvable diagramId', () => {
    const diagrams = [compileDiagram(makeDiagram('a', 'n1', [0, 0, 0]))];
    const warns: Array<{ code: string }> = [];
    const pipe = compilePipe({ from: 'missing.n1', to: 'a.n1' }, diagrams, 0, 'curved', 'sides', (code) => warns.push({ code }));
    expect(warns[0]!.code).toBe('MISSING_PIPE_ENDPOINT');
    expect(pipe.controlPoints).toEqual([]);
  });

  it('warns and returns empty controlPoints for unresolvable nodeId', () => {
    const diagrams = [compileDiagram(makeDiagram('a', 'n1', [0, 0, 0]))];
    const warns: Array<{ code: string }> = [];
    const pipe = compilePipe({ from: 'a.missing', to: 'a.n1' }, diagrams, 0, 'curved', 'sides', (code) => warns.push({ code }));
    expect(warns[0]!.code).toBe('MISSING_PIPE_ENDPOINT');
    expect(pipe.controlPoints).toEqual([]);
  });

  it('transforms node centers by diagram scale + position for nearest-face landing', () => {
    const diagram = compileDiagram({
      id: 'a',
      layout: { kind: 'manual' },
      pivot: 'bottom-left',
      position: [10, 0, 0],
      scale: 2,
      nodes: [{ id: 'n1', label: 'n1', position: [2, 1, 0] }],
      edges: [],
      groups: [],
    });
    const other = compileDiagram(makeDiagram('b', 'n2', [0, 0, 0]));
    const pipe = compilePipe({ from: 'a.n1', to: 'b.n2' }, [diagram, other], 0, 'curved', 'nearest-face');
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

  it('preserves optional canvas focusCenter', () => {
    const diagram = compileDiagram(makeDiagram('a', 'n1', [0, 0, 0]));
    const canvas = compileCanvas({ id: 'canvas', focusCenter: [1, 2, 3] }, [diagram], []);
    expect(canvas.focusCenter).toEqual([1, 2, 3]);
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
