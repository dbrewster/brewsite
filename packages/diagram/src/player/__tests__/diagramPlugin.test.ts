// Tests for diagramPlugin() — verifies that DiagramCanvasWidget instances are created
// in createWidgets() so the runtime can initialize them before scene compilation.

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { WidgetRegistry } from '@brewsite/core';
import { compileSceneTrack } from '../../../../core/src/compiler/sceneTrackCompiler';
import { clearRegistry } from '../../../../core/src/compiler/registry';
import { resetCoreHandlerRegistrationForTesting } from '../../../../core/src/compiler/coreHandlers';
import { diagramPlugin } from '../diagramPlugin';
import { DiagramCanvasWidget } from '../../elements/diagram/canvas/widget';
import { DiagramCanvas } from '../../elements/diagram/canvas/dsl';
import { Diagram, DiagramNode, ManualLayout } from '../../elements/diagram/dsl';
import { Scene } from '@brewsite/core';
import type { DiagramCanvasState } from '../../elements/diagram/canvas/types';

beforeEach(() => {
  clearRegistry();
  resetCoreHandlerRegistrationForTesting();
});

describe('diagramPlugin', () => {
  describe('createWidgets()', () => {
    it('returns one DiagramCanvasWidget per canvas ID', () => {
      const plugin = diagramPlugin({ canvases: ['canvas-a', 'canvas-b'] });
      const widgets = plugin.createWidgets();

      expect(widgets).toHaveLength(2);
    });

    it('returns DiagramCanvasWidget instances', () => {
      const plugin = diagramPlugin({ canvases: ['canvas-a', 'canvas-b'] });
      const widgets = plugin.createWidgets();

      expect(widgets[0]).toBeInstanceOf(DiagramCanvasWidget);
      expect(widgets[1]).toBeInstanceOf(DiagramCanvasWidget);
    });

    it('sets widgetId to the canvas ID on each widget', () => {
      const plugin = diagramPlugin({ canvases: ['canvas-a', 'canvas-b'] });
      const widgets = plugin.createWidgets();

      expect(widgets[0]!.widgetId).toBe('canvas-a');
      expect(widgets[1]!.widgetId).toBe('canvas-b');
    });

    it('sets defaultState.id to the canvas ID on each widget', () => {
      const plugin = diagramPlugin({ canvases: ['canvas-a', 'canvas-b'] });
      const widgets = plugin.createWidgets();

      const w0 = widgets[0] as DiagramCanvasWidget;
      const w1 = widgets[1] as DiagramCanvasWidget;
      expect(w0.defaultState.id).toBe('canvas-a');
      expect(w1.defaultState.id).toBe('canvas-b');
    });

    it('returns an empty array when canvases is empty', () => {
      const plugin = diagramPlugin({ canvases: [] });
      const widgets = plugin.createWidgets();

      expect(widgets).toHaveLength(0);
    });
  });

  describe('registerHandlers()', () => {
    it('is callable without error', () => {
      const plugin = diagramPlugin({ canvases: [] });

      expect(() => plugin.registerHandlers()).not.toThrow();
    });
  });

  describe('DSL compilation — state written by canvas ID', () => {
    it('writes DiagramCanvasState keyed by canvas ID into compiled SceneTrack ticks', () => {
      const plugin = diagramPlugin({ canvases: ['canvas-a'] });

      // Register handlers so compileSceneTrack can process diagram DSL nodes.
      plugin.registerHandlers();

      // Pre-register the widget as createWidgets() would do at engine startup.
      const registry = new WidgetRegistry();
      for (const widget of plugin.createWidgets()) {
        registry.register(widget);
      }

      const scenes = [
        {
          id: 'scene-a',
          getFrame: () =>
            React.createElement(
              Scene,
              { id: 'scene-a' },
              React.createElement(
                DiagramCanvas,
                { id: 'canvas-a' },
                React.createElement(
                  Diagram,
                  { id: 'diag-1' },
                  React.createElement(ManualLayout, null),
                  React.createElement(DiagramNode, { id: 'n1', label: 'Node 1', position: [0, 0, 0] }),
                ),
              ),
            ),
        },
      ];

      const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

      // A single-scene track has exactly one tick (no transitions).
      expect(track.ticks).toHaveLength(1);

      const tick = track.ticks[0]!;
      const canvasState = tick.state.widgets['canvas-a'] as DiagramCanvasState | undefined;

      expect(canvasState).toBeDefined();
      expect(canvasState!.id).toBe('canvas-a');
      expect(canvasState!.diagrams).toHaveLength(1);
      expect(canvasState!.diagrams[0]!.id).toBe('diag-1');
    });
  });
});
