// Tests for createChildApi — verifies childWidgetIds tracking and composition delegation.
// Uses a real CompileApi double (plain object factory, not vi.fn() mocks), since
// createChildApi spreads the parentApi — class prototype methods are not spread-copyable.

import { describe, it, expect, beforeEach } from 'vitest';
import { createChildApi } from '../childApi';
import type { CompileApi } from '../sceneDslTypes';
import type { NVSRect } from '../../layout/types';
import type { SceneFrame } from '../sceneTrackTypes';
import type { SceneSnapshotContext } from '../sceneTypes';

// ── Real CompileApi double factory ────────────────────────────────────────────
// Returns a plain CompileApi-conforming object with observable state for assertions.
// Uses arrow functions as own properties (not prototype methods) so object spread
// correctly copies all methods — matching how the real CompileApi is constructed
// in sceneDslCompiler.ts.

function buildTestApi(overrides?: Partial<CompileApi>): CompileApi & {
  readonly widgetStateLog: Array<{ widgetId: string; state: unknown }>;
  readonly overlayLog: unknown[];
} {
  const state: SceneFrame = { widgets: {}, sceneOverlay: undefined };
  const context: SceneSnapshotContext = {
    sceneIndex: 0,
    numScenes: 1,
    assetsReady: true,
  };
  const widgetStateLog: Array<{ widgetId: string; state: unknown }> = [];
  const overlayLog: unknown[] = [];

  const api = {
    state,
    context,
    widgetStateLog,
    overlayLog,
    setWidgetState: (widgetId: string, s: unknown): void => {
      state.widgets[widgetId] = s;
      widgetStateLog.push({ widgetId, state: s });
    },
    setSceneMeta: (_meta: { id?: string; meta?: Record<string, unknown> }): void => { /* no-op */ },
    pushWarning: (_w: unknown): void => { /* no-op */ },
    composeBounds: (localRect: NVSRect): NVSRect => ({ ...localRect }),
    composeZ: (localZ: number): number => localZ,
    composeOpacity: (localOpacity: number): number => localOpacity,
    pushOverlay: (node: unknown): void => { overlayLog.push(node); },
    ...overrides,
  };
  return api;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('createChildApi — childWidgetIds tracking', () => {
  let parent: ReturnType<typeof buildTestApi>;

  beforeEach(() => {
    parent = buildTestApi();
  });

  it('returns empty childWidgetIds when no setWidgetState is called', () => {
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 });
    expect(childApi.childWidgetIds).toEqual([]);
  });

  it('accumulates a single widgetId from setWidgetState', () => {
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 });
    childApi.setWidgetState('widget-1', { value: 42 });
    expect(childApi.childWidgetIds).toEqual(['widget-1']);
  });

  it('accumulates multiple widgetIds in call order', () => {
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 });
    childApi.setWidgetState('a', {});
    childApi.setWidgetState('b', {});
    childApi.setWidgetState('c', {});
    expect(childApi.childWidgetIds).toEqual(['a', 'b', 'c']);
  });

  it('delegates setWidgetState to parentApi', () => {
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 });
    childApi.setWidgetState('w1', { compiled: true });
    // Parent should have received the call
    expect(parent.widgetStateLog).toHaveLength(1);
    expect(parent.widgetStateLog[0]).toEqual({ widgetId: 'w1', state: { compiled: true } });
    // Parent's state.widgets should be updated
    expect(parent.state.widgets['w1']).toEqual({ compiled: true });
  });

  it('childWidgetIds array is the same reference across calls (live)', () => {
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 });
    const ref = childApi.childWidgetIds;
    childApi.setWidgetState('x', {});
    // Same array reference — reflects new additions
    expect(ref).toContain('x');
  });

  it('duplicate widgetIds are recorded if setWidgetState is called twice with same id', () => {
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 });
    childApi.setWidgetState('dup', { v: 1 });
    childApi.setWidgetState('dup', { v: 2 });
    // Both calls are tracked (order preserved)
    expect(childApi.childWidgetIds).toHaveLength(2);
    expect(childApi.childWidgetIds.every((id) => id === 'dup')).toBe(true);
  });

  it('chained childApi (grandchild) calls also propagate to parent childWidgetIds', () => {
    // When a childApi creates its own childApi (nested views), grandchild IDs
    // bubble up through the chain because setWidgetState delegates to parentApi.
    const outerChildApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 });
    const innerChildApi = createChildApi(outerChildApi, { x: 0, y: 0, w: 0.5, h: 0.5 });

    innerChildApi.setWidgetState('grandchild', { g: true });
    // Grandchild bubbles up to outer because outer wraps setWidgetState
    expect(outerChildApi.childWidgetIds).toContain('grandchild');
    // And also tracked in inner's own list
    expect(innerChildApi.childWidgetIds).toContain('grandchild');
  });
});

