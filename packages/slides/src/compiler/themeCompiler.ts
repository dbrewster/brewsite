// Pure function: DeckTheme → ResolvedDeckTheme. No React, No Three.js, no runtime imports.

import type { DeckTheme, ResolvedDeckTheme } from '../types';
import type { SceneTheme } from '@brewsite/core';
import { defaultDeckTheme } from '../theme';

/**
 * Merges the provided DeckTheme with defaults and derives:
 *  - A SceneTheme for injection into EngineProvider.sceneTheme
 *  - A CSS variable map for the --slide-* namespace injected by SlideMetaWidget
 *
 * This function is pure: same inputs always produce the same output.
 */
export function compileDeckTheme(theme?: Partial<DeckTheme>): ResolvedDeckTheme {
  // Merge each sub-object, ensuring all required fields have concrete values.
  // Optional fields on DeckTheme (accentColor, border) are given defaults here
  // so the returned ResolvedDeckTheme (= Required<DeckTheme> & extras) satisfies
  // TypeScript's strict mode without unsafe casts.
  const fonts = { ...defaultDeckTheme.fonts, ...theme?.fonts };
  const colorMode = theme?.colorMode ?? defaultDeckTheme.colorMode;
  const accentColor = theme?.accentColor ?? defaultDeckTheme.accentColor ?? '#2563eb';
  const background = { ...defaultDeckTheme.background, ...theme?.background };
  const colors = { ...defaultDeckTheme.colors, ...theme?.colors };
  const spacing = { ...defaultDeckTheme.spacing, ...theme?.spacing };
  const border = {
    radius: theme?.border?.radius ?? defaultDeckTheme.border?.radius ?? '0.5rem',
  };

  // Derive SceneTheme from DeckTheme fields (1:1 mapping)
  const sceneTheme: SceneTheme = {
    font: {
      htmlFamily: fonts.heading,
    },
    fontSize: {
      heading: 2.4,
      body: 1.0,
      label: 0.875,
      caption: 0.75,
      annotation: 0.7,
    },
    colorMode,
    accentColor,
  };

  // CSS variable map for --slide-* namespace
  const cssVars: Record<string, string> = {
    '--slide-padding': spacing.slide,
    '--slide-gap': spacing.stack,
    '--slide-color-heading': colors.heading,
    '--slide-color-body': colors.body,
    '--slide-color-surface': colors.surface,
    '--slide-color-muted': colors.muted,
    '--slide-border-radius': border.radius,
  };
  if (fonts.body) cssVars['--slide-font-body'] = fonts.body;
  if (fonts.mono) cssVars['--slide-font-mono'] = fonts.mono;
  if (background.gradient) cssVars['--slide-bg-gradient'] = background.gradient;

  return { fonts, colorMode, accentColor, background, colors, spacing, border, sceneTheme, cssVars };
}
