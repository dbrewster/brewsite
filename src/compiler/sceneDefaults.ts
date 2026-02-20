import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { SceneFrame } from './sceneTrackTypes';
import type { SceneFrameContext } from './sceneTypes';

/**
 * Creates a base SceneFrame with all widget default states from registry.
 *
 * When a SceneFrameContext is provided the frame's scrollProgress is seeded
 * from context.sceneProgress so callers get contextually-correct defaults
 * without separate initialisation.
 */
export const createBaseSceneState = (
  widgetRegistry: WidgetRegistry,
  context?: SceneFrameContext,
): SceneFrame => {
  const frame: SceneFrame = {
    id: context?.baseState?.id ?? '',
    scrollProgress: context?.sceneProgress ?? 0,
    widgets: {},
  };

  for (const element of widgetRegistry.getSceneElements()) {
    frame.widgets[element.widgetId] = structuredClone(element.defaultState);
  }

  return frame;
};
