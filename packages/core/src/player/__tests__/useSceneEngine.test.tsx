// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from '@testing-library/react';
import { useSceneEngine } from '../useSceneEngine';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneGroup } from '../../compiler/sceneTypes';
import { LabelPositioner } from '../LabelPositioner';

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
});
