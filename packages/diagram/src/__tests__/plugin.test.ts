// Tests for diagramPlugin factory — lazy widget registration

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { diagramPlugin } from '../player/diagramPlugin';
import { DiagramWidget, Diagram, DiagramNode, ManualLayout } from '../elements/diagram/widget';
import { WidgetRegistry } from '@brewsite/core';
import { compileSceneTrack } from '../../../core/src/compiler/sceneTrackCompiler';
import { clearRegistry } from '../../../core/src/compiler/registry';
import { resetCoreHandlerRegistrationForTesting } from '../../../core/src/compiler/coreHandlers';
import { Scene } from '@brewsite/core';

beforeEach(() => {
  clearRegistry();
  resetCoreHandlerRegistrationForTesting();
});

describe('diagramPlugin', () => {
  it('createWidgets() returns an empty array (lazy registration)', () => {
    const plugin = diagramPlugin();
    expect(plugin.createWidgets()).toHaveLength(0);
  });

  it('lazily creates a DiagramWidget in the registry after compilation', () => {
    const plugin = diagramPlugin();
    plugin.registerHandlers();
    const registry = new WidgetRegistry();
    plugin.configureRegistry!(registry, null);

    const scenes = [
      {
        id: 'scene-a',
        getFrame: () =>
          React.createElement(
            Scene,
            { id: 'scene-a' },
            React.createElement(
              Diagram,
              { id: 'id-a' },
              React.createElement(ManualLayout, null),
              React.createElement(DiagramNode, { id: 'n1', label: 'Node 1', position: [0, 0, 0] }),
            ),
          ),
      },
    ];

    compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

    expect(registry.get('id-a')).toBeInstanceOf(DiagramWidget);
    expect(registry.get('id-a')?.widgetId).toBe('id-a');
  });

  it('lazily creates one DiagramWidget per unique diagram ID encountered in DSL', () => {
    const plugin = diagramPlugin();
    plugin.registerHandlers();
    const registry = new WidgetRegistry();
    plugin.configureRegistry!(registry, null);

    const scenes = [
      {
        id: 'scene-a',
        getFrame: () =>
          React.createElement(
            Scene,
            { id: 'scene-a' },
            React.createElement(
              Diagram,
              { id: 'x' },
              React.createElement(ManualLayout, null),
              React.createElement(DiagramNode, { id: 'n1', label: 'N1', position: [0, 0, 0] }),
            ),
          ),
      },
      {
        id: 'scene-b',
        getFrame: () =>
          React.createElement(
            Scene,
            { id: 'scene-b' },
            React.createElement(
              Diagram,
              { id: 'y' },
              React.createElement(ManualLayout, null),
              React.createElement(DiagramNode, { id: 'n2', label: 'N2', position: [0, 0, 0] }),
            ),
          ),
      },
    ];

    compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 2 });

    const allWidgets = [...registry.getAllWidgets()];
    const diagramWidgets = allWidgets.filter(w => w instanceof DiagramWidget);
    expect(diagramWidgets).toHaveLength(2);
    expect(registry.get('x')).toBeInstanceOf(DiagramWidget);
    expect(registry.get('y')).toBeInstanceOf(DiagramWidget);
  });
});
