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
