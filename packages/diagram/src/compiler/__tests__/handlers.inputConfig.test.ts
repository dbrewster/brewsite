import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { Scene, resolveSceneFromDsl, WidgetRegistry } from '@brewsite/core';
import { registerDiagramHandlers } from '../handlers';
import { Diagram, DiagramNode } from '../../elements/diagram/widget';
import type { DiagramTheme, DiagramState } from '../../elements/diagram/types';
import { darkGlassTheme } from '../../elements/diagram/themes/darkGlass';

const moveAction = {
  id: 'move',
  type: 'diagram-canvas.move',
  speed: 1,
  maps: [{ kind: 'pointer', event: 'drag', button: 'left', axis: 'xy' }],
};

const themeWithInput: DiagramTheme = {
  ...darkGlassTheme,
  input: { defaultActions: [moveAction] },
};

const compileScene = (tree: React.ReactElement) => {
  const registry = new WidgetRegistry();
  const warnings: Array<{ code: string; message: string }> = [];
  const result = resolveSceneFromDsl(
    tree,
    { sceneIndex: 0, numScenes: 1, assetsReady: false },
    registry,
    (w) => warnings.push(w),
  );
  return { result, warnings };
};

describe('Diagram handler — IGNORED_INPUT_CONFIG warning', () => {
  beforeAll(() => {
    registerDiagramHandlers();
  });

  it('emits IGNORED_INPUT_CONFIG for <Diagram> with theme.input', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'diag-1', theme: themeWithInput },
        React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
      ),
    );
    const { warnings } = compileScene(tree);
    const match = warnings.find((w) => w.code === 'IGNORED_INPUT_CONFIG');
    expect(match).toBeDefined();
    expect(match!.message).toContain('diag-1');
  });

  it('does NOT emit IGNORED_INPUT_CONFIG when theme has no input config', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'diag-1', theme: darkGlassTheme },
        React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
      ),
    );
    const { warnings } = compileScene(tree);
    const match = warnings.find((w) => w.code === 'IGNORED_INPUT_CONFIG');
    expect(match).toBeUndefined();
  });

  it('emits IGNORED_INPUT_CONFIG for standalone <Diagram> with theme.input', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'diag-2', theme: themeWithInput },
        React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
      ),
    );
    const { warnings } = compileScene(tree);
    const match = warnings.find((w) => w.code === 'IGNORED_INPUT_CONFIG');
    expect(match).toBeDefined();
    expect(match!.message).toContain('diag-2');
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
    const { frame } = resolveSceneFromDsl(
      tree,
      { sceneIndex: 0, numScenes: 1, assetsReady: false },
      registry,
    );
    const state = frame.widgets['my-diagram'] as DiagramState | undefined;
    expect(state).toBeDefined();
    expect(state!.id).toBe('my-diagram');
    expect(state!.nodes).toHaveLength(1);
  });

  it('produces DiagramState with no defaultInputActions field', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        Diagram, { id: 'my-diagram', theme: darkGlassTheme },
        React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
      ),
    );
    const registry = new WidgetRegistry();
    const { frame } = resolveSceneFromDsl(
      tree,
      { sceneIndex: 0, numScenes: 1, assetsReady: false },
      registry,
    );
    const state = frame.widgets['my-diagram'] as DiagramState | undefined;
    expect(state).toBeDefined();
    expect((state as Record<string, unknown>)['defaultInputActions']).toBeUndefined();
  });
});
