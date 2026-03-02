// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '@testing-library/react';
import { Scene } from '../../compiler/sceneDslCompiler';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { useSceneEngine } from '../useSceneEngine';

type LastUseEngineInputArgs = {
  inputMode?: 'scroll' | 'direct';
  onCameraOrbit?: (cameraId: string, dx: number, dy: number, speed: number) => void;
  onCameraReset?: (cameraId: string) => void;
};

let lastUseEngineInputArgs: LastUseEngineInputArgs | null = null;

vi.mock('../useEngineInput', () => {
  return {
    useEngineInput: vi.fn((args: LastUseEngineInputArgs) => {
      lastUseEngineInputArgs = args;
      return {
        progress: 0,
        scrollToProgress: () => {},
        getGlobalProgress: () => 0,
        getRawProgress: () => 0,
        scrollToRawProgress: () => {},
        forceRawProgress: () => {},
      };
    }),
  };
});

const makeScenes = () => [
  { sceneKey: 's1', contentKey: 'scene:s1', element: <Scene id="s1" /> },
];

const renderEngine = (opts: Parameters<typeof useSceneEngine>[0]) => {
  const Test = () => {
    useSceneEngine(opts);
    return <div />;
  };
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(<Test />);
  });
  return () => root.unmount();
};

describe('useSceneEngine input policy and camera routing', () => {
  beforeEach(() => {
    lastUseEngineInputArgs = null;
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      media: '',
      onchange: null,
    }));
    window.requestAnimationFrame = () => 1;
    window.cancelAnimationFrame = () => {};
  });

  it('respects prefer-scroll input policy', () => {
    const unmount = renderEngine({
      scenes: makeScenes(),
      widgetRegistry: new WidgetRegistry(),
      manifest: null,
      inputModePolicy: 'prefer-scroll',
    });

    expect(lastUseEngineInputArgs?.inputMode).toBe('scroll');
    unmount();
  });

  it('forces direct mode when controlledProgress is set', () => {
    const unmount = renderEngine({
      scenes: makeScenes(),
      widgetRegistry: new WidgetRegistry(),
      manifest: null,
      inputModePolicy: 'prefer-scroll',
      controlledProgress: 0.5,
    });

    expect(lastUseEngineInputArgs?.inputMode).toBe('direct');
    unmount();
  });

  it('routes camera actions to non-primary camera target widgets', () => {
    const registry = new WidgetRegistry();
    const applyOrbit = vi.fn();
    registry.register({
      widgetId: 'cam-secondary',
      applyOrbit,
      applyDolly: () => {},
      applyReset: () => {},
    });

    const unmount = renderEngine({
      scenes: makeScenes(),
      widgetRegistry: registry,
      manifest: null,
      primaryCameraId: 'cam-primary',
    });

    lastUseEngineInputArgs?.onCameraOrbit?.('cam-secondary', 10, 4, 1.5);
    expect(applyOrbit).toHaveBeenCalledWith(10, 4, 1.5);
    unmount();
  });

  it('warns once for missing non-primary camera targets', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unmount = renderEngine({
      scenes: makeScenes(),
      widgetRegistry: new WidgetRegistry(),
      manifest: null,
      primaryCameraId: 'cam-primary',
    });

    lastUseEngineInputArgs?.onCameraReset?.('missing-target');
    lastUseEngineInputArgs?.onCameraReset?.('missing-target');

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    unmount();
  });

  it('warns once when scroll-units mode has no progress profile', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unmount = renderEngine({
      scenes: makeScenes(),
      widgetRegistry: new WidgetRegistry(),
      scrollHeightMode: 'scroll-units',
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const scrollUnitsWarnings = warn.mock.calls.filter((call) =>
      String(call[0]).includes('scrollHeightMode="scroll-units"'),
    );
    expect(scrollUnitsWarnings.length).toBe(1);
    warn.mockRestore();
    unmount();
  });
});
