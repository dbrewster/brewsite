// Named SceneTheme presets for common scene polarities.
// Consumers who need exact visual control should create a custom SceneTheme.

import type { SceneTheme } from './types';

/**
 * Dark-background scene preset.
 * Appropriate for tech/architectural presentations on dark backgrounds.
 * Label/overlay text defaults to light colors.
 *
 * NOTE: If you use a built-in DiagramTheme preset directly, `sceneTheme.colorMode`
 * does not affect label colors. Use `withColorMode(preset, colorMode)` to create
 * a preset with colorMode-derived label colors.
 */
export const darkSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    // webglFontUrl is intentionally absent — falls back to troika built-in.
    // Override with a self-hosted MSDF font URL for production use.
  },
  fontSize: {
    heading:    1.5,
    body:       1.0,
    label:      0.85,
    caption:    0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'color', value: '#0a0a14' },
  },
};

/**
 * Light-background scene preset.
 * Appropriate for documentation, product tours, and light UI contexts.
 * Label/overlay text defaults to dark colors.
 *
 * NOTE: If you use a built-in DiagramTheme preset directly, `sceneTheme.colorMode`
 * does not affect label colors. Use `withColorMode(preset, colorMode)` to create
 * a preset with colorMode-derived label colors.
 */
export const lightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: {
    htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontSize: {
    heading:    1.5,
    body:       1.0,
    label:      0.85,
    caption:    0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'color', value: '#f5f5f7' },
  },
};
