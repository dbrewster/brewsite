// Tests for ghost node semantics (Finding 2): label: undefined triggers merge, '' does not.

import { describe, it, expect } from 'vitest';
import { compileDiagram } from '../compile';
import { compileCanvas } from '../canvas/compile';
import { DiagramCanvasWidget } from '../canvas/widget';

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
    const prev = compileCanvas({ id: 'c' }, [prevDiagram], []);
    const next = compileCanvas({ id: 'c' }, [nextDiagram], []);
    const widget = new DiagramCanvasWidget('c', prev);
    const merged = widget.mergeSnapshot(prev, next);
    const mergedNode = merged!.diagrams[0]!.nodes.find((n) => n.id === 'a')!;
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
    const prev = compileCanvas({ id: 'c' }, [prevDiagram], []);
    const next = compileCanvas({ id: 'c' }, [nextDiagram], []);
    const widget = new DiagramCanvasWidget('c', prev);
    const merged = widget.mergeSnapshot(prev, next);
    const mergedNode = merged!.diagrams[0]!.nodes.find((n) => n.id === 'a')!;
    expect(mergedNode.label).toBe('');
  });
});
