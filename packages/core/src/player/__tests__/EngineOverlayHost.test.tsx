// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { EngineOverlayHost } from '../EngineOverlayHost';
import { EngineContext } from '../EngineContext';
import { ThemeContext } from '../../theme/ThemeContext';
import type { UseSceneEngineResult } from '../useSceneEngine';
import type { SceneTheme } from '../../theme/types';

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
} = {}) => {
  const {
    engine = makeEngine('scene-a'),
    transition,
    theme,
    passthroughPointerEvents,
  } = options;

  const inner = (
    <EngineContext.Provider value={engine}>
      <EngineOverlayHost
        overlayTransition={transition}
        passthroughPointerEvents={passthroughPointerEvents}
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

  it('applies default transition style on the overlay container', () => {
    const view = renderHost();
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.animation).toContain('brewsite-overlay-enter 200ms ease-out');
  });

  it('supports disabling transition animation', () => {
    const view = renderHost({ transition: { enabled: false } });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.animation).toBe('');
  });

  it('applies configured transition duration and easing', () => {
    const view = renderHost({ transition: { durationMs: 350, easing: 'linear' } });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.animation).toContain('brewsite-overlay-enter 350ms linear');
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

  it('renders no content when sceneOverlays is empty', () => {
    const view = renderHost();
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.children).toHaveLength(0);
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

  it('does NOT set --brewsite-accent-color when accentColor is undefined', () => {
    const theme = makeTestTheme({ accentColor: undefined });
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-accent-color')).toBe('');
  });

  it('sets --brewsite-accent-color when accentColor is defined', () => {
    const theme = makeTestTheme({ accentColor: '#6b48ff' });
    const view = renderHost({ theme });
    const overlay = view.container.firstChild as HTMLDivElement;
    expect(overlay.style.getPropertyValue('--brewsite-accent-color')).toBe('#6b48ff');
  });
});
