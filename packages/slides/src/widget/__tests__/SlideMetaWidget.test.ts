// Tests for SlideMetaWidget.apply() — verifies correct VariableStore key publication.

import { describe, it, expect, beforeEach } from 'vitest';
import { VariableStore } from '@brewsite/core';
import { SlideMetaWidget, SLIDE_META_NAMESPACE, type SlideMetaState } from '../SlideMetaWidget';
import type { WidgetRenderContext } from '@brewsite/core';
import type { SceneTrackTick } from '@brewsite/core';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function buildMockCtx(
  store: VariableStore,
  sceneProgress: number,
): WidgetRenderContext {
  return {
    clock: { wallTimeSeconds: 0, deltaSeconds: 0.016 },
    effectiveDeltaSeconds: 0.016,
    globalProgress: 0.5,
    variables: store,
    extra: undefined,
    tick: {
      sceneProgress,
      blockProgress: sceneProgress,
      sceneIndex: 0,
      sceneId: 'slide-1',
      index: 50,
      progress: 0.5,
      state: { id: 'slide-1', scrollProgress: 0.5, widgets: {} },
      deltaForward: {},
      deltaBackward: {},
    } as unknown as SceneTrackTick,
  };
}

function buildState(overrides?: Partial<SlideMetaState>): SlideMetaState {
  return {
    slideKey: 'slide-1',
    logicalIndex: 0,
    totalSlides: 3,
    notes: 'Talk point A',
    title: 'Slide One',
    hasAnimatedList: true,
    totalBullets: 3,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SlideMetaWidget', () => {
  let widget: SlideMetaWidget;
  let store: VariableStore;

  beforeEach(() => {
    widget = new SlideMetaWidget();
    store = new VariableStore();
  });

  it('has the correct widgetId', () => {
    expect(widget.widgetId).toBe('slide-meta');
  });

  it('has a non-null DslComponent', () => {
    expect(widget.DslComponent).toBeDefined();
    expect(typeof widget.DslComponent).toBe('function');
  });

  it('has a valid defaultState', () => {
    expect(widget.defaultState.slideKey).toBe('');
    expect(widget.defaultState.logicalIndex).toBe(0);
    expect(widget.defaultState.totalSlides).toBe(1);
    expect(widget.defaultState.hasAnimatedList).toBe(false);
    expect(widget.defaultState.totalBullets).toBe(0);
  });

  it('apply() publishes currentSlideKey to VariableStore', () => {
    widget.apply(buildState(), buildMockCtx(store, 0.5));
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['currentSlideKey']).toBe('slide-1');
  });

  it('apply() publishes currentLogicalIndex correctly', () => {
    widget.apply(buildState({ logicalIndex: 2 }), buildMockCtx(store, 0));
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['currentLogicalIndex']).toBe(2);
  });

  it('apply() publishes totalSlides correctly', () => {
    widget.apply(buildState({ totalSlides: 3 }), buildMockCtx(store, 0));
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['totalSlides']).toBe(3);
  });

  it('apply() publishes notes under slideKey namespace', () => {
    widget.apply(buildState({ notes: 'Talk point A' }), buildMockCtx(store, 0));
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['slide-1.notes']).toBe('Talk point A');
  });

  it('apply() publishes null for notes when undefined', () => {
    widget.apply(buildState({ notes: undefined }), buildMockCtx(store, 0));
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['slide-1.notes']).toBeNull();
  });

  it('apply() publishes title under slideKey namespace', () => {
    widget.apply(buildState({ title: 'Slide One' }), buildMockCtx(store, 0));
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['slide-1.title']).toBe('Slide One');
  });

  it('apply() publishes null for title when undefined', () => {
    widget.apply(buildState({ title: undefined }), buildMockCtx(store, 0));
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['slide-1.title']).toBeNull();
  });

  it('apply() publishes hasAnimatedList as 1 when true', () => {
    widget.apply(buildState({ hasAnimatedList: true }), buildMockCtx(store, 0));
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['slide-1.hasAnimatedList']).toBe(1);
  });

  it('apply() publishes hasAnimatedList as 0 when false', () => {
    widget.apply(buildState({ hasAnimatedList: false }), buildMockCtx(store, 0));
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['slide-1.hasAnimatedList']).toBe(0);
  });

  it('apply() publishes totalBullets correctly', () => {
    widget.apply(buildState({ totalBullets: 3 }), buildMockCtx(store, 0));
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['slide-1.totalBullets']).toBe(3);
  });

  it('apply() publishes sceneProgress from tick', () => {
    widget.apply(buildState(), buildMockCtx(store, 0.75));
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['slide-1.sceneProgress']).toBeCloseTo(0.75);
  });

  it('apply() defaults sceneProgress to 0 when tick is absent', () => {
    const ctxNoTick: WidgetRenderContext = {
      clock: { wallTimeSeconds: 0, deltaSeconds: 0.016 },
      effectiveDeltaSeconds: 0.016,
      globalProgress: 0,
      variables: store,
      extra: undefined,
      tick: null,
    };
    widget.apply(buildState(), ctxNoTick);
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['slide-1.sceneProgress']).toBe(0);
  });

  it('apply() defaults sceneProgress to 0 when tick.sceneProgress is absent', () => {
    const ctxNoSP: WidgetRenderContext = {
      clock: { wallTimeSeconds: 0, deltaSeconds: 0.016 },
      effectiveDeltaSeconds: 0.016,
      globalProgress: 0,
      variables: store,
      extra: undefined,
      tick: {
        blockProgress: 0.5,
        sceneIndex: 0,
        sceneId: 'slide-1',
        index: 0,
        progress: 0,
        state: { id: 'slide-1', scrollProgress: 0, widgets: {} },
        deltaForward: {},
        deltaBackward: {},
        // sceneProgress intentionally absent
      } as unknown as SceneTrackTick,
    };
    widget.apply(buildState(), ctxNoSP);
    const ns = store.getNamespace(SLIDE_META_NAMESPACE);
    expect(ns['slide-1.sceneProgress']).toBe(0);
  });

  it('transitionSpec.interpolateFn snaps to toState at any t', () => {
    const from = buildState({ logicalIndex: 0 });
    const to = buildState({ logicalIndex: 1 });
    const fn = widget.transitionSpec.interpolateFn(from, to);
    // Cast to satisfy TS — we pass a minimal ctx with a t value
    const result = fn({ t: 0.5, bp: 0.5, channel: () => 0.5 });
    expect(result.logicalIndex).toBe(1);
  });

  it('transitionSpec.exitFn returns fromState at any t', () => {
    const from = buildState({ logicalIndex: 0 });
    const fn = widget.transitionSpec.exitFn(from);
    const result = fn({ t: 0.9, bp: 0.9, channel: () => 0.9 });
    expect(result.logicalIndex).toBe(0);
  });

  it('transitionSpec.enterFn returns toState at any t', () => {
    const to = buildState({ logicalIndex: 2 });
    const fn = widget.transitionSpec.enterFn(to);
    const result = fn({ t: 0.1, bp: 0.1, channel: () => 0.1 });
    expect(result.logicalIndex).toBe(2);
  });

  it('initialize() and dispose() are no-ops (no throw)', () => {
    expect(() => widget.initialize({} as never)).not.toThrow();
    expect(() => widget.dispose()).not.toThrow();
  });
});
