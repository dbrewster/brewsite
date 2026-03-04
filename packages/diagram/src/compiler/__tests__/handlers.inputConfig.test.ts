import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { Scene, resolveSceneFromDsl, WidgetRegistry } from '@brewsite/core';
import type { InputActionSpec } from '@brewsite/core';
import { registerDiagramHandlers } from '../handlers';
import { DiagramCanvas, DiagramPipe } from '../../elements/diagram/canvas/dsl';
import { Diagram, DiagramNode } from '../../elements/diagram/dsl';
import type { DiagramTheme } from '../../elements/diagram/types';
import { darkGlassTheme } from '../../elements/diagram/themes/darkGlass';

const moveAction: Omit<InputActionSpec, 'canvasId'> = {
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

describe('DiagramCanvas handler — IGNORED_INPUT_CONFIG warning', () => {
  beforeAll(() => {
    registerDiagramHandlers();
  });

  it('emits IGNORED_INPUT_CONFIG when child <Diagram> has theme.input', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        DiagramCanvas, { id: 'canvas-1' },
        React.createElement(
          Diagram, { id: 'diag-1', theme: themeWithInput },
          React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
        ),
      ),
    );
    const { warnings } = compileScene(tree);
    const match = warnings.find((w) => w.code === 'IGNORED_INPUT_CONFIG');
    expect(match).toBeDefined();
    expect(match!.message).toContain('diag-1');
    expect(match!.message).toContain('canvas-1');
  });

  it('does NOT emit IGNORED_INPUT_CONFIG when theme.input is on <DiagramCanvas> only', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        DiagramCanvas, { id: 'canvas-1', theme: themeWithInput },
        React.createElement(
          Diagram, { id: 'diag-1', theme: darkGlassTheme },
          React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
        ),
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
        Diagram, { id: 'diag-1', theme: themeWithInput },
        React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
      ),
    );
    const { warnings } = compileScene(tree);
    const match = warnings.find((w) => w.code === 'IGNORED_INPUT_CONFIG');
    expect(match).toBeDefined();
    expect(match!.message).toContain('diag-1');
  });
});

describe('DiagramCanvas handler — canvasId injection', () => {
  beforeAll(() => {
    registerDiagramHandlers();
  });

  it('injects canvasId from <DiagramCanvas id="..."> into each default action', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        DiagramCanvas, { id: 'my-canvas', theme: themeWithInput },
        React.createElement(
          Diagram, { id: 'diag-1' },
          React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
        ),
      ),
    );
    const registry = new WidgetRegistry();
    const { frame } = resolveSceneFromDsl(
      tree,
      { sceneIndex: 0, numScenes: 1, assetsReady: false },
      registry,
    );
    const state = frame.widgets['my-canvas'] as { defaultInputActions?: InputActionSpec[] } | undefined;
    expect(state?.defaultInputActions).toBeDefined();
    expect(state!.defaultInputActions).toHaveLength(1);
    expect(state!.defaultInputActions![0]!.canvasId).toBe('my-canvas');
    expect(state!.defaultInputActions![0]!.id).toBe('move');
  });

  it('produces undefined defaultInputActions when no theme.input on canvas', () => {
    const tree = React.createElement(
      Scene, { id: 's1' },
      React.createElement(
        DiagramCanvas, { id: 'my-canvas', theme: darkGlassTheme },
        React.createElement(
          Diagram, { id: 'diag-1' },
          React.createElement(DiagramNode, { id: 'n1', label: 'A', position: [0, 0, 0] as [number, number, number] }),
        ),
      ),
    );
    const registry = new WidgetRegistry();
    const { frame } = resolveSceneFromDsl(
      tree,
      { sceneIndex: 0, numScenes: 1, assetsReady: false },
      registry,
    );
    const state = frame.widgets['my-canvas'] as { defaultInputActions?: InputActionSpec[] } | undefined;
    expect(state?.defaultInputActions).toBeUndefined();
  });
});
