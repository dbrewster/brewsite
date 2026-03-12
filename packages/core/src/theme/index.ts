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
  // NEW:
  ThemeFamily,
  ThemePolarity,
  SceneThemePair,
} from './types';
export { ThemeContext, useTheme } from './ThemeContext';
export { ThemeKeyContext, useThemeKey } from './ThemeKeyContext';
export type { ThemeKey } from './ThemeKeyContext';
export {
  darkSceneTheme,
  lightSceneTheme,
  darkGlassSceneTheme,
  midnightSceneTheme,
  neonCyberSceneTheme,
  enterpriseSceneTheme,
  lightCanvasSceneTheme,
  lightMinimalSceneTheme,
  darkGlassLightSceneTheme,
  midnightLightSceneTheme,
  neonCyberLightSceneTheme,
  enterpriseLightSceneTheme,
  lightCanvasDarkSceneTheme,
  lightMinimalDarkSceneTheme,
  SCENE_THEME_PAIRS,
} from './presets';
