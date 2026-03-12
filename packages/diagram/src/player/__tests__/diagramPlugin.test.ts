// Tests for diagramPlugin() — verifies createWidgets(), registerHandlers() behave correctly.

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { WidgetRegistry } from '@brewsite/core';
import { compileSceneTrack } from '../../../../core/src/compiler/sceneTrackCompiler';
import { clearRegistry } from '../../../../core/src/compiler/registry';
import { resetCoreHandlerRegistrationForTesting } from '../../../../core/src/compiler/coreHandlers';
import { diagramPlugin } from '../diagramPlugin';
import { DiagramWidget } from '../../elements/diagram/widget';
import { Diagram, DiagramNode, ManualLayout } from '../../elements/diagram/widget';
import { Scene } from '@brewsite/core';
import type { DiagramState } from '../../elements/diagram/types';

beforeEach(() => {
  clearRegistry();
  resetCoreHandlerRegistrationForTesting();
});

describe('diagramPlugin', () => {
  describe('createWidgets()', () => {
    it('returns one DiagramWidget per diagram ID', () => {
      const plugin = diagramPlugin({ diagrams: ['diag-a', 'diag-b'] });
      const widgets = plugin.createWidgets();

      expect(widgets).toHaveLength(2);
    });

    it('returns DiagramWidget instances', () => {
      const plugin = diagramPlugin({ diagrams: ['diag-a', 'diag-b'] });
      const widgets = plugin.createWidgets();

      expect(widgets[0]).toBeInstanceOf(DiagramWidget);
      expect(widgets[1]).toBeInstanceOf(DiagramWidget);
    });

    it('sets widgetId to the diagram ID on each widget', () => {
      const plugin = diagramPlugin({ diagrams: ['diag-a', 'diag-b'] });
      const widgets = plugin.createWidgets();

      expect(widgets[0]!.widgetId).toBe('diag-a');
      expect(widgets[1]!.widgetId).toBe('diag-b');
    });

    it('sets defaultState.id to the diagram ID on each widget', () => {
      const plugin = diagramPlugin({ diagrams: ['diag-a', 'diag-b'] });
      const widgets = plugin.createWidgets();

      const w0 = widgets[0] as DiagramWidget;
      const w1 = widgets[1] as DiagramWidget;
      expect(w0.defaultState.id).toBe('diag-a');
      expect(w1.defaultState.id).toBe('diag-b');
    });

    it('returns an empty array when diagrams is empty', () => {
      const plugin = diagramPlugin({ diagrams: [] });
      const widgets = plugin.createWidgets();

      expect(widgets).toHaveLength(0);
    });
  });

  describe('registerHandlers()', () => {
    it('is callable without error', () => {
      const plugin = diagramPlugin({ diagrams: [] });
      expect(() => plugin.registerHandlers()).not.toThrow();
    });
  });

  describe('getActionInputExtension()', () => {
    it('returns an object with an onUnknownAction callback', () => {
      const plugin = diagramPlugin({ diagrams: ['canvas-1'] });
      const registry = new WidgetRegistry();
      for (const w of plugin.createWidgets()) registry.register(w);

      const ext = plugin.getActionInputExtension!(registry);

      expect(ext).toBeDefined();
      expect(typeof ext.onUnknownAction).toBe('function');
    });

    it('calls applyCanvasAction("move") with correct args for diagram-canvas.move', () => {
      const plugin = diagramPlugin({ diagrams: ['canvas-1'] });
      const registry = new WidgetRegistry();
      const widgets = plugin.createWidgets();
      const widget = widgets[0] as DiagramWidget;
      registry.register(widget);

      const calls: Array<[string, number, number, number, [number, number] | undefined]> = [];
      widget.applyCanvasAction = (action, dx, dy, speed, focusCenter) => {
        calls.push([action, dx, dy, speed, focusCenter]);
      };

      const ext = plugin.getActionInputExtension!(registry);
      ext.onUnknownAction!('diagram-canvas.move', 'canvas-1', {} as Event, { dx: 10, dy: 5, speed: 2 });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual(['move', 10, 5, 2, undefined]);
    });

    it('calls applyCanvasAction("rotate") for diagram-canvas.rotate', () => {
      const plugin = diagramPlugin({ diagrams: ['canvas-1'] });
      const registry = new WidgetRegistry();
      const widgets = plugin.createWidgets();
      const widget = widgets[0] as DiagramWidget;
      registry.register(widget);

      const calls: Array<[string, number, number, number]> = [];
      widget.applyCanvasAction = (action, dx, dy, speed) => {
        calls.push([action, dx, dy, speed]);
      };

      const ext = plugin.getActionInputExtension!(registry);
      ext.onUnknownAction!('diagram-canvas.rotate', 'canvas-1', {} as Event, { dx: -3, dy: 7, speed: 1.5 });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual(['rotate', -3, 7, 1.5]);
    });

    it('calls applyCanvasAction("focus") with focusCenter for diagram-canvas.focus', () => {
      const plugin = diagramPlugin({ diagrams: ['canvas-1'] });
      const registry = new WidgetRegistry();
      const widgets = plugin.createWidgets();
      const widget = widgets[0] as DiagramWidget;
      registry.register(widget);

      const calls: Array<[string, number, number, number, [number, number] | undefined]> = [];
      widget.applyCanvasAction = (action, dx, dy, speed, focusCenter) => {
        calls.push([action, dx, dy, speed, focusCenter]);
      };

      const ext = plugin.getActionInputExtension!(registry);
      const center: [number, number] = [0.5, 0.5];
      ext.onUnknownAction!('diagram-canvas.focus', 'canvas-1', {} as Event, { speed: 1, focusCenter: center });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual(['focus', 0, 0, 1, center]);
    });

    it('calls applyCanvasAction("reset") for diagram-canvas.reset', () => {
      const plugin = diagramPlugin({ diagrams: ['canvas-1'] });
      const registry = new WidgetRegistry();
      const widgets = plugin.createWidgets();
      const widget = widgets[0] as DiagramWidget;
      registry.register(widget);

      const calls: Array<[string, number, number, number]> = [];
      widget.applyCanvasAction = (action, dx, dy, speed) => {
        calls.push([action, dx, dy, speed]);
      };

      const ext = plugin.getActionInputExtension!(registry);
      ext.onUnknownAction!('diagram-canvas.reset', 'canvas-1', {} as Event, { speed: 1 });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual(['reset', 0, 0, 1]);
    });

    it('silently ignores when canvasId is undefined', () => {
      const plugin = diagramPlugin({ diagrams: ['canvas-1'] });
      const registry = new WidgetRegistry();
      for (const w of plugin.createWidgets()) registry.register(w);

      const ext = plugin.getActionInputExtension!(registry);
      expect(() =>
        ext.onUnknownAction!('diagram-canvas.move', undefined, {} as Event, { dx: 1, dy: 1, speed: 1 }),
      ).not.toThrow();
    });

    it('silently ignores when the widget is not found in the registry', () => {
      const plugin = diagramPlugin({ diagrams: ['canvas-1'] });
      const registry = new WidgetRegistry();
      for (const w of plugin.createWidgets()) registry.register(w);

      const ext = plugin.getActionInputExtension!(registry);
      expect(() =>
        ext.onUnknownAction!('diagram-canvas.move', 'nonexistent-canvas', {} as Event, { dx: 1, dy: 1, speed: 1 }),
      ).not.toThrow();
    });

    it('silently ignores unknown action types', () => {
      const plugin = diagramPlugin({ diagrams: ['canvas-1'] });
      const registry = new WidgetRegistry();
      const widgets = plugin.createWidgets();
      const widget = widgets[0] as DiagramWidget;
      registry.register(widget);

      const calls: string[] = [];
      widget.applyCanvasAction = (action) => { calls.push(action); };

      const ext = plugin.getActionInputExtension!(registry);
      ext.onUnknownAction!('some-other.action', 'canvas-1', {} as Event, { speed: 1 });

      expect(calls).toHaveLength(0);
    });
  });

  describe('DiagramWidget.applyCanvasAction()', () => {
    it('accumulates pan delta for move action', () => {
      const plugin = diagramPlugin({ diagrams: ['d1'] });
      const widget = plugin.createWidgets()[0] as DiagramWidget;

      // Two consecutive moves should accumulate.
      widget.applyCanvasAction('move', 100, 0, 1);
      widget.applyCanvasAction('move', 50, 0, 1);

      // Pan is stored internally; verify by reading private field via cast.
      const pan = (widget as unknown as { _canvasPan: { x: number; y: number } })._canvasPan;
      expect(pan.x).toBeCloseTo(0.15);
      expect(pan.y).toBeCloseTo(0);
    });

    it('accumulates tilt delta for rotate action', () => {
      const plugin = diagramPlugin({ diagrams: ['d1'] });
      const widget = plugin.createWidgets()[0] as DiagramWidget;

      widget.applyCanvasAction('rotate', 0, 200, 1);

      const tilt = (widget as unknown as { _tiltDelta: { x: number; y: number } })._tiltDelta;
      expect(tilt.x).toBeCloseTo(0.6);
      expect(tilt.y).toBeCloseTo(0);
    });

    it('resets pan and tilt deltas on reset action', () => {
      const plugin = diagramPlugin({ diagrams: ['d1'] });
      const widget = plugin.createWidgets()[0] as DiagramWidget;

      widget.applyCanvasAction('move', 100, 100, 1);
      widget.applyCanvasAction('rotate', 50, 50, 1);
      widget.applyCanvasAction('reset', 0, 0, 1);

      const pan = (widget as unknown as { _canvasPan: { x: number; y: number } })._canvasPan;
      const tilt = (widget as unknown as { _tiltDelta: { x: number; y: number } })._tiltDelta;
      expect(pan.x).toBe(0);
      expect(pan.y).toBe(0);
      expect(tilt.x).toBe(0);
      expect(tilt.y).toBe(0);
    });
  });

  describe('DSL compilation — state written by diagram ID', () => {
    it('writes DiagramState keyed by diagram ID into compiled SceneTrack ticks', () => {
      const plugin = diagramPlugin({ diagrams: [] });

      // Register handlers so compileSceneTrack can process diagram DSL nodes.
      plugin.registerHandlers();

      const registry = new WidgetRegistry();

      const scenes = [
        {
          id: 'scene-a',
          getFrame: () =>
            React.createElement(
              Scene,
              { id: 'scene-a' },
              React.createElement(
                Diagram,
                { id: 'diag-1' },
                React.createElement(ManualLayout, null),
                React.createElement(DiagramNode, { id: 'n1', label: 'Node 1', position: [0, 0, 0] }),
              ),
            ),
        },
      ];

      const track = compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

      // A single-scene track has exactly one tick (no transitions).
      expect(track.ticks).toHaveLength(1);

      const tick = track.ticks[0]!;
      const diagramState = tick.state.widgets['diag-1'] as DiagramState | undefined;

      expect(diagramState).toBeDefined();
      expect(diagramState!.id).toBe('diag-1');
      expect(diagramState!.nodes).toHaveLength(1);
    });
  });
});
