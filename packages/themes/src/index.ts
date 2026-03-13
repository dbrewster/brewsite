// @brewsite/themes — cross-package named theme presets for all six theme families.

// ─── Types ────────────────────────────────────────────────────────────────────
export type { ThemeBundle } from './types';

// ─── Theme bundle registry (all six families, dark+light each) ────────────────
export * as bundles from './bundles';

// ─── Individual bundle exports ────────────────────────────────────────────────
export { enterpriseBundle }   from './bundles/enterprise';
export { darkGlassBundle }    from './bundles/darkGlass';
export { midnightBundle }     from './bundles/midnight';
export { neonCyberBundle }    from './bundles/neonCyber';
export { lightCanvasBundle }  from './bundles/lightCanvas';
export { lightMinimalBundle } from './bundles/lightMinimal';

// ─── Preset namespaces (scene / diagram / chart) ──────────────────────────────
export * as presets from './presets';

// ─── Active theme selectors ────────────────────────────────────────────────────
export type { ActiveThemeSelector } from './activeThemes';
export {
  enterprise as enterpriseSelector,
  darkGlass as darkGlassSelector,
  midnight as midnightSelector,
  neonCyber as neonCyberSelector,
  lightCanvas as lightCanvasSelector,
  lightMinimal as lightMinimalSelector,
} from './activeThemes';
