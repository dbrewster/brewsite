// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { EngineOverlayHost } from '../EngineOverlayHost';
import { EngineContext } from '../EngineContext';
import { ThemeContext } from '../../theme/ThemeContext';
import { registerSceneThemePair, _resetSceneThemeRegistryForTesting } from '../../theme/sceneThemeRegistry';
import type { UseSceneEngineResult } from '../useSceneEngine';
import type { SceneTheme } from '../../theme/types';

// Custom test themes for registry-based class resolution tests.
const testDarkGlassSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: { htmlFamily: '"Sora", "Inter", sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: { fill: { kind: 'gradient', value: 'linear-gradient(180deg, #070504 0%, #130B08 100%)' } },
};
const testDarkGlassLightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: { htmlFamily: '"Sora", "Inter", sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: { fill: { kind: 'gradient', value: 'linear-gradient(180deg, #F8F3EF 0%, #EFE6DE 100%)' } },
};
const testLightCanvasSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: { htmlFamily: '"Plus Jakarta Sans", "Inter", sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  background: { fill: { kind: 'gradient', value: 'linear-gradient(180deg, #FFFFFF 0%, #F1F4F8 100%)' } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal engine context with only the fields EngineOverlayHost needs.
 */
const makeEngine = (
  sceneId: string,
  sceneOverlays: Map<string, React.ReactNode> = new Map(),
): UseSceneEngineResult =>
  ({
    frameState: {
      sceneId,
      sceneIndex: 0,
      progress: 0,
      sceneProgress: 0,
      tickIndex: -1,
      tick: null,
    },
    sceneOverlays,
  } as unknown as UseSceneEngineResult);

const makeTestTheme = (overrides?: Partial<SceneTheme>): SceneTheme => ({
  colorMode: 'dark',
  font: { htmlFamily: 'Inter, sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  ...overrides,
});

/**
 * Renders EngineOverlayHost with the given engine context, optional theme,
 * and optional overlay transition config.
 */
const renderHost = (options: {
  engine?: UseSceneEngineResult;
  transition?: React.ComponentProps<typeof EngineOverlayHost>['overlayTransition'];
  theme?: SceneTheme | null;
  passthroughPointerEvents?: boolean;
  className?: string;
} = {}) => {
  const {
    engine = makeEngine('scene-a'),
    transition,
    theme,
    passthroughPointerEvents,
    className,
  } = options;

  const inner = (
    <EngineContext.Provider value={engine}>
      <EngineOverlayHost
        overlayTransition={transition}
        passthroughPointerEvents={passthroughPointerEvents}
        className={className}
      />
    </EngineContext.Provider>
  );

  return render(
    theme !== undefined
      ? <ThemeContext.Provider value={theme}>{inner}</ThemeContext.Provider>
      : inner,
  );
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EngineOverlayHost', () => {
  afterEach(() => {
    cleanup();
  });

  // ─── Transition animation ────────────────────────────────────────────────────

  it('applies default transition style on the inner overlay wrapper', () => {
    const view = renderHost();
    const outer = view.container.firstChild as HTMLDivElement;
    // The animation is scoped to the inner wrapper (first child of outer) so that
    // persistent children (e.g. ChartTooltipHost) are not unmounted on scene change.
    const inner = outer.children[0] as HTMLDivElement;
    expect(inner.style.animation).toContain('brewsite-overlay-enter 200ms ease-out');
  });

  it('supports disabling transition animation', () => {
    const view = renderHost({ transition: { enabled: false } });
    const outer = view.container.firstChild as HTMLDivElement;
    const inner = outer.children[0] as HTMLDivElement;
    expect(inner.style.animation).toBe('');
  });

  it('applies configured transition duration and easing', () => {
    const view = renderHost({ transition: { durationMs: 350, easing: 'linear' } });
    const outer = view.container.firstChild as HTMLDivElement;
    const inner = outer.children[0] as HTMLDivElement;
    expect(inner.style.animation).toContain('brewsite-overlay-enter 350ms linear');
  });

  // ─── sceneOverlays rendering ─────────────────────────────────────────────────

  it('renders overlay content for the current scene', () => {
    const sceneOverlays = new Map<string, React.ReactNode>([
      ['scene-a', <span key="c">Scene A content</span>],
    ]);
    const engine = makeEngine('scene-a', sceneOverlays);
    const view = renderHost({ engine });
    expect(view.getByText('Scene A content')).toBeTruthy();
  });

  it('renders no content when current scene has no overlay entry', () => {
    const sceneOverlays = new Map<string, React.ReactNode>([
      ['scene-b', <span key="c">Scene B content</span>],
    ]);
    const engine = makeEngine('scene-a', sceneOverlays);
    const view = renderHost({ engine });
    expect(view.container.firstChild).toBeTruthy();
    expect(view.queryByText('Scene B content')).toBeNull();
  });

  it('renders no overlay content in inner wrapper when sceneOverlays is empty', () => {
    const view = renderHost();
    const outer = view.container.firstChild as HTMLDivElement;
    // The outer div always has one child (the inner overlay wrapper).
    expect(outer.children).toHaveLength(1);
    // The inner wrapper has no content when there is no overlay for the current scene.
    const inner = outer.children[0] as HTMLDivElement;
    expect(inner.children).toHaveLength(0);
  });

  it('passes through pointer events when passthroughPointerEvents is true', () => {
    const view = renderHost({ passthroughPointerEvents: true });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.pointerEvents).toBe('none');
  });

  it('intercepts pointer events by default', () => {
    const view = renderHost();
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.pointerEvents).toBe('auto');
  });

  // ─── Theme CSS variable injection ────────────────────────────────────────────

  it('injects no CSS custom properties when no theme is provided', () => {
    const view = renderHost({ theme: null });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-font-family')).toBe('');
    expect(overlay.style.getPropertyValue('--brewsite-color-mode')).toBe('');
    expect(overlay.style.getPropertyValue('--brewsite-font-size-heading')).toBe('');
  });

  it('sets --brewsite-font-family when theme is present', () => {
    const theme = makeTestTheme();
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-font-family')).toBe('Inter, sans-serif');
  });

  it('sets fontFamily inline style to var(--brewsite-font-family) when theme is present', () => {
    const theme = makeTestTheme();
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.fontFamily).toBe('var(--brewsite-font-family)');
  });

  it('sets all 5 font-size variables in calc(1rem * X) format', () => {
    const theme = makeTestTheme();
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-font-size-heading')).toBe('calc(1rem * 1.5)');
    expect(overlay.style.getPropertyValue('--brewsite-font-size-body')).toBe('calc(1rem * 1)');
    expect(overlay.style.getPropertyValue('--brewsite-font-size-label')).toBe('calc(1rem * 0.85)');
    expect(overlay.style.getPropertyValue('--brewsite-font-size-caption')).toBe('calc(1rem * 0.7)');
    expect(overlay.style.getPropertyValue('--brewsite-font-size-annotation')).toBe('calc(1rem * 0.6)');
  });

  it('sets --brewsite-text-primary to #ffffff for dark colorMode', () => {
    const theme = makeTestTheme({ colorMode: 'dark' });
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-text-primary')).toBe('#ffffff');
  });

  it('sets --brewsite-text-primary to #111111 for light colorMode', () => {
    const theme = makeTestTheme({ colorMode: 'light' });
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-text-primary')).toBe('#111111');
  });

});

describe('EngineOverlayHost — new CSS variables (theming-overhaul)', () => {
  afterEach(() => { cleanup(); });

  it('injects --brewsite-background-color fallback for non-color fills', () => {
    // testDarkGlassSceneTheme uses a gradient fill, so the overlay variable falls back by colorMode.
    const view = renderHost({ theme: testDarkGlassSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-background-color')).toBe('#0a0a14');
  });

  it('injects --brewsite-background-color colorMode fallback when theme has no background fill', () => {
    const theme: SceneTheme = makeTestTheme({ colorMode: 'dark', background: undefined });
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-background-color')).toBe('#0a0a14');
  });

  it('injects --brewsite-background-color light fallback when colorMode is light and no fill', () => {
    const theme: SceneTheme = makeTestTheme({ colorMode: 'light', background: undefined });
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-background-color')).toBe('#f5f5f7');
  });

  it('injects --brewsite-radius-base as 6px for any theme', () => {
    const view = renderHost({ theme: testDarkGlassSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-radius-base')).toBe('6px');
  });

  it('injects --brewsite-surface-elevated with dark rgba value for dark colorMode', () => {
    const view = renderHost({ theme: testDarkGlassSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-surface-elevated')).toBe('rgba(255,255,255,0.06)');
  });

  it('injects --brewsite-surface-elevated with light rgba value for light colorMode', () => {
    const view = renderHost({ theme: testLightCanvasSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-surface-elevated')).toBe('rgba(0,0,0,0.04)');
  });

  it('injects --brewsite-border-subtle with dark rgba value for dark colorMode', () => {
    const view = renderHost({ theme: testDarkGlassSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-border-subtle')).toBe('rgba(255,255,255,0.12)');
  });

  it('does NOT inject new variables when theme is null', () => {
    const view = renderHost({ theme: null });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-background-color')).toBe('');
    expect(overlay.style.getPropertyValue('--brewsite-radius-base')).toBe('');
  });
});

describe('EngineOverlayHost — CSS class injection (theming-overhaul)', () => {
  beforeEach(() => {
    _resetSceneThemeRegistryForTesting();
    registerSceneThemePair('darkGlass', { dark: testDarkGlassSceneTheme, light: testDarkGlassLightSceneTheme });
    registerSceneThemePair('lightCanvas', { dark: testLightCanvasSceneTheme, light: testLightCanvasSceneTheme });
  });
  afterEach(() => {
    cleanup();
    _resetSceneThemeRegistryForTesting();
  });

  it('adds bw-theme-darkGlass class when testDarkGlassSceneTheme is active (registry match)', () => {
    const view = renderHost({ theme: testDarkGlassSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('bw-theme-darkGlass')).toBe(true);
  });

  it('adds bw-dark class for dark colorMode', () => {
    const view = renderHost({ theme: testDarkGlassSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('bw-dark')).toBe(true);
  });

  it('adds bw-light class for light colorMode', () => {
    const view = renderHost({ theme: testLightCanvasSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('bw-light')).toBe(true);
  });

  it('adds bw-theme-lightCanvas class for testLightCanvasSceneTheme (registry match)', () => {
    const view = renderHost({ theme: testLightCanvasSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('bw-theme-lightCanvas')).toBe(true);
  });

  it('does NOT add bw-theme-* class for a custom spread theme not in registry', () => {
    // Object spread creates a new reference — resolveThemeFamily returns undefined.
    const customTheme: SceneTheme = { ...testDarkGlassSceneTheme };
    const view = renderHost({ theme: customTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    const hasThemeClass = [...overlay.classList].some(c => c.startsWith('bw-theme-'));
    expect(hasThemeClass).toBe(false);
  });

  it('custom spread theme still gets bw-dark from colorMode', () => {
    const customTheme: SceneTheme = { ...testDarkGlassSceneTheme };
    const view = renderHost({ theme: customTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('bw-dark')).toBe(true);
  });

  it('preserves consumer-provided className alongside injected theme classes', () => {
    const view = renderHost({ theme: testDarkGlassSceneTheme, className: 'my-overlay' });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('my-overlay')).toBe(true);
    expect(overlay.classList.contains('bw-theme-darkGlass')).toBe(true);
    expect(overlay.classList.contains('bw-dark')).toBe(true);
  });

  it('adds no bw-* classes when theme is null', () => {
    const view = renderHost({ theme: null });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect([...overlay.classList].some(c => c.startsWith('bw-'))).toBe(false);
  });

  it('the light polarity entry for darkGlass family also resolves to bw-theme-darkGlass', () => {
    // testDarkGlassLightSceneTheme is registered in beforeEach — resolves by reference.
    const view = renderHost({ theme: testDarkGlassLightSceneTheme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.classList.contains('bw-theme-darkGlass')).toBe(true);
    expect(overlay.classList.contains('bw-light')).toBe(true);
  });
});
