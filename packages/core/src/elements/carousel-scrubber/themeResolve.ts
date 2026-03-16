// Pure theme resolution for carousel scrubber style — merges DSL and theme tokens.

import type { CarouselScrubberStyle } from './types';
import type { SceneTheme } from '../../theme/types';
import { DEFAULT_CAROUSEL_SCRUBBER_STYLE } from './compile';

/**
 * Merges SceneTheme.carouselTray tokens into the compiled style.
 * Priority: DSL props (in compiled style) > theme tokens > compiled defaults.
 *
 * A compiled value is considered "explicitly set by DSL" if it differs from
 * the compiled default. Theme values only fill in default-valued fields.
 */
export function resolveThemedStyle(
  style: CarouselScrubberStyle,
  theme: SceneTheme | null | undefined,
): CarouselScrubberStyle {
  const trayTheme = theme?.carouselTray;
  if (!trayTheme) return style;

  const defaults = DEFAULT_CAROUSEL_SCRUBBER_STYLE;
  return {
    baseColor: style.baseColor !== defaults.baseColor ? style.baseColor : (trayTheme.color ?? style.baseColor),
    baseOpacity: style.baseOpacity !== defaults.baseOpacity ? style.baseOpacity : (trayTheme.opacity ?? style.baseOpacity),
    accentColor: style.accentColor !== defaults.accentColor ? style.accentColor : (trayTheme.accentColor ?? style.accentColor),
    metalness: style.metalness !== defaults.metalness ? style.metalness : (trayTheme.metalness ?? style.metalness),
    roughness: style.roughness !== defaults.roughness ? style.roughness : (trayTheme.roughness ?? style.roughness),
    edgeStyle: style.edgeStyle !== defaults.edgeStyle ? style.edgeStyle : (trayTheme.edgeStyle ?? style.edgeStyle),
    surfacePattern: style.surfacePattern !== defaults.surfacePattern
      ? style.surfacePattern
      : (trayTheme.surfacePattern ?? style.surfacePattern),
    surfaceIntensity: style.surfaceIntensity !== defaults.surfaceIntensity
      ? style.surfaceIntensity
      : (trayTheme.surfaceIntensity ?? style.surfaceIntensity),
    surfaceMapUrl: style.surfaceMapUrl !== defaults.surfaceMapUrl
      ? style.surfaceMapUrl
      : (trayTheme.surfaceMapUrl ?? style.surfaceMapUrl),
  };
}

/**
 * Resolves tray depth and gap from compiled state + theme.
 * DSL-set values take precedence over theme values.
 */
export function resolveThemedDepthAndGap(
  compiledDepth: number,
  compiledGap: number,
  theme: SceneTheme | null | undefined,
): { depth: number; gap: number } {
  const trayTheme = theme?.carouselTray;
  if (!trayTheme) return { depth: compiledDepth, gap: compiledGap };

  const DEFAULT_DEPTH = 0.36;
  const DEFAULT_GAP = 0.02;

  return {
    depth: compiledDepth !== DEFAULT_DEPTH ? compiledDepth : (trayTheme.depth ?? compiledDepth),
    gap: compiledGap !== DEFAULT_GAP ? compiledGap : (trayTheme.gap ?? compiledGap),
  };
}
