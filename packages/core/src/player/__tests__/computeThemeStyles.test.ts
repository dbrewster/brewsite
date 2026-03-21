// Tests for the pure computeThemeStyles function.

import { describe, it, expect } from 'vitest';
import { computeThemeStyles } from '../computeThemeStyles';
import type { SceneTheme } from '../../theme/types';

/** Minimal dark theme with no optional fields. */
function darkTheme(overrides: Partial<SceneTheme> = {}): SceneTheme {
  return {
    colorMode: 'dark',
    font: { htmlFamily: 'Inter, sans-serif' },
    fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
    ...overrides,
  };
}

/** Minimal light theme with no optional fields. */
function lightTheme(overrides: Partial<SceneTheme> = {}): SceneTheme {
  return {
    colorMode: 'light',
    font: { htmlFamily: 'Inter, sans-serif' },
    fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
    ...overrides,
  };
}

describe('computeThemeStyles', () => {
  it('dark mode defaults', () => {
    const result = computeThemeStyles(darkTheme());
    expect(result['--brewsite-text-primary']).toBe('#ffffff');
    expect(result['--brewsite-text-secondary']).toBe('rgba(255,255,255,0.6)');
    expect(result['--brewsite-text-muted']).toBe('rgba(255,255,255,0.4)');
    expect(result['--brewsite-text-inverse']).toBe('#111111');
    expect(result['--brewsite-accent-color']).toBe('#2563eb');
    expect(result['--brewsite-surface-elevated']).toBe('rgba(255,255,255,0.06)');
    expect(result['--brewsite-surface-base']).toBe('rgba(255,255,255,0.03)');
    expect(result['--brewsite-surface-hover']).toBe('rgba(255,255,255,0.10)');
    expect(result['--brewsite-background-color']).toBe('#0a0a14');
    expect(result['--brewsite-color-mode']).toBe('dark');
    expect(result['--brewsite-font-family']).toBe('Inter, sans-serif');
    expect(result['--brewsite-border-subtle']).toBe('rgba(255,255,255,0.12)');
  });

  it('light mode defaults', () => {
    const result = computeThemeStyles(lightTheme());
    expect(result['--brewsite-text-primary']).toBe('#111111');
    expect(result['--brewsite-text-secondary']).toBe('rgba(0,0,0,0.6)');
    expect(result['--brewsite-text-muted']).toBe('rgba(0,0,0,0.4)');
    expect(result['--brewsite-text-inverse']).toBe('#ffffff');
    expect(result['--brewsite-surface-elevated']).toBe('rgba(0,0,0,0.04)');
    expect(result['--brewsite-surface-base']).toBe('rgba(0,0,0,0.02)');
    expect(result['--brewsite-surface-hover']).toBe('rgba(0,0,0,0.07)');
    expect(result['--brewsite-background-color']).toBe('#f5f5f7');
    expect(result['--brewsite-border-subtle']).toBe('rgba(0,0,0,0.10)');
  });

  it('textColors overrides take precedence', () => {
    const result = computeThemeStyles(darkTheme({
      textColors: { primary: '#E5EEFA' },
    }));
    expect(result['--brewsite-text-primary']).toBe('#E5EEFA');
    // secondary should still be the default
    expect(result['--brewsite-text-secondary']).toBe('rgba(255,255,255,0.6)');
  });

  it('textColors.surface overrides --brewsite-surface-elevated', () => {
    const result = computeThemeStyles(darkTheme({
      textColors: { surface: '#1E324F' },
    }));
    expect(result['--brewsite-surface-elevated']).toBe('#1E324F');
  });

  it('font.htmlHeadingFamily emits --brewsite-font-heading', () => {
    const result = computeThemeStyles(darkTheme({
      font: { htmlFamily: 'Inter, sans-serif', htmlHeadingFamily: '"Sora"' },
    }));
    expect(result['--brewsite-font-heading']).toBe('"Sora"');
  });

  it('htmlHeadingFamily absent falls back to htmlFamily', () => {
    const result = computeThemeStyles(darkTheme());
    expect(result['--brewsite-font-heading']).toBe('Inter, sans-serif');
  });

  it('semanticColors direct overrides', () => {
    const result = computeThemeStyles(darkTheme({
      semanticColors: { success: '#00ff00' },
    }));
    expect(result['--brewsite-color-success']).toBe('#00ff00');
    // Others fall back to defaults
    expect(result['--brewsite-color-warning']).toBe('#f59e0b');
  });

  it('semanticColors falls back to highlightPalette', () => {
    const result = computeThemeStyles(darkTheme({
      highlightPalette: { success: { color: '#3AAA7A' } },
    }));
    expect(result['--brewsite-color-success']).toBe('#3AAA7A');
  });

  it('accent-muted appends hex alpha based on colorMode', () => {
    const dark = computeThemeStyles(darkTheme({ accentColor: '#4F76B8' }));
    expect(dark['--brewsite-accent-color-muted']).toBe('#4F76B826');

    const light = computeThemeStyles(lightTheme({ accentColor: '#4F76B8' }));
    expect(light['--brewsite-accent-color-muted']).toBe('#4F76B81a');
  });

  it('spacing scale defaults', () => {
    const result = computeThemeStyles(darkTheme());
    expect(result['--brewsite-spacing-xs']).toBe('4px');
    expect(result['--brewsite-spacing-sm']).toBe('8px');
    expect(result['--brewsite-spacing-md']).toBe('16px');
    expect(result['--brewsite-spacing-lg']).toBe('24px');
    expect(result['--brewsite-spacing-xl']).toBe('40px');
  });

  it('spacing scale overrides', () => {
    const result = computeThemeStyles(darkTheme({
      spacing: { md: '20px' },
    }));
    expect(result['--brewsite-spacing-md']).toBe('20px');
    // Others remain defaults
    expect(result['--brewsite-spacing-sm']).toBe('8px');
  });

  it('shadow derivation for dark and light', () => {
    const dark = computeThemeStyles(darkTheme());
    expect(dark['--brewsite-shadow-sm']).toBe('0 1px 2px rgba(0,0,0,0.5)');
    expect(dark['--brewsite-shadow-md']).toBe('0 4px 12px rgba(0,0,0,0.5)');
    expect(dark['--brewsite-shadow-lg']).toBe('0 8px 24px rgba(0,0,0,0.6)');

    const light = computeThemeStyles(lightTheme());
    expect(light['--brewsite-shadow-sm']).toBe('0 1px 2px rgba(0,0,0,0.08)');
    expect(light['--brewsite-shadow-md']).toBe('0 4px 12px rgba(0,0,0,0.10)');
    expect(light['--brewsite-shadow-lg']).toBe('0 8px 24px rgba(0,0,0,0.14)');
  });

  it('radius scale including backward-compatible --brewsite-radius-base', () => {
    const result = computeThemeStyles(darkTheme());
    expect(result['--brewsite-radius-sm']).toBe('4px');
    expect(result['--brewsite-radius-base']).toBe('6px');
    expect(result['--brewsite-radius-md']).toBe('8px');
    expect(result['--brewsite-radius-lg']).toBe('12px');
    expect(result['--brewsite-radius-xl']).toBe('20px');
  });
});
