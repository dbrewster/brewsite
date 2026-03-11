// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '@testing-library/react';
import { useSceneEngine } from '../useSceneEngine';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { Scene } from '../../compiler/sceneDslCompiler';
import type { DslBreadcrumb } from '../../compiler/sceneTrackTypes';

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

const makeScenes = () => [
  { sceneKey: 's1', contentKey: 'scene:s1', element: <Scene id="s1" /> },
  { sceneKey: 's2', contentKey: 'scene:s2', element: <Scene id="s2" /> },
];

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
    const scenes = makeScenes();
    let height = 0;

    const Test = () => {
      const engine = useSceneEngine({
        scenes,
        widgetRegistry: registry,
        
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


  it('uses legacy matchMedia listeners when addEventListener is missing', () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener,
      removeListener,
    }));

    const registry = new WidgetRegistry();
    const scenes = makeScenes();

    const Test = () => {
      useSceneEngine({ scenes, widgetRegistry: registry });
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
    const scenes = makeScenes();

    const Test = () => {
      useSceneEngine({ scenes, widgetRegistry: registry });
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
    const scenes = makeScenes();

    const Test = () => {
      useSceneEngine({ scenes, widgetRegistry: registry });
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

  it('uses scroll-mode region height when scene InputController is not authored', () => {
    const registry = new WidgetRegistry();
    const scenes = makeScenes();
    let height = 0;

    const Test = () => {
      const engine = useSceneEngine({
        scenes,
        widgetRegistry: registry,
        
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
    expect(height).toBe(211);
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
    const scenes = makeScenes();

    let wheelGuardResult = false;
    const Test = () => {
      const engine = useSceneEngine({ scenes, widgetRegistry: registry });
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
    const scenes = makeScenes();

    const Test = () => {
      useSceneEngine({ scenes, widgetRegistry: registry,  manifest: null });
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

// ─── Warning logging tests ────────────────────────────────────────────────────
// These tests verify enriched console.warn output when compiled warnings include
// elementAncestry. They use the mock compileSceneTrack (already mocked above)
// to inject prebuilt warnings directly into the engine.

describe('useSceneEngine warning logging', () => {
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
    vi.restoreAllMocks();
  });

  it('logs enriched console.warn with ancestry chain when elementAncestry is present', async () => {
    const { compileSceneTrack } = await import('../../compiler/sceneTrackCompiler');
    const ancestry: DslBreadcrumb[] = [
      { componentName: 'Scene', key: 'test' },
      { componentName: 'div' },
    ];
    (compileSceneTrack as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      ticks: [],
      warnings: [
        {
          code: 'MISSING_KEY',
          message: 'An overlay element <div> has no key.',
          elementAncestry: ancestry,
        },
      ],
    });

    const { getCachedTrack } = await import('../../compiler/sceneTrackCache');
    (getCachedTrack as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const registry = new WidgetRegistry();
    const scenes = [
      { sceneKey: 's1', contentKey: 'scene:s1', element: <Scene id="s1" /> },
    ];

    const Test = () => {
      useSceneEngine({ scenes, widgetRegistry: registry });
      return <div />;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<Test />);
    });

    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    const ancestryCall = calls.find((msg) => msg.includes('DSL ancestry:'));
    expect(ancestryCall).toBeDefined();
    expect(ancestryCall).toContain('Scene[test]');
    expect(ancestryCall).toContain('div');

    root.unmount();
  });

  it('logs plain console.warn when elementAncestry is absent', async () => {
    const { compileSceneTrack } = await import('../../compiler/sceneTrackCompiler');
    (compileSceneTrack as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      ticks: [],
      warnings: [
        {
          code: 'MISSING_WIDGET',
          message: 'Widget "foo" is not registered.',
        },
      ],
    });

    const { getCachedTrack } = await import('../../compiler/sceneTrackCache');
    (getCachedTrack as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const registry = new WidgetRegistry();
    const scenes = [
      { sceneKey: 's1', contentKey: 'scene:s1', element: <Scene id="s1" /> },
    ];

    const Test = () => {
      useSceneEngine({ scenes, widgetRegistry: registry });
      return <div />;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<Test />);
    });

    const calls = warnSpy.mock.calls.map((c) => String(c[0]));
    const plainCall = calls.find((msg) => msg.includes('[BrewSite]') && msg.includes('Widget "foo"'));
    expect(plainCall).toBeDefined();
    expect(plainCall).not.toContain('DSL ancestry:');

    root.unmount();
  });
});

describe('useSceneEngine plugin reconciliation', () => {
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
    vi.restoreAllMocks();
  });

  it('reconciles cached scene tracks through plugins', async () => {
    const { getCachedTrack } = await import('../../compiler/sceneTrackCache');
    const cachedTrack = { ticks: [], warnings: [] };
    (getCachedTrack as ReturnType<typeof vi.fn>).mockReturnValueOnce(cachedTrack);

    const reconcileCompiledTrack = vi.fn();
    const registry = new WidgetRegistry();
    const scenes = [{ sceneKey: 's1', contentKey: 'scene:s1', element: <Scene id="s1" /> }];

    const Test = () => {
      useSceneEngine({
        scenes,
        widgetRegistry: registry,
        plugins: [{
          createWidgets: () => [],
          registerHandlers: () => {},
          reconcileCompiledTrack,
        }],
      });
      return <div />;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<Test />);
    });

    expect(reconcileCompiledTrack).toHaveBeenCalledWith(registry, cachedTrack);
    root.unmount();
  });

  it('reconciles freshly compiled scene tracks through plugins', async () => {
    const { getCachedTrack } = await import('../../compiler/sceneTrackCache');
    const { compileSceneTrack } = await import('../../compiler/sceneTrackCompiler');
    const compiledTrack = { ticks: [], warnings: [] };
    (getCachedTrack as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    (compileSceneTrack as ReturnType<typeof vi.fn>).mockReturnValueOnce(compiledTrack);

    const reconcileCompiledTrack = vi.fn();
    const registry = new WidgetRegistry();
    const scenes = [{ sceneKey: 's1', contentKey: 'scene:s1', element: <Scene id="s1" /> }];

    const Test = () => {
      useSceneEngine({
        scenes,
        widgetRegistry: registry,
        plugins: [{
          createWidgets: () => [],
          registerHandlers: () => {},
          reconcileCompiledTrack,
        }],
      });
      return <div />;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<Test />);
    });

    expect(reconcileCompiledTrack).toHaveBeenCalledWith(registry, compiledTrack);
    root.unmount();
  });
});
