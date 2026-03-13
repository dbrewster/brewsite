// Tests for isGroupOwner (WidgetRegistry) and isViewStateLike (plugins.ts, tested indirectly).
// isGroupOwner: duck-type check ('rootGroup' in widget && widget.rootGroup != null).
// isViewStateLike: local in plugins.ts; exercised via corePlugin().reconcileCompiledTrack().

import { describe, it, expect } from 'vitest';
import { isGroupOwner, WidgetRegistry } from '../WidgetRegistry';
import { corePlugin } from '../../player/plugins';
import type { IWidget } from '../types';
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

// ─── isGroupOwner ──────────────────────────────────────────────────────────────

describe('isGroupOwner', () => {
  it('returns true for a widget with a non-null rootGroup property', () => {
    const widget: IWidget & { rootGroup: object } = {
      widgetId: 'w1',
      rootGroup: { uuid: 'fake-group', isObject3D: true },
    };
    expect(isGroupOwner(widget)).toBe(true);
  });

  it('returns false for a plain IWidget without rootGroup property', () => {
    const widget: IWidget = { widgetId: 'w1' };
    expect(isGroupOwner(widget)).toBe(false);
  });

  it('returns false when rootGroup is null', () => {
    const widget = { widgetId: 'w1', rootGroup: null } as IWidget;
    expect(isGroupOwner(widget)).toBe(false);
  });

  it('returns false when rootGroup is undefined', () => {
    const widget = { widgetId: 'w1', rootGroup: undefined } as IWidget;
    expect(isGroupOwner(widget)).toBe(false);
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
    // Pre-register a plain widget with the same id
    const preExisting: IWidget = { widgetId: 'view-1' };
    registry.register(preExisting);
    plugin.reconcileCompiledTrack!(registry, buildTrack({ 'view-1': validViewState }));
    // Should still be the original pre-existing widget
    expect(registry.get('view-1')).toBe(preExisting);
  });
});
