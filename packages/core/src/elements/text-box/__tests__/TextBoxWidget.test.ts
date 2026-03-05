// TextBoxWidget.test.ts — interface-based stateful tests.
// Tests the widget's contract: constructor defaults, apply() VariableStore writes,
// dispose() childrenMap cleanup, and transitionSpec closure behavior.
// No vi.fn(), no vi.mock(), no vi.spyOn() on internals.

import { describe, it, expect, beforeEach } from 'vitest';
import type React from 'react';
import { TextBoxWidget, TEXTBOX_NAMESPACE, functionalTextBoxTransitionSpec } from '../TextBoxWidget';
import type { TextBoxState } from '../types';
import { VariableStore } from '../../../widget/VariableStore';
import type { WidgetRenderContext, WidgetInitContext } from '../../../widget/types';
import { makeSimpleContext } from '../../../compiler/transitions/transitionResolver';
import * as THREE from 'three';

// ─── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Builds a minimal WidgetRenderContext with a real VariableStore.
 * Used to test apply() write side effects.
 */
const makeRenderCtx = (
  store: VariableStore,
): WidgetRenderContext => ({
  clock: { wallTimeSeconds: 0, deltaSeconds: 0 },
  effectiveDeltaSeconds: 0,
  globalProgress: 0,
  variables: store,
  extra: undefined,
  tick: null,
});

const makeInitCtx = (): WidgetInitContext => ({
  scene: new THREE.Scene(),
  widgetId: 'test-box',
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TextBoxWidget', () => {
  let childrenMap: Map<string, React.ReactNode>;
  let widget: TextBoxWidget;
  let store: VariableStore;

  beforeEach(() => {
    childrenMap = new Map();
    widget = new TextBoxWidget('panel-left', childrenMap);
    store = new VariableStore();
  });

  // ─── Construction ────────────────────────────────────────────────────────

  it('widgetId matches the constructor argument', () => {
    expect(widget.widgetId).toBe('panel-left');
  });

  it('defaultState has NVS defaults and anchor="scene"', () => {
    expect(widget.defaultState.x).toBe(0);
    expect(widget.defaultState.y).toBe(0);
    expect(widget.defaultState.w).toBe(1);
    expect(widget.defaultState.h).toBe(1);
    expect(widget.defaultState.opacity).toBe(1);
    expect(widget.defaultState.anchor).toBe('scene');
    expect(widget.defaultState.overflow).toBe('hidden');
    expect(widget.defaultState.layer).toBe(0);
  });

  it('transitionSpec is the functionalTextBoxTransitionSpec', () => {
    expect(widget.transitionSpec).toBe(functionalTextBoxTransitionSpec);
  });

  // ─── initialize ──────────────────────────────────────────────────────────

  it('initialize() does not throw', () => {
    expect(() => widget.initialize(makeInitCtx())).not.toThrow();
  });

  // ─── apply() — VariableStore writes ──────────────────────────────────────

  it('apply() writes the correct namespace key for x to VariableStore', () => {
    const state: TextBoxState = {
      x: 0.1, y: 0.2, w: 0.4, h: 0.6,
      opacity: 0.8, anchor: 'scene',
      overflow: 'hidden', layer: 2,
      children: null,
    };

    widget.apply(state, makeRenderCtx(store));

    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.x')).toBe(0.1);
  });

  it('apply() writes y, w, h, opacity, anchor, overflow, layer to VariableStore', () => {
    const state: TextBoxState = {
      x: 0.05, y: 0.15, w: 0.3, h: 0.7,
      opacity: 0.5, anchor: 'scene',
      overflow: 'visible', layer: 3,
      children: null,
    };

    widget.apply(state, makeRenderCtx(store));

    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.y')).toBe(0.15);
    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.w')).toBe(0.3);
    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.h')).toBe(0.7);
    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.opacity')).toBe(0.5);
    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.anchor')).toBe('scene');
    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.overflow')).toBe('visible');
    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.layer')).toBe(3);
  });

  it('apply() writes edge and inset when anchor="viewport"', () => {
    const state: TextBoxState = {
      x: 0, y: 0, w: 1, h: 1,
      opacity: 1, anchor: 'viewport',
      edge: 'top', inset: 0.02,
      overflow: 'hidden', layer: 0,
      children: null,
    };

    widget.apply(state, makeRenderCtx(store));

    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.anchor')).toBe('viewport');
    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.edge')).toBe('top');
    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.inset')).toBe(0.02);
  });

  it('apply() writes null for edge when edge is undefined', () => {
    const state: TextBoxState = {
      x: 0, y: 0, w: 1, h: 1,
      opacity: 1, anchor: 'scene',
      overflow: 'hidden', layer: 0,
      children: null,
    };

    widget.apply(state, makeRenderCtx(store));

    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.edge')).toBeNull();
  });

  it('apply() does not write to childrenMap — children are stored at compile time by the NodeHandler', () => {
    const content = { type: 'p', props: {}, key: null } as unknown as React.ReactNode;
    const state: TextBoxState = {
      x: 0, y: 0, w: 1, h: 1,
      opacity: 1, anchor: 'scene',
      overflow: 'hidden', layer: 0,
      children: content,
    };

    widget.apply(state, makeRenderCtx(store));

    // apply() ignores state.children; childrenMap is populated at compile time
    // by corePlugin().configureRegistry() NodeHandler, not by apply().
    expect(childrenMap.has('panel-left')).toBe(false);
  });

  it('apply() uses the widgetId as the VariableStore key prefix', () => {
    const other = new TextBoxWidget('header-box', childrenMap);
    const state: TextBoxState = {
      x: 0.5, y: 0, w: 1, h: 1,
      opacity: 1, anchor: 'scene',
      overflow: 'hidden', layer: 0,
      children: null,
    };

    other.apply(state, makeRenderCtx(store));

    // Keys for 'header-box' are present
    expect(store.get(TEXTBOX_NAMESPACE, 'header-box.x')).toBe(0.5);
    // Keys for 'panel-left' are absent
    expect(store.get(TEXTBOX_NAMESPACE, 'panel-left.x')).toBeUndefined();
  });

  // ─── dispose() ───────────────────────────────────────────────────────────

  it('dispose() removes the widget entry from childrenMap', () => {
    childrenMap.set('panel-left', 'some-content' as unknown as React.ReactNode);
    expect(childrenMap.has('panel-left')).toBe(true);

    widget.dispose();

    expect(childrenMap.has('panel-left')).toBe(false);
  });

  it('dispose() does not throw when childrenMap entry does not exist', () => {
    expect(() => widget.dispose()).not.toThrow();
  });

  it('dispose() does not affect entries for other widget IDs', () => {
    childrenMap.set('other-widget', 'other' as unknown as React.ReactNode);
    childrenMap.set('panel-left', 'mine' as unknown as React.ReactNode);

    widget.dispose();

    expect(childrenMap.has('other-widget')).toBe(true);
    expect(childrenMap.has('panel-left')).toBe(false);
  });
});