describe('createChildApi — composeBounds delegation', () => {
  it('maps local [0,0,1,1] to parentContentBounds when parent composeBounds is identity', () => {
    const parent = buildTestApi();
    const contentBounds: NVSRect = { x: 0.1, y: 0.2, w: 0.6, h: 0.4 };
    const childApi = createChildApi(parent, contentBounds);
    const result = childApi.composeBounds({ x: 0, y: 0, w: 1, h: 1 });
    expect(result.x).toBeCloseTo(0.1);
    expect(result.y).toBeCloseTo(0.2);
    expect(result.w).toBeCloseTo(0.6);
    expect(result.h).toBeCloseTo(0.4);
  });

  it('maps local half-rect inside parentContentBounds', () => {
    const parent = buildTestApi();
    const contentBounds: NVSRect = { x: 0, y: 0, w: 0.8, h: 0.8 };
    const childApi = createChildApi(parent, contentBounds);
    // local {0.5, 0.5, 0.5, 0.5} inside {0, 0, 0.8, 0.8}
    // → absolute {0.4, 0.4, 0.4, 0.4}
    const result = childApi.composeBounds({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
    expect(result.x).toBeCloseTo(0.4);
    expect(result.y).toBeCloseTo(0.4);
    expect(result.w).toBeCloseTo(0.4);
    expect(result.h).toBeCloseTo(0.4);
  });

  it('chains with parent composeBounds (non-identity parent)', () => {
    // Parent composeBounds shifts x by +0.05
    const shiftingParent = buildTestApi({
      composeBounds: (localRect: NVSRect) => ({ ...localRect, x: localRect.x + 0.05 }),
    });
    const contentBounds: NVSRect = { x: 0.1, y: 0, w: 0.5, h: 1 };
    const childApi = createChildApi(shiftingParent, contentBounds);
    // local {0, 0, 1, 1} → composed into contentBounds → {0.1, 0, 0.5, 1}
    // → parent shifts x by 0.05 → {0.15, 0, 0.5, 1}
    const result = childApi.composeBounds({ x: 0, y: 0, w: 1, h: 1 });
    expect(result.x).toBeCloseTo(0.15);
  });
});

describe('createChildApi — composeZ delegation', () => {
  it('returns localZ when zOffset is 0', () => {
    const parent = buildTestApi();
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 }, 0);
    expect(childApi.composeZ(2)).toBe(2);
  });

  it('adds zOffset to localZ', () => {
    const parent = buildTestApi();
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 }, 5);
    expect(childApi.composeZ(3)).toBe(8);
  });

  it('chains with parent composeZ', () => {
    // Parent adds +10 to every composeZ call
    const offsetParent = buildTestApi({
      composeZ: (localZ: number) => localZ + 10,
    });
    const childApi = createChildApi(offsetParent, { x: 0, y: 0, w: 1, h: 1 }, 2);
    // child composeZ(1) → parent.composeZ(1 + 2) → 3 + 10 = 13
    expect(childApi.composeZ(1)).toBe(13);
  });
});

describe('createChildApi — composeOpacity delegation', () => {
  it('returns localOpacity when opacityScale is 1 (default)', () => {
    const parent = buildTestApi();
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 });
    expect(childApi.composeOpacity(0.8)).toBeCloseTo(0.8);
  });

  it('multiplies localOpacity by opacityScale', () => {
    const parent = buildTestApi();
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 }, 0, 0.5);
    expect(childApi.composeOpacity(1.0)).toBeCloseTo(0.5);
    expect(childApi.composeOpacity(0.4)).toBeCloseTo(0.2);
  });

  it('chains with parent composeOpacity', () => {
    // Parent multiplies by 0.5
    const halfParent = buildTestApi({
      composeOpacity: (localOpacity: number) => localOpacity * 0.5,
    });
    const childApi = createChildApi(halfParent, { x: 0, y: 0, w: 1, h: 1 }, 0, 0.8);
    // child.composeOpacity(1) → parent.composeOpacity(1 * 0.8) → 0.8 * 0.5 = 0.4
    expect(childApi.composeOpacity(1.0)).toBeCloseTo(0.4);
  });
});

describe('createChildApi — pushOverlay delegation', () => {
  it('delegates pushOverlay to parentApi', () => {
    const parent = buildTestApi();
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 });
    const node = { type: 'div' };
    childApi.pushOverlay(node);
    expect(parent.overlayLog).toContain(node);
  });
});

describe('createChildApi — context and state pass-through', () => {
  it('exposes parentApi context', () => {
    const parent = buildTestApi();
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 });
    expect(childApi.context).toBe(parent.context);
  });

  it('exposes parentApi state', () => {
    const parent = buildTestApi();
    const childApi = createChildApi(parent, { x: 0, y: 0, w: 1, h: 1 });
    expect(childApi.state).toBe(parent.state);
  });
});
