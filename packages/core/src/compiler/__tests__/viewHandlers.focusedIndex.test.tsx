// Tests for focusedIndex/activeIndex resolution in viewLayoutHandler.
// Uses the same compile() pattern as viewHandlers.test.tsx.

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveSceneFromDsl, Scene } from '../sceneDslCompiler';
import { clearRegistry } from '../registry';
import { registerCoreHandlers, resetCoreHandlerRegistrationForTesting } from '../coreHandlers';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneSnapshotContext } from '../sceneTypes';
import { View } from '../blocks/viewDsl';
import { ViewLayout } from '../blocks/viewLayoutDsl';
import type { ViewLayoutState } from '../viewTypes';
import type { CarouselLayoutConfig } from '../../layout/regionTypes';

const testContext: SceneSnapshotContext = {
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: true,
  themeFamily: 'default',
  themePolarity: 'dark',
};

const registry = new WidgetRegistry();

function compile(tree: React.ReactElement): Record<string, unknown> {
  const result = resolveSceneFromDsl(tree, testContext, registry);
  return result.frame.widgets;
}

beforeEach(() => {
  clearRegistry();
  resetCoreHandlerRegistrationForTesting();
  registerCoreHandlers();
});

describe('viewLayoutHandler — focusedIndex resolution', () => {
  it('uses focusedIndex when provided', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout id="cl" kind="carousel" focusedIndex={2}>
          <View id="v0" />
          <View id="v1" />
          <View id="v2" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const state = widgets['cl'] as ViewLayoutState;
    const config = state.layoutConfig as CarouselLayoutConfig;
    expect(config.activeIndex).toBe(2);
  });

  it('uses activeIndex as fallback with deprecation warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const tree = (
      <Scene id="s1">
        <ViewLayout id="cl" kind="carousel" activeIndex={1}>
          <View id="v0" />
          <View id="v1" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const state = widgets['cl'] as ViewLayoutState;
    const config = state.layoutConfig as CarouselLayoutConfig;
    expect(config.activeIndex).toBe(1);

    // Verify deprecation warning was emitted
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('`activeIndex` is deprecated'),
    );

    warnSpy.mockRestore();
  });

  it('focusedIndex takes precedence over activeIndex when both set', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const tree = (
      <Scene id="s1">
        <ViewLayout id="cl" kind="carousel" focusedIndex={3} activeIndex={1}>
          <View id="v0" />
          <View id="v1" />
          <View id="v2" />
          <View id="v3" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const state = widgets['cl'] as ViewLayoutState;
    const config = state.layoutConfig as CarouselLayoutConfig;
    expect(config.activeIndex).toBe(3);

    // No deprecation warning because focusedIndex was used
    const deprecationCalls = warnSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('`activeIndex` is deprecated'),
    );
    expect(deprecationCalls).toHaveLength(0);

    warnSpy.mockRestore();
  });

  it('defaults to 0 when neither is provided', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout id="cl" kind="carousel">
          <View id="v0" />
          <View id="v1" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const state = widgets['cl'] as ViewLayoutState;
    const config = state.layoutConfig as CarouselLayoutConfig;
    expect(config.activeIndex).toBe(0);
  });
});
