// Tests for diagramPlugin() — verifies createWidgets(), registerHandlers(), and
// getActionInputExtension() behave correctly.

import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  describe('getActionInputExtension()', () => {
    /** Creates a minimal mock event object for test routing assertions. */
    const mockPointerEvent = () => ({ type: 'pointermove', movementX: 0, movementY: 0 }) as unknown as PointerEvent;
    const mockKeyEvent = () => ({ type: 'keydown' }) as unknown as KeyboardEvent;
    const mockMouseEvent = (clientX = 0, clientY = 0) =>
      ({ type: 'click', clientX, clientY }) as unknown as MouseEvent;

    it('routes diagram-canvas.move to canvas.handleMove', () => {
      const plugin = diagramPlugin({ canvases: ['canvas-a'] });
      const registry = new WidgetRegistry();
      for (const widget of plugin.createWidgets()) {
        registry.register(widget);
      }

      const canvas = registry.get('canvas-a') as DiagramCanvasWidget;
      const handleMoveSpy = vi.spyOn(canvas, 'handleMove');

      const ext = plugin.getActionInputExtension!(registry);
      const event = mockPointerEvent();

      ext.onUnknownAction!('diagram-canvas.move', 'canvas-a', event, { speed: 1 });

      expect(handleMoveSpy).toHaveBeenCalledTimes(1);
      expect(handleMoveSpy).toHaveBeenCalledWith(event, 1);
    });

    it('routes diagram-canvas.reset to canvas.handleReset', () => {
      const plugin = diagramPlugin({ canvases: ['canvas-a'] });
      const registry = new WidgetRegistry();
      for (const widget of plugin.createWidgets()) {
        registry.register(widget);
      }

      const canvas = registry.get('canvas-a') as DiagramCanvasWidget;
      const handleResetSpy = vi.spyOn(canvas, 'handleReset');

      const ext = plugin.getActionInputExtension!(registry);
      const event = mockKeyEvent();

      ext.onUnknownAction!('diagram-canvas.reset', 'canvas-a', event, {});

      expect(handleResetSpy).toHaveBeenCalledTimes(1);
    });

    it('routes diagram-canvas.rotate to canvas.handleRotate', () => {
      const plugin = diagramPlugin({ canvases: ['canvas-a'] });
      const registry = new WidgetRegistry();
      for (const widget of plugin.createWidgets()) {
        registry.register(widget);
      }

      const canvas = registry.get('canvas-a') as DiagramCanvasWidget;
      const handleRotateSpy = vi.spyOn(canvas, 'handleRotate');

      const ext = plugin.getActionInputExtension!(registry);
      const event = mockPointerEvent();

      ext.onUnknownAction!('diagram-canvas.rotate', 'canvas-a', event, { speed: 2 });

      expect(handleRotateSpy).toHaveBeenCalledTimes(1);
      expect(handleRotateSpy).toHaveBeenCalledWith(event, 2);
    });

    it('routes diagram-canvas.focus to canvas.handleFocus with focusCenter', () => {
      const plugin = diagramPlugin({ canvases: ['canvas-a'] });
      const registry = new WidgetRegistry();
      for (const widget of plugin.createWidgets()) {
        registry.register(widget);
      }

      const canvas = registry.get('canvas-a') as DiagramCanvasWidget;
      const handleFocusSpy = vi.spyOn(canvas, 'handleFocus');

      const ext = plugin.getActionInputExtension!(registry);
      const event = mockMouseEvent(100, 200);
      const focusCenter: [number, number] = [0.5, 0.5];

      ext.onUnknownAction!('diagram-canvas.focus', 'canvas-a', event, { focusCenter });

      expect(handleFocusSpy).toHaveBeenCalledTimes(1);
      expect(handleFocusSpy).toHaveBeenCalledWith(event, focusCenter);
    });

    it('is a no-op when canvasId is undefined', () => {
      const plugin = diagramPlugin({ canvases: ['canvas-a'] });
      const registry = new WidgetRegistry();
      for (const widget of plugin.createWidgets()) {
        registry.register(widget);
      }

      const canvas = registry.get('canvas-a') as DiagramCanvasWidget;
      const handleMoveSpy = vi.spyOn(canvas, 'handleMove');

      const ext = plugin.getActionInputExtension!(registry);
      const event = mockPointerEvent();

      // canvasId is undefined — should not throw and should not call any method
      expect(() => {
        ext.onUnknownAction!('diagram-canvas.move', undefined, event, { speed: 1 });
      }).not.toThrow();
      expect(handleMoveSpy).not.toHaveBeenCalled();
    });

    it('is a no-op when canvasId does not match a registered widget', () => {
      const plugin = diagramPlugin({ canvases: ['canvas-a'] });
      const registry = new WidgetRegistry();
      for (const widget of plugin.createWidgets()) {
        registry.register(widget);
      }

      const canvas = registry.get('canvas-a') as DiagramCanvasWidget;
      const handleMoveSpy = vi.spyOn(canvas, 'handleMove');

      const ext = plugin.getActionInputExtension!(registry);
      const event = mockPointerEvent();

      // Unknown canvas ID — should not throw
      expect(() => {
        ext.onUnknownAction!('diagram-canvas.move', 'unknown-canvas', event, { speed: 1 });
      }).not.toThrow();
      expect(handleMoveSpy).not.toHaveBeenCalled();
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
