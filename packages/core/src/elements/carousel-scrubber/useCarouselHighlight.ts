// React hook for programmatic carousel tray highlight control.

import { useCallback } from 'react';
import type { ViewHighlightConfig } from './types';
import type { WidgetRegistry } from '../../widget/WidgetRegistry';
import { CarouselScrubberWidget } from './CarouselScrubberWidget';

/**
 * Creates highlight control functions for a carousel tray.
 *
 * Call with a WidgetRegistry reference (from SceneEngine, SceneEngine, or plugin).
 * The tray widget is looked up using the `${layoutId}__tray` naming convention.
 *
 * @param registry - The engine's WidgetRegistry.
 * @param layoutId - The ViewLayout id that owns the carousel tray.
 *
 * @example
 * // In a React component inside SceneEngine:
 * const controls = useCarouselHighlight(registry, 'my-carousel');
 *
 * // Highlight a specific view
 * controls.setHighlight({ viewId: 'chart-3', mode: 'holographic', color: '#ff0000' });
 *
 * // Multiple views simultaneously
 * controls.setHighlight({ viewId: 'chart-1', mode: 'glow', color: '#00ff00' });
 *
 * // Remove one
 * controls.clearHighlight('chart-3');
 *
 * // Remove all
 * controls.clearAll();
 */
export function useCarouselHighlight(
  registry: WidgetRegistry | null | undefined,
  layoutId: string,
): {
  setHighlight: (config: ViewHighlightConfig) => void;
  clearHighlight: (viewId: string) => void;
  clearAll: () => void;
} {
  const getTrayWidget = useCallback((): CarouselScrubberWidget | null => {
    if (!registry) return null;
    const widget = registry.get(`${layoutId}__tray`);
    if (!widget || !(widget instanceof CarouselScrubberWidget)) return null;
    return widget;
  }, [registry, layoutId]);

  const setHighlight = useCallback((config: ViewHighlightConfig) => {
    getTrayWidget()?.setHighlight(config);
  }, [getTrayWidget]);

  const clearHighlight = useCallback((viewId: string) => {
    getTrayWidget()?.clearHighlight(viewId);
  }, [getTrayWidget]);

  const clearAll = useCallback(() => {
    getTrayWidget()?.clearAllHighlights();
  }, [getTrayWidget]);

  return { setHighlight, clearHighlight, clearAll };
}

/**
 * Non-React imperative API for programmatic highlight control.
 * Use when you don't have React context (e.g., in a callback, timer, WebSocket handler).
 *
 * @example
 * const controls = createCarouselHighlightController(registry, 'my-carousel');
 * controls.setHighlight({ viewId: 'chart-3', mode: 'holographic', color: '#ff0000' });
 */
export function createCarouselHighlightController(
  registry: WidgetRegistry,
  layoutId: string,
): {
  setHighlight: (config: ViewHighlightConfig) => void;
  clearHighlight: (viewId: string) => void;
  clearAll: () => void;
} {
  const getWidget = (): CarouselScrubberWidget | null => {
    const widget = registry.get(`${layoutId}__tray`);
    if (!widget || !(widget instanceof CarouselScrubberWidget)) return null;
    return widget;
  };

  return {
    setHighlight: (config) => getWidget()?.setHighlight(config),
    clearHighlight: (viewId) => getWidget()?.clearHighlight(viewId),
    clearAll: () => getWidget()?.clearAllHighlights(),
  };
}
