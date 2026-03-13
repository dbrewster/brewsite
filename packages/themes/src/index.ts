// @brewsite/themes — public API surface for the centralized theme system.

export { themesPlugin } from './plugin';
export type { ThemeBundle } from './types';
export type { ThemeBundleOverrides } from './merge';
export * as bundles from './bundles';
export * as themes from './activeThemes';
export { mergeThemeBundle } from './merge';
