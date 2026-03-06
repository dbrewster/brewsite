// Built-in DeckTheme instances and factory function.

import type { DeckTheme } from './types';

export const defaultDeckTheme: DeckTheme = {
  fonts: {
    heading: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  colorMode: 'light',
  accentColor: '#2563eb',
  background: { color: '#ffffff' },
  colors: {
    heading: '#111111',
    body: '#374151',
    surface: '#f3f4f6',
    muted: '#9ca3af',
  },
  spacing: { slide: '8%', stack: '1.5rem' },
  border: { radius: '0.5rem' },
};

export const darkDeckTheme: DeckTheme = {
  fonts: {
    heading: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  colorMode: 'dark',
  accentColor: '#60a5fa',
  background: { color: '#0f172a' },
  colors: {
    heading: '#f8fafc',
    body: '#cbd5e1',
    surface: '#1e293b',
    muted: '#64748b',
  },
  spacing: { slide: '8%', stack: '1.5rem' },
  border: { radius: '0.5rem' },
};

/**
 * Creates a DeckTheme by merging partial overrides with the default light theme.
 * Deep-merges nested objects; top-level fields from overrides win.
 */
export function createDeckTheme(overrides: Partial<DeckTheme>): DeckTheme {
  const border: DeckTheme['border'] = {
    radius: overrides.border?.radius ?? defaultDeckTheme.border?.radius ?? '0.5rem',
  };
  return {
    ...defaultDeckTheme,
    ...overrides,
    fonts: { ...defaultDeckTheme.fonts, ...overrides.fonts },
    background: { ...defaultDeckTheme.background, ...overrides.background },
    colors: { ...defaultDeckTheme.colors, ...overrides.colors },
    spacing: { ...defaultDeckTheme.spacing, ...overrides.spacing },
    border,
  };
}
