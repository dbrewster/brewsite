import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { SceneDefinition } from './sceneTypes';
import type { SceneTimeline } from '../timeline';
import type { SceneTrack } from './sceneTrackTypes';
import type { ClipMeta } from '../elements/model/types';

const trackCache = new Map<string, SceneTrack>();

/**
 * Build a cache key for scene track compilation.
 * Includes scene IDs, timeline configuration, widget registry state, and options.
 */
export const buildSceneTrackKey = (options: {
  scenes: SceneDefinition[];
  timeline: SceneTimeline;
  widgetRegistry: WidgetRegistry;
  prefersReducedMotion: boolean;
  assetsReady: boolean;
}): string => {
  const sceneIds = options.scenes.map((s) => s.id).join('|');
  const timelineKey = `t:${options.timeline.sceneCount}|${options.timeline.subTickCount}`;
  const widgetKey = `w:${options.widgetRegistry.buildCacheKey()}`;
  const rmKey = `rm:${options.prefersReducedMotion ? 1 : 0}`;
  const asKey = `ar:${options.assetsReady ? 1 : 0}`;
  return [sceneIds, timelineKey, widgetKey, rmKey, asKey].join('::');
};

/**
 * Get cached scene track if available.
 */
export const getCachedTrack = (key: string): SceneTrack | undefined => trackCache.get(key);

/**
 * Cache a compiled scene track.
 */
export const setCachedTrack = (key: string, track: SceneTrack): void => {
  trackCache.set(key, track);
};

/**
 * Clear the scene track cache.
 */
export const clearCache = (): void => {
  trackCache.clear();
};
