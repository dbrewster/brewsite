// @brewsite/themes — centralized theme preset package for BrewSite.

// ─── Plugin ───────────────────────────────────────────────────────────────────
export { themesPlugin } from './plugin';
export type { ThemeBundleOverrides } from './merge';
export { mergeThemeBundle } from './merge';

// ─── Types ────────────────────────────────────────────────────────────────────
export type { ThemeBundle } from './types';

// ─── Theme bundle registry ────────────────────────────────────────────────────
export * as bundles from './bundles';

// ─── Individual bundle named exports ─────────────────────────────────────────
export { enterpriseBundle }    from './bundles/enterprise';
export { darkGlassBundle }     from './bundles/darkGlass';
export { midnightBundle }      from './bundles/midnight';
export { neonCyberBundle }     from './bundles/neonCyber';
export { lightCanvasBundle }   from './bundles/lightCanvas';
export { lightMinimalBundle }  from './bundles/lightMinimal';

// ─── Active theme selectors — use as the `theme` prop on SceneEngine ─────────
export * as themes from './activeThemes';

// ─── Preset namespaces (scene / diagram / chart) ──────────────────────────────
export * as presets from './presets';
