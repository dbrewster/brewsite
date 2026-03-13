// Barrel re-export for the built-in default DiagramTheme presets and theme utilities.
// Named presets (darkGlass, midnight, etc.) live in @brewsite/themes.

export { enterpriseTheme, defaultDiagramTheme } from './enterprise';
export { enterpriseLightTheme, defaultLightDiagramTheme } from './enterpriseLight';
export { mergeTheme, withColorMode } from './mergeTheme';

export type { DiagramThemePair } from '../themeRegistry';
export {
  registerDiagramThemePair,
  resolveDiagramTheme,
  _resetDiagramThemeRegistryForTesting,
} from '../themeRegistry';
