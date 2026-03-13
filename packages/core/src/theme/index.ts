// Public exports for the theme module.
export type {
  SceneTheme,
  SceneColorMode,
  SceneThemeFontTokens,
  SceneThemeFontSizeScale,
  SceneThemeBackgroundFill,
  SceneThemeBackgroundEffects,
  SceneThemeBackground,
  SceneThemeFloorGrid,
  SceneThemeFloor,
  ThemeFamily,
  ThemePolarity,
  // NEW: replaces SceneThemePair + the old themeFamily/themePolarity prop pair
  ActiveTheme,
} from './types';
export { ThemeContext, useTheme } from './ThemeContext';

/**
 * @deprecated ThemeKeyContext is superseded by the compile-time theme path via
 * `<SceneEngine theme={...}>`. It will be removed in the next major release.
 */
export { ThemeKeyContext, useThemeKey } from './ThemeKeyContext';
/**
 * @deprecated ThemeKey is superseded by ActiveTheme. Use `ActiveTheme` instead.
 */
export type { ThemeKey } from './ThemeKeyContext';

export {
  defaultSceneTheme,
  defaultLightSceneTheme,
} from './presets';

// ─── Scene Theme Registry ────────────────────────────────────────────────────
export {
  registerSceneThemePair,
  resolveSceneTheme,
  _resetSceneThemeRegistryForTesting,
} from './sceneThemeRegistry';
