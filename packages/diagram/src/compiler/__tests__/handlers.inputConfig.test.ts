import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { Scene, resolveSceneFromDsl, WidgetRegistry } from '@brewsite/core';
import { registerDiagramHandlers } from '../handlers';
import { Diagram, DiagramNode } from '../../elements/diagram/widget';
import type { DiagramState } from '../../elements/diagram/types';

const makeContext = () => ({
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: false,
  themeFamily: 'default' as const,
  themePolarity: 'dark' as const,
});

const compileScene = (tree: React.ReactElement) => {
  const registry = new WidgetRegistry();
  const warnings: Array<{ code: string; message: string }> = [];
  const result = resolveSceneFromDsl(
    tree,
    makeContext(),
    registry,
    (w) => warnings.push(w),
  );
  return { result, warnings };
};

describe('Diagram handler — no spurious warnings', () => {
  beforeAll(() => {
    registerDiagramHandlers();
  });

  it('does NOT emit IGNORED_INPUT_CONFIG when compiling a plain <Diagram>', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'diag-1' },
        React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
      ),
    );
    const { warnings } = compileScene(tree);
    const match = warnings.find((w) => w.code === 'IGNORED_INPUT_CONFIG');
    expect(match).toBeUndefined();
  });
});

describe('Diagram handler — state keyed by diagram ID', () => {
  beforeAll(() => {
    registerDiagramHandlers();
  });

  it('writes DiagramState under the diagram ID (not a canvas wrapper ID)', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'my-diagram' },
        React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
      ),
    );
    const registry = new WidgetRegistry();
    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const state = frame.widgets['my-diagram'] as DiagramState | undefined;
    expect(state).toBeDefined();
    expect(state!.id).toBe('my-diagram');
    expect(state!.nodes).toHaveLength(1);
  });

  it('produces DiagramState with no defaultInputActions field', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'my-diagram' },
        React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
      ),
    );
    const registry = new WidgetRegistry();
    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const state = frame.widgets['my-diagram'] as DiagramState | undefined;
    expect(state).toBeDefined();
    expect((state as Record<string, unknown>)['defaultInputActions']).toBeUndefined();
  });
});
