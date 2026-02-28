// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ScenePlayer } from '../ScenePlayer';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { SceneMetaWidget } from '../SceneMetaWidget';
import { Scene } from '../../compiler/sceneDslCompiler';

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  class RendererStub {
    shadowMap = { enabled: false };
    setPixelRatio(): void {}
    setSize(): void {}
    render(): void {}
    setClearColor(): void {}
    dispose(): void {}
  }
  return { ...actual, WebGLRenderer: RendererStub };
});

const makeScenes = () => [<Scene key="s1" id="s1" />, <Scene key="s2" id="s2" />];

const manifest = {
  version: 2,
  models: [],
  animations: [],
};

const validManifestUrl = `data:application/json,${encodeURIComponent(JSON.stringify(manifest))}`;
const invalidManifestUrl = `data:application/json,${encodeURIComponent(JSON.stringify({ version: 99 }))}`;

describe('ScenePlayer (browser)', () => {
  const originalRAF = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;

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

    window.requestAnimationFrame = () => 1;
    window.cancelAnimationFrame = () => {};

  });

  afterEach(() => {
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCancel;
  });

  it('shows placeholder until first tick', () => {
    render(
      <ScenePlayer
        manifestUrl={validManifestUrl}
        widgetSetup={() => new WidgetRegistry()}
        placeholder={<div>Loading...</div>}
      >
        {makeScenes()}
      </ScenePlayer>,
    );
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('surfaces manifest load errors', async () => {
    render(
      <ScenePlayer
        manifestUrl={invalidManifestUrl}
        widgetSetup={() => new WidgetRegistry()}
      >
        {makeScenes()}
      </ScenePlayer>,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('wires onSceneChange into SceneMetaWidget', async () => {
    let wired: ((sceneId: string, sceneIndex: number) => void) | undefined;
    class TrackingMetaWidget extends SceneMetaWidget {
      setOnSceneChange(callback?: (sceneId: string, sceneIndex: number) => void): void {
        super.setOnSceneChange(callback);
        wired = callback;
      }
    }

    const widgetSetup = () => {
      const registry = new WidgetRegistry();
      registry.register(new TrackingMetaWidget());
      return registry;
    };

    render(
      <ScenePlayer
        manifestUrl={validManifestUrl}
        widgetSetup={widgetSetup}
        onSceneChange={() => {}}
      >
        {makeScenes()}
      </ScenePlayer>,
    );

    await waitFor(() => {
      expect(typeof wired).toBe('function');
    });
  });
});
