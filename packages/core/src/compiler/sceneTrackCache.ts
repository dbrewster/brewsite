import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { SceneTrack } from './sceneTrackTypes';
import type { ActiveTheme, SceneTheme } from '../theme/types';

const trackCache = new Map<string, SceneTrack>();

// ── Cache statistics ─────────────────────────────────────────────────────────

/** Cumulative hit/miss counters for the scene-track compilation cache. */
export type CacheStats = { hits: number; misses: number; size: number };

let _hits = 0;
let _misses = 0;

/** Read the current cache statistics snapshot. */
export const getCacheStats = (): CacheStats => ({
  hits: _hits,
  misses: _misses,
  size: trackCache.size,
});

// ── Core API ─────────────────────────────────────────────────────────────────

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
 * Get cached scene track if available. Increments hit or miss counter.
 */
export const getCachedTrack = (key: string): SceneTrack | undefined => {
  const track = trackCache.get(key);
  if (track) {
    _hits++;
  } else {
    _misses++;
  }
  return track;
};

/**
 * Cache a compiled scene track.
 */
export const setCachedTrack = (key: string, track: SceneTrack): void => {
  trackCache.set(key, track);
};

/**
 * Clear the scene track cache and reset statistics.
 */
export const clearCache = (): void => {
  trackCache.clear();
  _hits = 0;
  _misses = 0;
};
