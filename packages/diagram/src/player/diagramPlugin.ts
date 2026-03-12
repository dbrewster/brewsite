// Factory for the @brewsite/diagram WidgetPlugin.
// Creates DiagramWidget instances for each declared diagram ID.

import type { WidgetPlugin } from '@brewsite/core';
import { registerDiagramHandlers } from '../compiler/handlers';
import { DiagramWidget } from '../elements/diagram/widget';
import { buildThemeRenderConfig } from '../elements/diagram/compiler/themeResolver';
import { darkGlassTheme } from '../elements/diagram/themes';
import type { DiagramState } from '../elements/diagram/types';

/**
 * Options for the @brewsite/diagram WidgetPlugin.
 *
 * Declare every diagram ID used in the scene DSL so that DiagramWidget
 * instances are created before the runtime is constructed. This ensures
 * initialize() is called on each widget at engine startup.
 */
export type DiagramPluginOptions = {
  /**
   * The widget IDs of every <Diagram> used in the scene DSL.
   * A DiagramWidget is created for each ID.
   *
   * Use the id prop value exactly as written in the JSX:
   *   <Diagram id="my-diagram"> → diagrams: ['my-diagram']
   */
  diagrams: readonly string[];
};

/**
 * WidgetPlugin for @brewsite/diagram.
 *
 * Pass the id of every <Diagram> used in your scene DSL.
 * The plugin creates one DiagramWidget per ID.
 *
 * @example
 * plugins={[
 *   corePlugin(),
 *   modelPlugin({ manifestUrl: '...' }),
 *   diagramPlugin({ diagrams: ['my-diagram', 'detail-diagram'] }),
 * ]}
 */
export function diagramPlugin(options: DiagramPluginOptions): WidgetPlugin {
  return {
    createWidgets(): DiagramWidget[] {
      return options.diagrams.map((id) => {
        const defaultState = makeDefaultDiagramState(id);
        return new DiagramWidget(id, defaultState);
      });
    },

    registerHandlers(): void {
      registerDiagramHandlers();
    },

    configureRegistry(): void {
      // No-op. Handler registration happened in registerHandlers().
      // Widgets are created in createWidgets() and already in the registry.
    },

    getActionInputExtension(registry) {
      return {
        onUnknownAction: (type, canvasId, _event, extra) => {
          if (!canvasId) return;
          const widget = registry.get(canvasId);
          if (!widget || !('applyCanvasAction' in widget)) return;

          const dx = (extra['dx'] as number) ?? 0;
          const dy = (extra['dy'] as number) ?? 0;
          const speed = (extra['speed'] as number) ?? 1;

          switch (type) {
            case 'diagram-canvas.move':
              (widget as DiagramWidget).applyCanvasAction('move', dx, dy, speed);
              break;
            case 'diagram-canvas.rotate':
              (widget as DiagramWidget).applyCanvasAction('rotate', dx, dy, speed);
              break;
            case 'diagram-canvas.focus':
              (widget as DiagramWidget).applyCanvasAction(
                'focus', 0, 0, 1,
                extra['focusCenter'] as [number, number] | undefined,
              );
              break;
            case 'diagram-canvas.reset':
              (widget as DiagramWidget).applyCanvasAction('reset', 0, 0, 1);
              break;
          }
        },
      };
    },
  };
}

/**
 * Creates a default DiagramState for use as the DiagramWidget's initial state.
 * All fields are set to safe defaults; the actual state comes from compiled DSL.
 */
function makeDefaultDiagramState(id: string): DiagramState {
  return {
    id,
    viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: [0, 0, 0],
    z: 0,
    scale: 1,
    contentAspect: 1.0,
    nodes: [],
    edges: [],
    groups: [],
    exit: undefined,
    enter: undefined,
    themeConfig: buildThemeRenderConfig(darkGlassTheme),
  };
}
