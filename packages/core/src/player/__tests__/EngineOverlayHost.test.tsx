// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { EngineOverlayHost } from '../EngineOverlayHost';
import { EngineContext } from '../EngineContext';
import { EngineStateContext } from '../EngineStateContext';
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

const renderHost = (transition?: React.ComponentProps<typeof EngineOverlayHost>['overlayTransition']) => {
  return render(
    <EngineStateContext.Provider value={{ progress: 0, sceneId: 'scene-a', sceneIndex: 0, sceneProgress: 0 }}>
      <EngineContext.Provider value={makeEngine()}>
        <EngineOverlayHost overlayTransition={transition} />
      </EngineContext.Provider>
    </EngineStateContext.Provider>,
  );
};

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
});
