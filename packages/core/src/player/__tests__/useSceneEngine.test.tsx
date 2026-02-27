// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '@testing-library/react';
import { useSceneEngine } from '../useSceneEngine';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneGroup } from '../../compiler/sceneTypes';
import { LabelPositioner } from '../LabelPositioner';

vi.mock('../useEngineInput', () => {
  return {
    useEngineInput: vi.fn((args: unknown) => ({
      progress: 0,
      scrollToProgress: vi.fn(),
      getGlobalProgress: () => 0,
      __args: args,
    })),
  };
});

vi.mock('../../compiler/sceneTrackCompiler', () => {
  return {
    compileSceneTrack: vi.fn(() => ({ ticks: [] })),
  };
});

vi.mock('../../compiler/sceneTrackCache', () => {
  return {
    buildSceneTrackKey: vi.fn(() => 'key'),
    getCachedTrack: vi.fn(),
    setCachedTrack: vi.fn(),
  };
});

const makeSceneGroup = (): SceneGroup => {
  const scenes = [
    { id: 's1', index: 0, getFrame: () => ({ id: 's1', scrollProgress: 0, widgets: {} }) },
    { id: 's2', index: 1, getFrame: () => ({ id: 's2', scrollProgress: 1, widgets: {} }) },
  ];
  return { id: 'group', scenes };
};

describe('useSceneEngine', () => {
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

  it('computes scroll region height based on scene count', () => {
    const registry = new WidgetRegistry();
    const sceneGroup = makeSceneGroup();
    let height = 0;

    const Test = () => {
      const engine = useSceneEngine({
        sceneGroup,
        widgetRegistry: registry,
        clipMeta: [],
        pixelsPerScene: 500,
      });
      useEffect(() => { height = engine.scrollRegionHeightPx; }, [engine.scrollRegionHeightPx]);
      return <div />;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<Test />);
    });

    expect(height).toBe(1000);
    root.unmount();
  });

  it('setViewportSize forwards to label positioner', () => {
    const registry = new WidgetRegistry();
    const sceneGroup = makeSceneGroup();
    let size: { w: number; h: number } | null = null;
    const positioner = new LabelPositioner();
    positioner.setContainerSize = (w: number, h: number) => {
      size = { w, h };
    };

    const Test = () => {
      const engine = useSceneEngine({ sceneGroup, widgetRegistry: registry, clipMeta: [], labelPositioner: positioner });
      useEffect(() => { engine.setViewportSize(320, 240); }, [engine]);
      return <div />;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<Test />);
    });

    expect(size).toEqual({ w: 320, h: 240 });
    root.unmount();
  });

  it('uses legacy matchMedia listeners when addEventListener is missing', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener,
      removeListener,
    }));

    const registry = new WidgetRegistry();
    const sceneGroup = makeSceneGroup();

    const Test = () => {
      useSceneEngine({ sceneGroup, widgetRegistry: registry, clipMeta: [] });
      return <div />;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<Test />);
    });

    expect(addListener).toHaveBeenCalled();
    root.unmount();
    expect(removeListener).toHaveBeenCalled();
  });

  it('uses cached scene track when available', async () => {
    const { getCachedTrack, setCachedTrack } = await import('../../compiler/sceneTrackCache');
    const { compileSceneTrack } = await import('../../compiler/sceneTrackCompiler');
    (getCachedTrack as unknown as { mock: { returnValue: (v: unknown) => void } }).mock.returnValue({ ticks: [{}, {}] });

    const registry = new WidgetRegistry();
    const sceneGroup = makeSceneGroup();

    const Test = () => {
      useSceneEngine({ sceneGroup, widgetRegistry: registry, clipMeta: [] });
      return <div />;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<Test />);
    });

    expect(compileSceneTrack).not.toHaveBeenCalled();
    expect(setCachedTrack).not.toHaveBeenCalled();
    root.unmount();
  });

  it('compiles scene track when cache misses', async () => {
    const { getCachedTrack, setCachedTrack } = await import('../../compiler/sceneTrackCache');
    const { compileSceneTrack } = await import('../../compiler/sceneTrackCompiler');
    (getCachedTrack as unknown as { mock: { returnValue: (v: unknown) => void } }).mock.returnValue(null);

    const registry = new WidgetRegistry();
    const sceneGroup = makeSceneGroup();

    const Test = () => {
      useSceneEngine({ sceneGroup, widgetRegistry: registry, clipMeta: [] });
      return <div />;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<Test />);
    });

    expect(compileSceneTrack).toHaveBeenCalled();
    expect(setCachedTrack).toHaveBeenCalled();
    root.unmount();
  });

  it('returns direct mode scroll height based on viewport size', () => {
    const registry = new WidgetRegistry();
    const sceneGroup = makeSceneGroup();
    let height = 0;

    const Test = () => {
      const engine = useSceneEngine({
        sceneGroup,
        widgetRegistry: registry,
        clipMeta: [],
        inputMap: { mode: 'direct' },
      });
      useEffect(() => {
        engine.setViewportSize(300, 200);
        height = engine.scrollRegionHeightPx;
      }, [engine]);
      return <div />;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<Test />);
    });

    expect(height).toBe(200);
    root.unmount();
  });

  it('wheelGuard reflects camera widget state', () => {
    const registry = new WidgetRegistry();
    registry.register({
      widgetId: 'camera',
      defaultState: {},
      transitionSpec: { exit: () => {}, enter: () => {}, interpolate: () => {} },
      DslComponent: () => null,
      isWheelClaimedByInteraction: () => true,
    });
    const sceneGroup = makeSceneGroup();

    let wheelGuardResult = false;
    const Test = () => {
      const engine = useSceneEngine({ sceneGroup, widgetRegistry: registry, clipMeta: [] });
      const { useEngineInput } = require('../useEngineInput');
      const args = (useEngineInput as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)?.[0] as { wheelGuard?: () => boolean };
      wheelGuardResult = args?.wheelGuard?.() ?? false;
      return <div />;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<Test />);
    });

    expect(wheelGuardResult).toBe(true);
    root.unmount();
  });

  it('skips scene track when manifest is null', async () => {
    const { compileSceneTrack } = await import('../../compiler/sceneTrackCompiler');
    const registry = new WidgetRegistry();
    const sceneGroup = makeSceneGroup();

    const Test = () => {
      useSceneEngine({ sceneGroup, widgetRegistry: registry, clipMeta: [], manifest: null });
      return <div />;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<Test />);
    });

    expect(compileSceneTrack).not.toHaveBeenCalled();
    root.unmount();
  });
}, {skip: true});
