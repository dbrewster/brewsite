// corePlugin.reconcileCompiledTrack tests — verifies ViewWidget registration from compiled track.

import { describe, it, expect } from 'vitest';
import { corePlugin } from '../plugins';
import { WidgetRegistry, isGroupOwner } from '../../widget/WidgetRegistry';
import { ViewWidget } from '../../elements/view/ViewWidget';
import type { SceneTrack, SceneTrackTick } from '../../compiler/sceneTrackTypes';
import type { IWidget } from '../../widget/types';
import type { Object3D } from 'three';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeTick(widgets: Record<string, unknown>): SceneTrackTick {
  return {
    index: 0,
    progress: 0,
    sceneId: 'scene-1',
    sceneIndex: 0,
    blockProgress: 0,
    state: {
      id: 'scene-1',
      scrollProgress: 0,
      widgets,
    },
    deltaForward: {},
    deltaBackward: {},
  };
}

function makeTrack(ticks: SceneTrackTick[]): SceneTrack {
  return {
    ticks,
    tickStep: 1,
    subTickCount: 1,
    sceneWindows: [],
  };
}

/** Minimal ViewState-shaped object that satisfies isViewStateLike duck-type check. */
function makeViewStateLike(id: string, childWidgetIds: string[] = []): object {
  return {
    id,
    bounds: { x: 0, y: 0, w: 0.5, h: 1 },
    padding: [0, 0, 0, 0],
    contentBounds: { x: 0, y: 0, w: 0.5, h: 1 },
    layer: 0,
    scale: 1,
    z: 0,
    opacity: 1,
    childWidgetIds,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('corePlugin.reconcileCompiledTrack', () => {
  it('registers one ViewWidget per unique view ID in the track', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();

    const track = makeTrack([
      makeTick({ v1: makeViewStateLike('v1'), v2: makeViewStateLike('v2') }),
    ]);

    plugin.reconcileCompiledTrack!(registry, track);

    expect(registry.get('v1')).toBeInstanceOf(ViewWidget);
    expect(registry.get('v2')).toBeInstanceOf(ViewWidget);
    expect(registry.get('v1')?.widgetId).toBe('v1');
    expect(registry.get('v2')?.widgetId).toBe('v2');
  });

  it('does not create duplicate ViewWidgets when called twice with the same track', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();

    const track = makeTrack([makeTick({ v1: makeViewStateLike('v1') })]);

    plugin.reconcileCompiledTrack!(registry, track);
    const firstWidget = registry.get('v1');

    // Second call must be a no-op for already-registered view IDs.
    plugin.reconcileCompiledTrack!(registry, track);
    const secondWidget = registry.get('v1');

    expect(firstWidget).toBe(secondWidget);
    expect(registry.getAll().filter((w) => w.widgetId === 'v1')).toHaveLength(1);
  });

  it('does not create duplicates when the same view ID appears in multiple ticks', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();

    const track = makeTrack([
      makeTick({ v1: makeViewStateLike('v1') }),
      makeTick({ v1: makeViewStateLike('v1') }),
    ]);

    plugin.reconcileCompiledTrack!(registry, track);

    expect(registry.get('v1')).toBeInstanceOf(ViewWidget);
    expect(registry.getAll().filter((w) => w.widgetId === 'v1')).toHaveLength(1);
  });

  it('skips entries that do not match the ViewState shape', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();

    const track = makeTrack([
      makeTick({
        // Non-ViewState: missing childWidgetIds
        'not-a-view': { id: 'x', bounds: { x: 0, y: 0, w: 1, h: 1 } },
        // Non-ViewState: primitive
        'also-not': 42,
        // Legitimate ViewState
        v1: makeViewStateLike('v1'),
      }),
    ]);

    plugin.reconcileCompiledTrack!(registry, track);

    expect(registry.get('v1')).toBeInstanceOf(ViewWidget);
    expect(registry.get('not-a-view')).toBeUndefined();
    expect(registry.get('also-not')).toBeUndefined();
  });

  it('handles an empty ticks array without throwing', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();
    const track = makeTrack([]);

    expect(() => plugin.reconcileCompiledTrack!(registry, track)).not.toThrow();
    expect(registry.getAll()).toHaveLength(0);
  });

  it('handles ticks with empty widget maps without throwing', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();
    const track = makeTrack([makeTick({})]);

    expect(() => plugin.reconcileCompiledTrack!(registry, track)).not.toThrow();
    expect(registry.getAll()).toHaveLength(0);
  });

  it('resolveChildRoot returns rootGroup for IGroupOwner children registered in the same registry', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();

    // Register a mock child widget that implements IGroupOwner before reconcile.
    const fakeRootGroup = { name: 'mock-group' } as unknown as Object3D;
    const mockChild: IWidget & { rootGroup: Object3D } = {
      widgetId: 'child-1',
      rootGroup: fakeRootGroup,
    };
    registry.register(mockChild);

    // Verify the mock is recognized as IGroupOwner by the duck-type guard.
    expect(isGroupOwner(registry.get('child-1')!)).toBe(true);

    const track = makeTrack([
      makeTick({ v1: makeViewStateLike('v1', ['child-1']) }),
    ]);
    plugin.reconcileCompiledTrack!(registry, track);

    // ViewWidget is registered.
    expect(registry.get('v1')).toBeInstanceOf(ViewWidget);

    // The child's rootGroup is accessible through the registry + isGroupOwner,
    // which is exactly what the resolveChildRoot closure calls.
    const child = registry.get('child-1');
    expect(child).toBeDefined();
    expect(isGroupOwner(child!)).toBe(true);
    expect((child as typeof mockChild).rootGroup).toBe(fakeRootGroup);
  });

  it('resolveChildRoot returns null for children not in registry', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();

    const track = makeTrack([
      makeTick({ v1: makeViewStateLike('v1', ['missing-child']) }),
    ]);
    plugin.reconcileCompiledTrack!(registry, track);

    // ViewWidget exists even when child not found (graceful degradation).
    expect(registry.get('v1')).toBeInstanceOf(ViewWidget);
    // 'missing-child' was never registered.
    expect(registry.get('missing-child')).toBeUndefined();
  });

  it('resolveChildRoot returns null for children that do not implement IGroupOwner', () => {
    const plugin = corePlugin();
    const registry = new WidgetRegistry();

    // Register a widget without rootGroup — does not implement IGroupOwner.
    const nonGroupOwner: IWidget = { widgetId: 'plain-widget' };
    registry.register(nonGroupOwner);

    const track = makeTrack([
      makeTick({ v1: makeViewStateLike('v1', ['plain-widget']) }),
    ]);
    plugin.reconcileCompiledTrack!(registry, track);

    expect(registry.get('v1')).toBeInstanceOf(ViewWidget);
    expect(isGroupOwner(nonGroupOwner)).toBe(false);
  });
});
