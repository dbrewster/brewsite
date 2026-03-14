// Factory for the @brewsite/diagram WidgetPlugin.
// DiagramWidget instances are created lazily on first DSL encounter during compilation.

import type { WidgetPlugin, WidgetRegistry } from '@brewsite/core';
import { registerDiagramHandlers } from '../compiler/handlers';
import { DiagramWidget } from '../elements/diagram/widget';

/**
 * Options for the @brewsite/diagram WidgetPlugin.
 */
export type DiagramPluginOptions = {
  /**
   * @deprecated Since v0.x. DiagramWidget instances are now created lazily on
   * first DSL encounter during compilation. This field is no longer needed and
   * will be removed in a future major release.
   *
   * Remove the `diagrams` array from your diagramPlugin() call:
   *   Before: diagramPlugin({ diagrams: ['my-diagram'] })
   *   After:  diagramPlugin()
   */
  diagrams?: readonly string[];
};

/**
 * WidgetPlugin for @brewsite/diagram.
 *
 * No configuration required. DiagramWidget instances are created automatically
 * for each <Diagram id="..."> encountered in the scene DSL during compilation.
 *
 * @example
 * plugins={[
 *   corePlugin(),
 *   modelPlugin({ manifestUrl: '...' }),
 *   diagramPlugin(),
 * ]}
 */
export function diagramPlugin(options: DiagramPluginOptions = {}): WidgetPlugin {
  if (options.diagrams && options.diagrams.length > 0) {
    console.warn(
      '[diagramPlugin] The `diagrams` option is deprecated and no longer needed. ' +
        'DiagramWidget instances are now created automatically on first DSL encounter. ' +
        'Remove the `diagrams` array from your diagramPlugin() call.',
    );
  }

  return {
    createWidgets(): DiagramWidget[] {
      // DiagramWidget instances are created lazily via the Diagram node handler
      // in configureRegistry(). No pre-declaration of diagram IDs is required.
      return [];
    },

    registerHandlers(): void {
      registerDiagramHandlers(); // baseline handler + child component handlers, no registry
    },

    configureRegistry(registry: WidgetRegistry): void {
      // Re-register the Diagram handler with registry access for lazy widget creation.
      // registerNode() overwrites the baseline handler installed by registerHandlers()
      // (or register.ts side-effect) with this registry-aware version.
      registerDiagramHandlers(registry);
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
