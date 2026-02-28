// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { ScenePlayer } from '../ScenePlayer';
import { Scene } from '../../compiler/sceneDslCompiler';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { UseSceneEngineResult } from '../useSceneEngine';

const manifest = {
  version: 2,
  models: [],
  animations: [],
};

const validManifestUrl = `data:application/json,${encodeURIComponent(JSON.stringify(manifest))}`;

const makeEngine = (): UseSceneEngineResult => ({
  frameState: {
    tickIndex: -1,
    progress: 0,
    sceneId: '',
    sceneIndex: 0,
    sceneProgress: 0,
    tick: null,
  },
  scrollRegionRef: { current: null },
  scrollRegionHeightPx: 1,
  progress: 0,
  scrollToProgress: () => {},
  getGlobalProgress: () => 0,
  sceneCount: 0,
  variableStore: {
    get: () => null,
    set: () => {},
    subscribe: () => () => {},
    getNamespace: () => ({}),
    updateNamespace: () => {},
    resetNamespace: () => {},
  } as unknown as UseSceneEngineResult['variableStore'],
  setCanvasRef: () => {},
  setBackgroundRef: () => {},
  setViewportSize: () => {},
  getCamera: () => null,
  getRenderer: () => null,
  setCameraOverride: () => {},
  getCameraOverride: () => null,
  debug: {
    driverReady: true,
    assetsReady: false,
    sceneTrackTicks: 0,
    viewport: { width: 1, height: 1 },
  },
});

vi.mock('../useSceneEngine', () => {
  return {
    useSceneEngine: vi.fn(() => makeEngine()),
  };
});

describe('ScenePlayer scene extraction', () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('collects direct Scene and wrapped Scene components in source order', async () => {
    const { useSceneEngine } = await import('../useSceneEngine');

    const Wrapped = () => <Scene id="wrapped" />;

    render(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene id="direct-a" />
        <Wrapped />
        <Scene id="direct-b" />
      </ScenePlayer>,
    );

    await waitFor(() => {
      const calls = (useSceneEngine as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const options = calls[calls.length - 1]?.[0] as { scenes: Array<{ sceneKey: string }> };
      expect(options.scenes.map((s) => s.sceneKey)).toEqual(['direct-a', 'wrapped', 'direct-b']);
    });
  });

  it('updates contentKey when scene props change', async () => {
    const { useSceneEngine } = await import('../useSceneEngine');
    const { rerender } = render(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene id="a" meta={{ tone: 'warm' }} />
      </ScenePlayer>,
    );

    let keyA = '';
    await waitFor(() => {
      const calls = (useSceneEngine as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const options = calls[calls.length - 1]?.[0] as { scenes: Array<{ contentKey: string }> };
      keyA = options.scenes[0]?.contentKey ?? '';
      expect(keyA).not.toBe('');
    });

    rerender(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene id="a" meta={{ tone: 'cool' }} />
      </ScenePlayer>,
    );

    await waitFor(() => {
      const calls = (useSceneEngine as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const options = calls[calls.length - 1]?.[0] as { scenes: Array<{ contentKey: string }> };
      const keyB = options.scenes[0]?.contentKey ?? '';
      expect(keyB).not.toBe(keyA);
    });
  });

  it('keeps contentKey stable across identical renders', async () => {
    const { useSceneEngine } = await import('../useSceneEngine');
    const { rerender } = render(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene id="a" meta={{ tone: 'warm' }} />
      </ScenePlayer>,
    );

    let keyA = '';
    await waitFor(() => {
      const calls = (useSceneEngine as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const options = calls[calls.length - 1]?.[0] as { scenes: Array<{ contentKey: string }> };
      keyA = options.scenes[0]?.contentKey ?? '';
      expect(keyA).not.toBe('');
    });

    rerender(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene id="a" meta={{ tone: 'warm' }} />
      </ScenePlayer>,
    );

    await waitFor(() => {
      const calls = (useSceneEngine as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const options = calls[calls.length - 1]?.[0] as { scenes: Array<{ contentKey: string }> };
      const keyB = options.scenes[0]?.contentKey ?? '';
      expect(keyB).toBe(keyA);
    });
  });

  it('does not warn for non-Scene children', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene id="a" />
        <div>inert child</div>
      </ScenePlayer>,
    );

    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('non-<Scene>'));
  });
});
