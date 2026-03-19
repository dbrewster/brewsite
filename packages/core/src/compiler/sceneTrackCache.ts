import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { SceneTrack } from './sceneTrackTypes';
import type { ActiveTheme, SceneTheme } from '../theme/types';

const trackCache = new Map<string, SceneTrack>();

/**
 * Build a cache key for scene track compilation.
 * Includes scene IDs, blockSize, widget registry state, and options.
 */
export const buildSceneTrackKey = (options: {
  scenes: ReadonlyArray<{ readonly contentKey: string }>;
  widgetRegistry: WidgetRegistry;
  blockSize: number;
  prefersReducedMotion: boolean;
  invalidateCacheToken?: number | string;
  activeTheme?: ActiveTheme;
  sceneTheme?: SceneTheme;
}): string => {
  const contentKeys = options.scenes.map((s) => s.contentKey).join('|');
  const blockKey = `b:${options.blockSize}`;
  const widgetKey = `w:${options.widgetRegistry.buildCacheKey()}`;
  const rmKey = `rm:${options.prefersReducedMotion ? 1 : 0}`;
  const tokenKey = `tok:${options.invalidateCacheToken ?? ''}`;
  const themeKey = `th:${options.activeTheme?.family ?? 'default'}:${options.activeTheme?.polarity ?? 'dark'}`;
  const stKey = `st:${options.sceneTheme?.font.webglFontUrl ?? ''}:${options.sceneTheme?.fontSize.label ?? ''}:${options.sceneTheme?.fontSize.caption ?? ''}`;
  return [contentKeys, blockKey, widgetKey, rmKey, tokenKey, themeKey, stKey].join('::');
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
