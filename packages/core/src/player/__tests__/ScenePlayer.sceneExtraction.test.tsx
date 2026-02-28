// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
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

  it('derives sceneKey from Scene keys', async () => {
    const { useSceneEngine } = await import('../useSceneEngine');

    render(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene key="a" />
        <Scene key="b" />
      </ScenePlayer>,
    );

    const calls = (useSceneEngine as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const options = calls[calls.length - 1]?.[0] as { scenes: Array<{ sceneKey: string }> };
    expect(options.scenes.map((s) => s.sceneKey)).toEqual(['a', 'b']);
  });

  it('warns and falls back to index for unkeyed Scene', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { useSceneEngine } = await import('../useSceneEngine');

    render(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene />
      </ScenePlayer>,
    );

    const calls = (useSceneEngine as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const options = calls[calls.length - 1]?.[0] as { scenes: Array<{ sceneKey: string }> };
    expect(options.scenes[0]?.sceneKey).toBe('0');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('has no key prop'));
  });

  it('filters non-Scene children and warns with count', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene key="a" />
        <div>ignored</div>
      </ScenePlayer>,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1 non-<Scene> child(ren)'));
  });

  it('updates contentKey when scene props change', async () => {
    const { useSceneEngine } = await import('../useSceneEngine');
    const { rerender } = render(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene key="a" meta={{ tone: 'warm' }} />
      </ScenePlayer>,
    );

    const callsA = (useSceneEngine as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const optionsA = callsA[callsA.length - 1]?.[0] as { scenes: Array<{ contentKey: string }> };
    const keyA = optionsA.scenes[0]?.contentKey;

    rerender(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene key="a" meta={{ tone: 'cool' }} />
      </ScenePlayer>,
    );

    const callsB = (useSceneEngine as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const optionsB = callsB[callsB.length - 1]?.[0] as { scenes: Array<{ contentKey: string }> };
    const keyB = optionsB.scenes[0]?.contentKey;

    expect(keyB).not.toBe(keyA);
  });

  it('keeps contentKey stable across identical renders', async () => {
    const { useSceneEngine } = await import('../useSceneEngine');
    const { rerender } = render(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene key="a" meta={{ tone: 'warm' }} />
      </ScenePlayer>,
    );

    const callsA = (useSceneEngine as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const optionsA = callsA[callsA.length - 1]?.[0] as { scenes: Array<{ contentKey: string }> };
    const keyA = optionsA.scenes[0]?.contentKey;

    rerender(
      <ScenePlayer manifestUrl={validManifestUrl} widgetSetup={() => new WidgetRegistry()}>
        <Scene key="a" meta={{ tone: 'warm' }} />
      </ScenePlayer>,
    );

    const callsB = (useSceneEngine as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const optionsB = callsB[callsB.length - 1]?.[0] as { scenes: Array<{ contentKey: string }> };
    const keyB = optionsB.scenes[0]?.contentKey;

    expect(keyB).toBe(keyA);
  });
});
