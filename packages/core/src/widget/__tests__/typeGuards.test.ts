// Tests for isViewChild (WidgetRegistry) and isViewStateLike (plugins.ts, tested indirectly).
// isViewChild: duck-type check ('applyViewOpacity' in widget && typeof fn === 'function').
// isViewStateLike: local in plugins.ts; exercised via corePlugin().reconcileCompiledTrack().

import { describe, it, expect } from 'vitest';
import { isViewChild, WidgetRegistry } from '../WidgetRegistry';
import { corePlugin } from '../../player/plugins';
import type { IWidget, IViewChild } from '../types';
import type { SceneTrack } from '../../compiler/sceneTrackTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a minimal SceneTrack-like object with a single tick and given widget states. */
function buildTrack(widgets: Record<string, unknown>): SceneTrack {
  return {
    ticks: [
      {
        index: 0,
        progress: 0,
        sceneId: 'scene-0',
        sceneIndex: 0,
        blockProgress: 0,
        state: { widgets, sceneOverlay: undefined },
        deltaForward: {},
        deltaBackward: {},
      },
    ],
  } as unknown as SceneTrack;
}

/** A complete view-state-like object that satisfies all isViewStateLike checks. */
const validViewState = {
  id: 'view-1',
  bounds: { x: 0, y: 0, w: 1, h: 1 },
  contentBounds: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 },
  childWidgetIds: ['child-a'],
};

// ─── isViewChild ───────────────────────────────────────────────────────────────

describe('isViewChild', () => {
  it('returns true for a widget with an applyViewOpacity function', () => {
    const widget: IViewChild = {
      widgetId: 'w1',
      applyViewOpacity: (_opacity: number) => {},
    };
    expect(isViewChild(widget)).toBe(true);
  });

  it('returns false for a plain IWidget without applyViewOpacity', () => {
    const widget: IWidget = { widgetId: 'w1' };
    expect(isViewChild(widget)).toBe(false);
  });

  it('returns false when applyViewOpacity is not a function', () => {
    const widget = { widgetId: 'w1', applyViewOpacity: 'not-a-function' } as unknown as IWidget;
    expect(isViewChild(widget)).toBe(false);
  });

  it('returns false when applyViewOpacity is null', () => {
    const widget = { widgetId: 'w1', applyViewOpacity: null } as unknown as IWidget;
    expect(isViewChild(widget)).toBe(false);
  });
});

// ─── WidgetRegistry.getWidgetObject / setWidgetObject / clearWidgetObject ─────

describe('WidgetRegistry widget object map', () => {
  it('getWidgetObject returns the stored object after setWidgetObject', () => {
    const registry = new WidgetRegistry();
    const obj = { uuid: 'test-obj', isObject3D: true } as unknown as import('three').Object3D;
    registry.setWidgetObject('widget-1', obj);
    expect(registry.getWidgetObject('widget-1')).toBe(obj);
  });

  it('getWidgetObject returns undefined for an unknown widgetId', () => {
    const registry = new WidgetRegistry();
    expect(registry.getWidgetObject('nonexistent')).toBeUndefined();
  });

  it('clearWidgetObject removes the stored object', () => {
    const registry = new WidgetRegistry();
    const obj = { uuid: 'test-obj', isObject3D: true } as unknown as import('three').Object3D;
    registry.setWidgetObject('widget-1', obj);
    registry.clearWidgetObject('widget-1');
    expect(registry.getWidgetObject('widget-1')).toBeUndefined();
  });

  it('setWidgetObject overwrites an existing entry for the same widgetId', () => {
    const registry = new WidgetRegistry();
    const obj1 = { uuid: 'obj-1' } as unknown as import('three').Object3D;
    const obj2 = { uuid: 'obj-2' } as unknown as import('three').Object3D;
    registry.setWidgetObject('widget-1', obj1);
    registry.setWidgetObject('widget-1', obj2);
    expect(registry.getWidgetObject('widget-1')).toBe(obj2);
  });
});

// ─── isViewStateLike (indirect via reconcileCompiledTrack) ────────────────────

describe('isViewStateLike — indirect via reconcileCompiledTrack', () => {
  it('registers a ViewWidget for an object with id, bounds, contentBounds, and childWidgetIds array', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();
    plugin.reconcileCompiledTrack!(registry, buildTrack({ 'view-1': validViewState }));
    expect(registry.get('view-1')).toBeDefined();
  });

  it('does not register a ViewWidget for null', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();
    plugin.reconcileCompiledTrack!(registry, buildTrack({ 'view-1': null }));
    expect(registry.get('view-1')).toBeUndefined();
  });

  it('does not register a ViewWidget for undefined', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();
    plugin.reconcileCompiledTrack!(registry, buildTrack({ 'view-1': undefined }));
    expect(registry.get('view-1')).toBeUndefined();
  });

  it('does not register a ViewWidget when childWidgetIds is missing', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();
    const state = { id: 'view-1', bounds: { x: 0, y: 0, w: 1, h: 1 }, contentBounds: { x: 0, y: 0, w: 1, h: 1 } };
    plugin.reconcileCompiledTrack!(registry, buildTrack({ 'view-1': state }));
    expect(registry.get('view-1')).toBeUndefined();
  });

  it('does not register a ViewWidget when childWidgetIds is not an array', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();
    const state = { id: 'view-1', bounds: {}, contentBounds: {}, childWidgetIds: 'not-an-array' };
    plugin.reconcileCompiledTrack!(registry, buildTrack({ 'view-1': state }));
    expect(registry.get('view-1')).toBeUndefined();
  });

  it('does not register a ViewWidget when bounds is missing', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();
    const state = { id: 'view-1', contentBounds: {}, childWidgetIds: [] };
    plugin.reconcileCompiledTrack!(registry, buildTrack({ 'view-1': state }));
    expect(registry.get('view-1')).toBeUndefined();
  });

  it('does not register a ViewWidget when id is not a string', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();
    const state = { id: 42, bounds: {}, contentBounds: {}, childWidgetIds: [] };
    plugin.reconcileCompiledTrack!(registry, buildTrack({ 'view-1': state }));
    expect(registry.get('view-1')).toBeUndefined();
  });

  it('skips a view state for an already-registered widgetId', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();
    const preExisting: IWidget = { widgetId: 'view-1' };
    registry.register(preExisting);
    plugin.reconcileCompiledTrack!(registry, buildTrack({ 'view-1': validViewState }));
    expect(registry.get('view-1')).toBe(preExisting);
  });
});
