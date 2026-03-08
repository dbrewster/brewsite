// Factory for the @brewsite/diagram WidgetPlugin.
// Widget instances are constructed from declared canvas IDs and returned from
// createWidgets() so the runtime can initialize them before scene compilation runs.

import type { WidgetPlugin, WidgetRegistry } from '@brewsite/core';
import { registerDiagramHandlers } from '../compiler/handlers';
import { compileCanvas } from '../elements/diagram/canvas/compile';
import { DiagramCanvasWidget } from '../elements/diagram/canvas/widget';

/**
 * Options for the @brewsite/diagram WidgetPlugin.
 *
 * Declare every canvas ID used in the scene DSL so that DiagramCanvasWidget
 * instances are created before the runtime is constructed. This ensures
 * initialize() is called on each widget at engine startup.
 */
export type DiagramPluginOptions = {
  /**
   * The widgetIds of every DiagramCanvas (or standalone Diagram) used in the
   * scene DSL. A DiagramCanvasWidget is created for each ID and returned from
   * createWidgets() so the runtime can call initialize() on them before
   * scene compilation runs.
   *
   * Use the id prop value exactly as written in the JSX:
   *   <DiagramCanvas id="my-canvas"> → canvases: ['my-canvas']
   *   <Diagram id="my-diagram">      → canvases: ['my-diagram']
   */
  canvases: readonly string[];
};

/**
 * WidgetPlugin for @brewsite/diagram.
 *
 * Pass the id of every <DiagramCanvas> or standalone <Diagram> used in your
 * scene DSL. The plugin creates one DiagramCanvasWidget per ID and returns
 * them from createWidgets() so the runtime initializes them before playback.
 *
 * @example
 * plugins={[
 *   corePlugin(),
 *   modelPlugin({ manifestUrl: '...' }),
 *   diagramPlugin({ canvases: ['my-canvas', 'detail-canvas'] }),
 * ]}
 */
export function diagramPlugin(options: DiagramPluginOptions): WidgetPlugin {
  const { canvases } = options;

  return {
    createWidgets: () => {
      return canvases.map((id) => {
        const defaultState = compileCanvas({ id }, [], []);
        return new DiagramCanvasWidget(id, defaultState);
      });
    },

    registerHandlers: () => {
      registerDiagramHandlers();
    },

    configureRegistry: () => {
      // No-op. Handler registration happened in registerHandlers().
      // Auto-registration of widgets no longer happens here — widgets
      // are created in createWidgets() and are already in the registry
      // by the time configureRegistry() is called.
    },

    getActionInputExtension(registry: WidgetRegistry) {
      return {
        onUnknownAction: (
          type: string,
          canvasId: string | undefined,
          event: PointerEvent | WheelEvent | KeyboardEvent | MouseEvent,
          extra: Record<string, unknown>,
        ) => {
          const canvas = canvasId
            ? (registry.get(canvasId) as DiagramCanvasWidget | undefined)
            : undefined;
          if (!canvas) return;

          switch (type) {
            case 'diagram-canvas.move':
              canvas.handleMove(event as PointerEvent | WheelEvent, extra.speed as number | undefined);
              break;
            case 'diagram-canvas.rotate':
              canvas.handleRotate(event as PointerEvent | WheelEvent, extra.speed as number | undefined);
              break;
            case 'diagram-canvas.reset':
              canvas.handleReset();
              break;
            case 'diagram-canvas.focus':
              canvas.handleFocus(
                event as PointerEvent | MouseEvent,
                extra.focusCenter as [number, number] | [number, number, number] | undefined,
              );
              break;
          }
        },
      };
    },
  };
}
