// FloorWidget tests — interface-based stateful tests.
// Tests the widget's contract: widgetId, defaultState, transitionSpec (pure functions),
// and initialize/apply/dispose without invoking Three.js render details.

import { describe, it, expect, beforeEach } from 'vitest';
import { FloorWidget } from '../FloorWidget';
import type { SceneFloor } from '../types';
import { makeInitContext, makeRenderContext } from '../../__tests__/elementTestMocks';
import { FloorPhysical, FloorMirror } from '../FloorWidget';
import { CUSTOM_NODE_HANDLER } from '../../../widget/WidgetRegistry';
import React from 'react';
import { makeSimpleContext } from '../../../compiler/transitions/transitionResolver';

describe('FloorWidget', () => {
  let widget: FloorWidget;

  beforeEach(() => {
    widget = new FloorWidget();
  });

  it('has widgetId "floor"', () => {
    expect(widget.widgetId).toBe('floor');
  });

  it('defaultState is disabled with no texture', () => {
    expect(widget.defaultState.enabled).toBe(false);
    expect(widget.defaultState.surface).toBeUndefined();
  });

  // ─── transitionSpec — pure blend functions ────────────────────────────────

  it('transitionSpec.exit disables when t=1', () => {
    const state: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/floor.jpg' } };
    const fn = widget.transitionSpec.exitFn(state);
    const result = fn(makeSimpleContext(1));
    expect(result.enabled).toBe(false);
  });

  it('transitionSpec.exit preserves enabled when t=0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = widget.transitionSpec.exitFn(state);
    const result = fn(makeSimpleContext(0));
    expect(result.enabled).toBe(true);
  });

  it('transitionSpec.enter enables when t>0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = widget.transitionSpec.enterFn(state);
    const result = fn(makeSimpleContext(0.5));
    expect(result.enabled).toBe(true);
  });

  it('transitionSpec.enter stays disabled when t=0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = widget.transitionSpec.enterFn(state);
    const result = fn(makeSimpleContext(0));
    expect(result.enabled).toBe(false);
  });

  it('transitionSpec.interpolate switches textureUrl at midpoint', () => {
    const from: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/from.jpg' } };
    const to: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/to.jpg' } };
    const fn = widget.transitionSpec.interpolateFn(from, to);
    const at25 = fn(makeSimpleContext(0.25));
    const at75 = fn(makeSimpleContext(0.75));
    expect(at25.surface?.type).toBe('physical');
    expect((at25.surface as { textureUrl?: string })?.textureUrl).toBe('/from.jpg');
    expect(at75.surface?.type).toBe('physical');
    expect((at75.surface as { textureUrl?: string })?.textureUrl).toBe('/to.jpg');
  });

  it('transitionSpec.interpolate honors enabled on either side', () => {
    const from: SceneFloor = { enabled: true };
    const to: SceneFloor = { enabled: false };
    const fn = widget.transitionSpec.interpolateFn(from, to);
    const at0 = fn(makeSimpleContext(0));
    const at1 = fn(makeSimpleContext(1));
    expect(at0.enabled).toBe(true);
    expect(at1.enabled).toBe(false);
  });

  // ─── initialize + apply + dispose ─────────────────────────────────────────

  it('apply() does not throw when not initialized', () => {
    expect(() => {
      widget.apply({ enabled: false }, makeRenderContext());
    }).not.toThrow();
  });

  it('apply() does not throw after initialize', () => {
    widget.initialize(makeInitContext({ widgetId: widget.widgetId }));
    expect(() => {
      widget.apply({ enabled: true }, makeRenderContext());
    }).not.toThrow();
  });

  it('dispose() clears scene reference', () => {
    widget.initialize(makeInitContext({ widgetId: widget.widgetId }));
    widget.dispose();
    expect(() => {
      widget.apply({ enabled: true }, makeRenderContext());
    }).not.toThrow();
  });

  it('custom node handler resolves surface from child components', () => {
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: SceneFloor) => void }, helpers: {
        collectChildren: (n: { props: unknown }) => React.ReactNode[];
        resolveObjectValues: (v: unknown) => unknown;
        resolveValue: (v: unknown) => unknown;
      }) => void)
      | undefined;

    expect(handler).toBeDefined();
    let captured: SceneFloor | undefined;
    const node = {
      props: {
        enabled: true,
        children: [
          React.createElement(FloorPhysical, { textureUrl: '/a.jpg' }),
          React.createElement(FloorMirror, { blur: 0.2 }),
        ],
      },
    };
    handler?.(
      node,
      { setWidgetState: (_id, state) => { captured = state; }, state: { widgets: {} }, context: {} } as never,
      {
        collectChildren: (n) => (n.props as { children?: React.ReactNode }).children as React.ReactNode[],
        resolveObjectValues: (v) => v,
        resolveValue: (v) => v,
      },
    );
    expect(captured?.enabled).toBe(true);
    expect(captured?.surface?.type).toBe('mirror');
  });

  it('mergeSnapshot prefers next surface when provided', () => {
    const prev: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/a.jpg' } };
    const next: SceneFloor = { enabled: true, surface: { type: 'mirror', blur: 0.2 } };
    const merged = widget.mergeSnapshot(prev, next);
    expect(merged?.surface?.type).toBe('mirror');
  });
});
