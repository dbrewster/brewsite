// Factory for the @brewsite/diagram WidgetPlugin.
// Provides auto-registration of DiagramCanvasWidget instances during compilation.

import type { WidgetPlugin, WidgetRegistry } from '@brewsite/core';
import { registerDiagramHandlers } from '../compiler/handlers';

/**
 * WidgetPlugin for @brewsite/diagram.
 *
 * Provides DiagramCanvasWidget auto-registration: any `<DiagramCanvas>` or
 * standalone `<Diagram>` element encountered during scene compilation will
 * automatically create and register a `DiagramCanvasWidget` — no manual
 * pre-registration in `widgetSetup.ts` is required.
 *
 * Call `registerHandlers()` alone (or import `@brewsite/diagram`) for compilation
 * without a live registry (e.g., in unit tests). Call the full plugin for production.
 *
 * @example
 * <EngineProvider
 *   plugins={[corePlugin(), modelPlugin({ manifestUrl: '...' }), diagramPlugin()]}
 * />
 */
export function diagramPlugin(): WidgetPlugin {
  return {
    createWidgets: () => [],

    registerHandlers: () => {
      // Installs handlers without registry access.
      // register.ts (side-effect import) may have already done this — safe to call again.
      registerDiagramHandlers();
    },

    configureRegistry: (registry: WidgetRegistry) => {
      // Re-register handlers with registry access.
      // registerNode() uses Map.set() — this OVERWRITES the registry-less handlers
      // installed by registerHandlers() with new closures that capture `registry`.
      // After this call, any DiagramCanvas or Diagram handler that fires during
      // compilation will auto-register a DiagramCanvasWidget if one isn't present.
      registerDiagramHandlers(registry);
    },
  };
}
