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
  HighlightVariantName,
  SceneThemeHighlightVariant,
  SceneThemeHighlightPalette,
} from './types';
export { ThemeContext, useTheme } from './ThemeContext';
export { darkHighlightPalette, lightHighlightPalette } from './highlightPalettes';

export {
  defaultSceneTheme,
  defaultLightSceneTheme,
} from './presets';

// ─── Scene Theme Registry ────────────────────────────────────────────────────
export {
  registerSceneThemePair,
  resolveSceneTheme,
} from './sceneThemeRegistry';
