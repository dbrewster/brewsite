// Tests for auto-registration of DiagramCanvasWidget via diagramPlugin() (Findings 1 + 3).

import { it, expect, beforeEach } from 'vitest';
import React from 'react';
import { WidgetRegistry, Scene } from '@brewsite/core';
import { clearRegistry } from '../../../../core/src/compiler/registry';
import { resetCoreHandlerRegistrationForTesting } from '../../../../core/src/compiler/coreHandlers';
import { registerDiagramHandlers } from '../handlers';
import { DiagramCanvasWidget } from '../../elements/diagram/canvas/widget';
import { DiagramCanvas } from '../../elements/diagram/canvas/dsl';
import { compileCanvas } from '../../elements/diagram/canvas/compile';
import { Diagram, DiagramNode } from '../../elements/diagram/dsl';
import { compileSceneTrack } from '../../../../core/src/compiler/sceneTrackCompiler';
import type { SceneDefinition } from '../../../../core/src/compiler/sceneTypes';

beforeEach(() => {
  clearRegistry();
  // Reset the coreHandlersRegistered guard so registerCoreHandlers() re-runs after clearRegistry().
  resetCoreHandlerRegistrationForTesting();
});

it('DiagramCanvas handler auto-registers DiagramCanvasWidget when registry provided', () => {
  const registry = new WidgetRegistry();
  registerDiagramHandlers(registry);

  const scenes: SceneDefinition[] = [
    {
      id: 's1',
      getFrame: () =>
        React.createElement(
          Scene,
          { id: 's1' },
          React.createElement(
            DiagramCanvas,
            { id: 'my-canvas' },
            React.createElement(
              Diagram,
              { id: 'inner' },
              React.createElement(DiagramNode, { id: 'n1', label: 'Node', position: [0, 0, 0] as [number, number, number] }),
            ),
          ),
        ),
    },
  ];

  compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 10 });

  const widget = registry.get('my-canvas');
  expect(widget).toBeInstanceOf(DiagramCanvasWidget);
  expect(widget?.widgetId).toBe('my-canvas');
});

it('standalone Diagram handler auto-registers DiagramCanvasWidget when registry provided', () => {
  const registry = new WidgetRegistry();
  registerDiagramHandlers(registry);

  const scenes: SceneDefinition[] = [
    {
      id: 's1',
      getFrame: () =>
        React.createElement(
          Scene,
          { id: 's1' },
          React.createElement(
            Diagram,
            { id: 'standalone-diag' },
            React.createElement(DiagramNode, { id: 'n1', label: 'Node', position: [0, 0, 0] as [number, number, number] }),
          ),
        ),
    },
  ];

  compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 10 });

  const widget = registry.get('standalone-diag');
  expect(widget).toBeInstanceOf(DiagramCanvasWidget);
  expect(widget?.widgetId).toBe('standalone-diag');
});

it('does not double-register if widget already exists in registry', () => {
  const registry = new WidgetRegistry();
  registerDiagramHandlers(registry);

  // Pre-register a DiagramCanvasWidget
  const initial = compileCanvas({ id: 'pre-canvas' }, [], []);
  const preWidget = new DiagramCanvasWidget('pre-canvas', initial);
  registry.register(preWidget);

  const scenes: SceneDefinition[] = [
    {
      id: 's1',
      getFrame: () =>
        React.createElement(
          Scene,
          { id: 's1' },
          React.createElement(
            DiagramCanvas,
            { id: 'pre-canvas' },
            React.createElement(
              Diagram,
              { id: 'inner' },
              React.createElement(DiagramNode, { id: 'n1', label: 'Node', position: [0, 0, 0] as [number, number, number] }),
            ),
          ),
        ),
    },
  ];

  compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 10 });

  // Should be the same pre-registered widget instance, not a new one
  expect(registry.get('pre-canvas')).toBe(preWidget);
});
