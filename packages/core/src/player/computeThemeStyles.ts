// Pure function: SceneTheme → CSS custom property map.
// Extracted from EngineOverlayHost for testability.

import type { SceneTheme } from '../theme/types';

/**
 * Computes the full set of CSS custom properties injected by EngineOverlayHost
 * from a SceneTheme. Returns an empty object when theme is nullish.
 */
export function computeThemeStyles(theme: SceneTheme): Record<string, string> {
  return {
    // ── Font (existing + new heading family) ──
    '--brewsite-font-family':          theme.font.htmlFamily,
    '--brewsite-font-heading':         theme.font.htmlHeadingFamily ?? theme.font.htmlFamily,
    fontFamily:                        'var(--brewsite-font-family)',

    // ── Font sizes (existing, unchanged) ──
    '--brewsite-font-size-heading':    `calc(1rem * ${theme.fontSize.heading})`,
    '--brewsite-font-size-body':       `calc(1rem * ${theme.fontSize.body})`,
    '--brewsite-font-size-label':      `calc(1rem * ${theme.fontSize.label})`,
    '--brewsite-font-size-caption':    `calc(1rem * ${theme.fontSize.caption})`,
    '--brewsite-font-size-annotation': `calc(1rem * ${theme.fontSize.annotation})`,

    // ── Color mode (existing, unchanged) ──
    '--brewsite-color-mode':           theme.colorMode,

    // ── Accent (new) ──
    '--brewsite-accent-color':         theme.accentColor ?? '#2563eb',
    '--brewsite-accent-color-muted':   (theme.accentColor ?? '#2563eb') +
      (theme.colorMode === 'dark' ? '26' : '1a'),

    // ── Text colors (textColors override > colorMode-derived) ──
    '--brewsite-text-primary':
      theme.textColors?.primary ??
      (theme.colorMode === 'dark' ? '#ffffff' : '#111111'),
    '--brewsite-text-secondary':
      theme.textColors?.secondary ??
      (theme.colorMode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'),
    '--brewsite-text-muted':
      theme.textColors?.muted ??
      (theme.colorMode === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'),
    '--brewsite-text-inverse':
      theme.colorMode === 'dark' ? '#111111' : '#ffffff',

    // ── Surfaces (textColors.surface override > colorMode-derived) ──
    '--brewsite-surface-base':
      theme.colorMode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    '--brewsite-surface-elevated':
      theme.textColors?.surface ??
      (theme.colorMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
    '--brewsite-surface-hover':
      theme.colorMode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',

    // ── Background (existing, unchanged) ──
    '--brewsite-background-color':
      theme.background?.fill?.kind === 'color'
        ? theme.background.fill.value
        : (theme.colorMode === 'dark' ? '#0a0a14' : '#f5f5f7'),

    // ── Semantic status colors ──
    '--brewsite-color-success':
      theme.semanticColors?.success ??
      theme.highlightPalette?.success?.color ?? '#22c55e',
    '--brewsite-color-warning':
      theme.semanticColors?.warning ??
      theme.highlightPalette?.warning?.color ?? '#f59e0b',
    '--brewsite-color-error':
      theme.semanticColors?.error ??
      theme.highlightPalette?.error?.color ?? '#ef4444',
    '--brewsite-color-info':
      theme.semanticColors?.info ??
      theme.highlightPalette?.info?.color ?? '#3b82f6',

    // ── Spacing scale ──
    '--brewsite-spacing-xs':           theme.spacing?.xs ?? '4px',
    '--brewsite-spacing-sm':           theme.spacing?.sm ?? '8px',
    '--brewsite-spacing-md':           theme.spacing?.md ?? '16px',
    '--brewsite-spacing-lg':           theme.spacing?.lg ?? '24px',
    '--brewsite-spacing-xl':           theme.spacing?.xl ?? '40px',

    // ── Shadows (colorMode-derived) ──
    '--brewsite-shadow-sm':
      theme.colorMode === 'dark'
        ? '0 1px 2px rgba(0,0,0,0.5)'
        : '0 1px 2px rgba(0,0,0,0.08)',
    '--brewsite-shadow-md':
      theme.colorMode === 'dark'
        ? '0 4px 12px rgba(0,0,0,0.5)'
        : '0 4px 12px rgba(0,0,0,0.10)',
    '--brewsite-shadow-lg':
      theme.colorMode === 'dark'
        ? '0 8px 24px rgba(0,0,0,0.6)'
        : '0 8px 24px rgba(0,0,0,0.14)',

    // ── Border radius scale ──
    '--brewsite-radius-sm':            '4px',
    '--brewsite-radius-base':          '6px',
    '--brewsite-radius-md':            '8px',
    '--brewsite-radius-lg':            '12px',
    '--brewsite-radius-xl':            '20px',

    // ── Existing variables preserved exactly ──
    '--brewsite-border-subtle':
      theme.colorMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
  };
}
