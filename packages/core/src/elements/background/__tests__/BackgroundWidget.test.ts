// BackgroundWidget tests — interface-based stateful tests.
// Tests the widget's contract: widgetId, defaultState, transitionSpec (pure functions),
// setDomElement + apply() pipeline, and the CUSTOM_NODE_HANDLER theme resolution.
// Three.js render.ts logic is excluded from coverage and NOT tested here.

import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { BackgroundWidget } from '../BackgroundWidget';
import { CUSTOM_NODE_HANDLER } from '../../../widget/WidgetRegistry';
import type { SceneBackground } from '../types';
import type { SceneTheme } from '../../../theme/types';
import { makeFakeDomElement, makeRenderContext } from '../../__tests__/elementTestMocks';
import { makeSimpleContext } from '../../../compiler/transitions/transitionResolver';
import type { CompileApi } from '../../../compiler/sceneDslTypes';
import { DEFAULT_BACKGROUND } from '../compile';

// ─── Test Helpers ──────────────────────────────────────────────────────────────

/** Build a minimal fake ReactElement with the given props. */
const makeNode = (props: Record<string, unknown>): ReactElement =>
  ({ type: 'Background', props, key: null } as unknown as ReactElement);

/** Build a minimal CompileApi that captures setWidgetState calls. */
const makeCompileApi = (): CompileApi & { capturedState: unknown } => {
  let cap: unknown;
  const api: CompileApi & { capturedState: unknown } = {
    get capturedState() { return cap; },
    context: {} as CompileApi['context'],
    state: { id: 'test', scrollProgress: 0, widgets: {} } as CompileApi['state'],
    setWidgetState: (_id: string, state: unknown) => { cap = state; },
    setSceneMeta: () => {},
    pushWarning: () => {},
  } as unknown as CompileApi & { capturedState: unknown };
  return api;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BackgroundWidget', () => {
  let widget: BackgroundWidget;

  beforeEach(() => {
    widget = new BackgroundWidget();
  });

  it('has widgetId "background"', () => {
    expect(widget.widgetId).toBe('background');
  });

  it('defaultState has opacity 1 and no imageUrl', () => {
    expect(widget.defaultState.opacity).toBe(1);
    expect(widget.defaultState.imageUrl).toBeUndefined();
  });

  // ─── transitionSpec — pure blend functions ────────────────────────────────

  it('transitionSpec.exit at t=1 fades opacity to 0', () => {
    const state: SceneBackground = { opacity: 1 };
    const fn = widget.transitionSpec.exitFn(state);
    const result = fn(makeSimpleContext(1));
    expect(result.opacity).toBeCloseTo(0);
  });

  it('transitionSpec.exit at t=0 preserves opacity', () => {
    const state: SceneBackground = { opacity: 0.8 };
    const fn = widget.transitionSpec.exitFn(state);
    const result = fn(makeSimpleContext(0));
    expect(result.opacity).toBeCloseTo(0.8);
  });

  it('transitionSpec.enter at t=0 has near-zero opacity', () => {
    const state: SceneBackground = { opacity: 1 };
    const fn = widget.transitionSpec.enterFn(state);
    const result = fn(makeSimpleContext(0));
    expect(result.opacity).toBeCloseTo(0);
  });

  it('transitionSpec.enter at t=1 returns full opacity', () => {
    const state: SceneBackground = { opacity: 0.6 };
    const fn = widget.transitionSpec.enterFn(state);
    const result = fn(makeSimpleContext(1));
    expect(result.opacity).toBeCloseTo(0.6);
  });

  it('transitionSpec.interpolate cross-fades opacity when imageUrls differ', () => {
    const from: SceneBackground = { opacity: 1, imageUrl: '/a.jpg' };
    const to: SceneBackground = { opacity: 1, imageUrl: '/b.jpg' };
    const fn = widget.transitionSpec.interpolateFn(from, to);
    const at25 = fn(makeSimpleContext(0.25));
    expect(at25.opacity).toBeLessThan(1);
    expect(at25.imageUrl).toBe('/a.jpg');
    const at75 = fn(makeSimpleContext(0.75));
    expect(at75.imageUrl).toBe('/b.jpg');
  });

  it('transitionSpec.interpolate blends opacity when imageUrls are the same', () => {
    const from: SceneBackground = { opacity: 0, imageUrl: '/same.jpg' };
    const to: SceneBackground = { opacity: 1, imageUrl: '/same.jpg' };
    const fn = widget.transitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    expect(result.opacity).toBeGreaterThan(0);
    expect(result.opacity).toBeLessThan(1);
    expect(result.imageUrl).toBe('/same.jpg');
  });

  // ─── setDomElement + apply ────────────────────────────────────────────────

  it('apply() sets style.opacity on the DOM element', () => {
    const el = makeFakeDomElement();
    widget.setDomElement(el);
    widget.apply({ opacity: 0.7 }, makeRenderContext());
    expect((el.style as unknown as Record<string, string>)['opacity']).toBe('0.7');
  });

  it('apply() sets style.backgroundImage when imageUrl is provided', () => {
    const el = makeFakeDomElement();
    widget.setDomElement(el);
    widget.apply({ opacity: 1, imageUrl: '/hero.jpg' }, makeRenderContext());
    expect((el.style as unknown as Record<string, string>)['backgroundImage']).toContain('hero.jpg');
  });

  it('apply() clears backgroundImage when imageUrl is undefined', () => {
    const el = makeFakeDomElement();
    widget.setDomElement(el);
    widget.apply({ opacity: 1, imageUrl: undefined }, makeRenderContext());
    expect((el.style as unknown as Record<string, string>)['backgroundImage']).toBe('');
  });

  it('apply() does nothing when no DOM element is set', () => {
    expect(() => {
      widget.apply({ opacity: 1 }, makeRenderContext());
    }).not.toThrow();
  });

  it('apply() with cssFilter state sets element.style.filter', () => {
    const el = makeFakeDomElement();
    widget.setDomElement(el);
    widget.apply({ opacity: 1, cssFilter: 'blur(4px)' }, makeRenderContext());
    expect((el.style as unknown as Record<string, string>)['filter']).toBe('blur(4px)');
  });

  it('dispose() clears the DOM element reference', () => {
    const el = makeFakeDomElement();
    widget.setDomElement(el);
    widget.dispose();
    expect(() => {
      widget.apply({ opacity: 0 }, makeRenderContext());
    }).not.toThrow();
  });

  it('setDomElement(null) clears the DOM element reference', () => {
    const el = makeFakeDomElement();
    widget.setDomElement(el);
    widget.apply({ opacity: 0.4 }, makeRenderContext());
    widget.setDomElement(null);
    expect(() => {
      widget.apply({ opacity: 0.9 }, makeRenderContext());
    }).not.toThrow();
    expect((el.style as unknown as Record<string, string>)['opacity']).toBe('0.4');
  });

  // ─── CUSTOM_NODE_HANDLER — compile-time prop resolution ──────────────────

  it('handler with no props and no theme produces DEFAULT_BACKGROUND', () => {
    const api = makeCompileApi();
    widget[CUSTOM_NODE_HANDLER](makeNode({}), api, {} as never);
    expect(api.capturedState).toMatchObject({
      opacity: DEFAULT_BACKGROUND.opacity,
      imageUrl: undefined,
      color: undefined,
      gradient: undefined,
      cssFilter: undefined,
      overlayGradient: undefined,
      backdropFilter: undefined,
    });
  });

  it('handler with color prop sets state.color', () => {
    const api = makeCompileApi();
    widget[CUSTOM_NODE_HANDLER](makeNode({ color: '#ff0000' }), api, {} as never);
    expect((api.capturedState as SceneBackground).color).toBe('#ff0000');
  });

  it('handler with gradient prop sets state.gradient and clears state.color', () => {
    const api = makeCompileApi();
    widget[CUSTOM_NODE_HANDLER](makeNode({ gradient: 'linear-gradient(#aaa, #bbb)', color: '#ff0000' }), api, {} as never);
    const state = api.capturedState as SceneBackground;
    expect(state.gradient).toBe('linear-gradient(#aaa, #bbb)');
    expect(state.color).toBeUndefined();
  });

  it('handler with theme.background.fill.kind = "gradient" sets state.gradient', () => {
    const theme: SceneTheme = {
      colorMode: 'dark',
      font: { htmlFamily: 'system-ui' },
      fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
      background: { fill: { kind: 'gradient', value: 'linear-gradient(#000, #111)' } },
    };
    const api = makeCompileApi();
    widget[CUSTOM_NODE_HANDLER](makeNode({ theme }), api, {} as never);
    expect((api.capturedState as SceneBackground).gradient).toBe('linear-gradient(#000, #111)');
  });

  it('handler with theme.background.fill.kind = "color" and explicit color prop → explicit prop wins', () => {
    const theme: SceneTheme = {
      colorMode: 'dark',
      font: { htmlFamily: 'system-ui' },
      fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
      background: { fill: { kind: 'color', value: '#0a0a14' } },
    };
    const api = makeCompileApi();
    widget[CUSTOM_NODE_HANDLER](makeNode({ theme, color: '#ffffff' }), api, {} as never);
    expect((api.capturedState as SceneBackground).color).toBe('#ffffff');
  });

  it('handler with theme.background.effects.cssFilter and no explicit cssFilter → theme value used', () => {
    const theme: SceneTheme = {
      colorMode: 'dark',
      font: { htmlFamily: 'system-ui' },
      fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
      background: { effects: { cssFilter: 'blur(4px)' } },
    };
    const api = makeCompileApi();
    widget[CUSTOM_NODE_HANDLER](makeNode({ theme }), api, {} as never);
    expect((api.capturedState as SceneBackground).cssFilter).toBe('blur(4px)');
  });

  it('handler with both theme.background.effects.cssFilter and explicit cssFilter → explicit wins', () => {
    const theme: SceneTheme = {
      colorMode: 'dark',
      font: { htmlFamily: 'system-ui' },
      fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
      background: { effects: { cssFilter: 'blur(4px)' } },
    };
    const api = makeCompileApi();
    widget[CUSTOM_NODE_HANDLER](makeNode({ theme, cssFilter: 'brightness(0.5)' }), api, {} as never);
    expect((api.capturedState as SceneBackground).cssFilter).toBe('brightness(0.5)');
  });

  it('regression: handler with multiple explicit props and no theme produces correct SceneBackground', () => {
    const api = makeCompileApi();
    widget[CUSTOM_NODE_HANDLER](
      makeNode({
        color: '#123456',
        imageUrl: '/bg.jpg',
        opacity: 0.8,
        cssPosition: 'center',
        cssSize: 'cover',
        cssRepeat: 'no-repeat',
      }),
      api,
      {} as never,
    );
    const state = api.capturedState as SceneBackground;
    // imageUrl takes precedence over color (imageUrl is set, not undefined), but both are applied:
    expect(state.imageUrl).toBe('/bg.jpg');
    // color is set by the prop but gradient is not set, so color should be '#123456'
    expect(state.color).toBe('#123456');
    expect(state.opacity).toBe(0.8);
    expect(state.cssPosition).toBe('center');
    expect(state.cssSize).toBe('cover');
    expect(state.cssRepeat).toBe('no-repeat');
    expect(state.gradient).toBeUndefined();
    expect(state.cssFilter).toBeUndefined();
    expect(state.overlayGradient).toBeUndefined();
    expect(state.backdropFilter).toBeUndefined();
  });
});