// ─── functionalTextBoxTransitionSpec tests ────────────────────────────────────

describe('functionalTextBoxTransitionSpec', () => {
  const spec = functionalTextBoxTransitionSpec;

  const baseState: TextBoxState = {
    x: 0.1, y: 0.2, w: 0.5, h: 0.6,
    opacity: 1, anchor: 'scene',
    overflow: 'hidden', layer: 0,
    children: null,
  };

  // ─── exitFn ─────────────────────────────────────────────────────────────

  it('exitFn at t=0 preserves full opacity', () => {
    const fn = spec.exitFn(baseState);
    const result = fn(makeSimpleContext(0));
    expect(result.opacity).toBe(1);
  });

  it('exitFn at t=1 fades opacity to 0', () => {
    const fn = spec.exitFn(baseState);
    const result = fn(makeSimpleContext(1));
    expect(result.opacity).toBe(0);
  });

  it('exitFn at t=0.5 halves opacity', () => {
    const fn = spec.exitFn(baseState);
    const result = fn(makeSimpleContext(0.5));
    expect(result.opacity).toBeCloseTo(0.5);
  });

  it('exitFn preserves non-opacity fields unchanged', () => {
    const fn = spec.exitFn(baseState);
    const result = fn(makeSimpleContext(0.5));
    expect(result.x).toBe(0.1);
    expect(result.y).toBe(0.2);
    expect(result.w).toBe(0.5);
    expect(result.h).toBe(0.6);
    expect(result.anchor).toBe('scene');
  });

  // ─── enterFn ────────────────────────────────────────────────────────────

  it('enterFn at t=0 has opacity 0', () => {
    const fn = spec.enterFn(baseState);
    const result = fn(makeSimpleContext(0));
    expect(result.opacity).toBe(0);
  });

  it('enterFn at t=1 returns full opacity', () => {
    const fn = spec.enterFn(baseState);
    const result = fn(makeSimpleContext(1));
    expect(result.opacity).toBe(1);
  });

  it('enterFn at t=0.5 has half opacity', () => {
    const fn = spec.enterFn(baseState);
    const result = fn(makeSimpleContext(0.5));
    expect(result.opacity).toBeCloseTo(0.5);
  });

  it('enterFn preserves non-opacity fields from toState', () => {
    const toState: TextBoxState = { ...baseState, x: 0.3, y: 0.4 };
    const fn = spec.enterFn(toState);
    const result = fn(makeSimpleContext(0.5));
    expect(result.x).toBe(0.3);
    expect(result.y).toBe(0.4);
  });

  // ─── interpolateFn ──────────────────────────────────────────────────────

  it('interpolateFn blends opacity between from and to states', () => {
    const from: TextBoxState = { ...baseState, opacity: 0 };
    const to: TextBoxState = { ...baseState, opacity: 1 };
    const fn = spec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    expect(result.opacity).toBeCloseTo(0.5);
  });

  it('interpolateFn at t=0 returns from opacity', () => {
    const from: TextBoxState = { ...baseState, opacity: 0.4 };
    const to: TextBoxState = { ...baseState, opacity: 0.8 };
    const fn = spec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0));
    expect(result.opacity).toBeCloseTo(0.4);
  });

  it('interpolateFn at t=1 returns to opacity', () => {
    const from: TextBoxState = { ...baseState, opacity: 0.2 };
    const to: TextBoxState = { ...baseState, opacity: 0.9 };
    const fn = spec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(1));
    expect(result.opacity).toBeCloseTo(0.9);
  });

  it('interpolateFn snaps layout (x, y, w, h) to toState immediately', () => {
    const from: TextBoxState = { ...baseState, x: 0.1, y: 0.1, w: 0.5, h: 0.5 };
    const to: TextBoxState = { ...baseState, x: 0.5, y: 0.5, w: 0.8, h: 0.8 };
    const fn = spec.interpolateFn(from, to);
    // Even at t=0, layout props are from toState (snap behavior per plan spec).
    const atZero = fn(makeSimpleContext(0));
    expect(atZero.x).toBe(0.5);
    expect(atZero.y).toBe(0.5);
    expect(atZero.w).toBe(0.8);
    expect(atZero.h).toBe(0.8);
  });
});
