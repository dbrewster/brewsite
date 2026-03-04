// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { EngineOverlayHost } from '../EngineOverlayHost';
import { EngineContext } from '../EngineContext';
import { EngineStateContext } from '../EngineStateContext';
import { ThemeContext } from '../../theme/ThemeContext';
import type { SceneTheme } from '../../theme/types';
import type { UseSceneEngineResult } from '../useSceneEngine';

const makeEngine = (): UseSceneEngineResult => ({
  frameState: {
    tickIndex: 0,
    progress: 0,
    sceneId: 'scene-a',
    sceneIndex: 0,
    sceneProgress: 0,
    tick: null,
  },
  scrollRegionRef: { current: null },
  scrollRegionHeightPx: 1,
  inputMode: 'scroll',
  inputSource: 'scroll',
  progress: 0,
  scrollToProgress: () => {},
  getGlobalProgress: () => 0,
  setRawProgress: () => {},
  sceneCount: 1,
  sceneIds: ['scene-a'],
  sceneOverlays: new Map([['scene-a', <div>Overlay A</div>]]),
  variableStore: {
    get: () => null,
    set: () => {},
    subscribe: () => () => {},
    getNamespace: () => ({}),
    updateNamespace: () => {},
    resetNamespace: () => {},
  } as UseSceneEngineResult['variableStore'],
  setCanvasRef: () => {},
  setBackgroundRef: () => {},
  setViewportSize: () => {},
  getCamera: () => null,
  getRenderer: () => null,
  setCameraOverride: () => {},
  getCameraOverride: () => null,
  setAutoAdvancePaused: () => {},
});

const renderHost = (
  transition?: React.ComponentProps<typeof EngineOverlayHost>['overlayTransition'],
  theme?: SceneTheme | null,
) => {
  const inner = (
    <EngineStateContext.Provider value={{ progress: 0, sceneId: 'scene-a', sceneIndex: 0, sceneProgress: 0 }}>
      <EngineContext.Provider value={makeEngine()}>
        <EngineOverlayHost overlayTransition={transition} />
      </EngineContext.Provider>
    </EngineStateContext.Provider>
  );
  return render(
    theme !== undefined
      ? <ThemeContext.Provider value={theme}>{inner}</ThemeContext.Provider>
      : inner,
  );
};

const makeTestTheme = (overrides?: Partial<SceneTheme>): SceneTheme => ({
  colorMode: 'dark',
  font: { htmlFamily: 'Inter, sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  ...overrides,
});

describe('EngineOverlayHost', () => {
  afterEach(() => {
    cleanup();
  });

  it('applies default transition style', () => {
    const view = renderHost();
    const overlay = view.getByText('Overlay A').parentElement as HTMLDivElement;
    expect(overlay.style.animation).toContain('brewsite-overlay-enter 200ms ease-out');
  });

  it('supports disabling transition animation', () => {
    const view = renderHost({ enabled: false });
    const overlay = view.getByText('Overlay A').parentElement as HTMLDivElement;
    expect(overlay.style.animation).toBe('');
  });

  it('applies configured transition duration and easing', () => {
    const view = renderHost({ durationMs: 350, easing: 'linear' });
    const overlay = view.getByText('Overlay A').parentElement as HTMLDivElement;
    expect(overlay.style.animation).toContain('brewsite-overlay-enter 350ms linear');
  });

  describe('theme CSS variable injection', () => {
    it('injects no CSS custom properties when no theme is provided', () => {
      const view = renderHost(undefined, null);
      const overlay = view.getByText('Overlay A').parentElement as HTMLDivElement;
      expect(overlay.style.getPropertyValue('--brewsite-font-family')).toBe('');
      expect(overlay.style.getPropertyValue('--brewsite-color-mode')).toBe('');
      expect(overlay.style.getPropertyValue('--brewsite-font-size-heading')).toBe('');
    });

    it('sets --brewsite-font-family when theme is present', () => {
      const theme = makeTestTheme();
      const view = renderHost(undefined, theme);
      const overlay = view.getByText('Overlay A').parentElement as HTMLDivElement;
      expect(overlay.style.getPropertyValue('--brewsite-font-family')).toBe('Inter, sans-serif');
    });

    it('sets fontFamily inline style to var(--brewsite-font-family) when theme is present', () => {
      const theme = makeTestTheme();
      const view = renderHost(undefined, theme);
      const overlay = view.getByText('Overlay A').parentElement as HTMLDivElement;
      expect(overlay.style.fontFamily).toBe('var(--brewsite-font-family)');
    });

    it('sets all 5 font-size variables in calc(1rem * X) format', () => {
      const theme = makeTestTheme();
      const view = renderHost(undefined, theme);
      const overlay = view.getByText('Overlay A').parentElement as HTMLDivElement;
      expect(overlay.style.getPropertyValue('--brewsite-font-size-heading')).toBe('calc(1rem * 1.5)');
      expect(overlay.style.getPropertyValue('--brewsite-font-size-body')).toBe('calc(1rem * 1)');
      expect(overlay.style.getPropertyValue('--brewsite-font-size-label')).toBe('calc(1rem * 0.85)');
      expect(overlay.style.getPropertyValue('--brewsite-font-size-caption')).toBe('calc(1rem * 0.7)');
      expect(overlay.style.getPropertyValue('--brewsite-font-size-annotation')).toBe('calc(1rem * 0.6)');
    });

    it('sets --brewsite-text-primary to #ffffff for dark colorMode', () => {
      const theme = makeTestTheme({ colorMode: 'dark' });
      const view = renderHost(undefined, theme);
      const overlay = view.getByText('Overlay A').parentElement as HTMLDivElement;
      expect(overlay.style.getPropertyValue('--brewsite-text-primary')).toBe('#ffffff');
    });

    it('sets --brewsite-text-primary to #111111 for light colorMode', () => {
      const theme = makeTestTheme({ colorMode: 'light' });
      const view = renderHost(undefined, theme);
      const overlay = view.getByText('Overlay A').parentElement as HTMLDivElement;
      expect(overlay.style.getPropertyValue('--brewsite-text-primary')).toBe('#111111');
    });

    it('does NOT set --brewsite-accent-color when accentColor is undefined', () => {
      const theme = makeTestTheme({ accentColor: undefined });
      const view = renderHost(undefined, theme);
      const overlay = view.getByText('Overlay A').parentElement as HTMLDivElement;
      expect(overlay.style.getPropertyValue('--brewsite-accent-color')).toBe('');
    });

    it('sets --brewsite-accent-color when accentColor is defined', () => {
      const theme = makeTestTheme({ accentColor: '#6b48ff' });
      const view = renderHost(undefined, theme);
      const overlay = view.getByText('Overlay A').parentElement as HTMLDivElement;
      expect(overlay.style.getPropertyValue('--brewsite-accent-color')).toBe('#6b48ff');
    });
  });
});
