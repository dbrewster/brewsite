import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { SceneDefinition } from './sceneTypes';
import type { SceneTrack } from './sceneTrackTypes';

const trackCache = new Map<string, SceneTrack>();

/**
 * Build a cache key for scene track compilation.
 * Includes scene IDs, blockSize, widget registry state, and options.
 */
export const buildSceneTrackKey = (options: {
  scenes: SceneDefinition[];
  widgetRegistry: WidgetRegistry;
  blockSize: number;
  prefersReducedMotion: boolean;
}): string => {
  const sceneIds = options.scenes.map((s) => s.id).join('|');
  const blockKey = `b:${options.blockSize}`;
  const widgetKey = `w:${options.widgetRegistry.buildCacheKey()}`;
  const rmKey = `rm:${options.prefersReducedMotion ? 1 : 0}`;
  return [sceneIds, blockKey, widgetKey, rmKey].join('::');
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
