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
  SceneThemePair,
} from './types';
export { ThemeContext, useTheme } from './ThemeContext';
export { ThemeKeyContext, useThemeKey } from './ThemeKeyContext';
export type { ThemeKey } from './ThemeKeyContext';
export {
  defaultSceneTheme,
  defaultLightSceneTheme,
} from './presets';
export {
  registerSceneThemePair,
  resolveSceneTheme,
  _resetSceneThemeRegistryForTesting,
} from './sceneThemeRegistry';
