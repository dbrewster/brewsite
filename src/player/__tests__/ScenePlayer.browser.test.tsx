// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ScenePlayer } from '../ScenePlayer';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneGroup } from '../../compiler/sceneTypes';
import { SceneMetaWidget } from '../SceneMetaWidget';

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

const makeSceneGroup = (): SceneGroup => {
  const scenes = [
    { id: 's1', index: 0, getFrame: () => ({ id: 's1', scrollProgress: 0, widgets: {} }) },
    { id: 's2', index: 1, getFrame: () => ({ id: 's2', scrollProgress: 1, widgets: {} }) },
  ];
  return { id: 'group', scenes };
};

const manifest = {
  version: 2,
  models: [],
  containedModels: [],
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
        sceneGroup={makeSceneGroup()}
        manifestUrl={validManifestUrl}
        widgetSetup={() => new WidgetRegistry()}
        placeholder={<div>Loading...</div>}
      />,
    );
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('surfaces manifest load errors', async () => {
    render(
      <ScenePlayer
        sceneGroup={makeSceneGroup()}
        manifestUrl={invalidManifestUrl}
        widgetSetup={() => new WidgetRegistry()}
      />,
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
        sceneGroup={makeSceneGroup()}
        manifestUrl={validManifestUrl}
        widgetSetup={widgetSetup}
        onSceneChange={() => {}}
      />,
    );

    await waitFor(() => {
      expect(typeof wired).toBe('function');
    });
  });
});
