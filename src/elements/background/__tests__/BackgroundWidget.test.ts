// BackgroundWidget tests — interface-based stateful tests.
// Tests the widget's contract: widgetId, defaultState, transitionSpec (pure functions),
// and the setDomElement + apply() pipeline using a plain style-object double.
// Three.js render.ts logic is excluded from coverage and NOT tested here.

import { describe, it, expect, beforeEach } from 'vitest';
import { BackgroundWidget } from '../BackgroundWidget';
import type { SceneBackground } from '../types';
import {
  makeTransitionContext,
  makeFakeDomElement,
  makeRenderContext,
} from '../../__tests__/elementTestMocks';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Helpers live in elementTestMocks.ts

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

  it('transitionSpec.exit at tExit=1 fades opacity to 0', () => {
    const state: SceneBackground = { opacity: 1 };
    const result = widget.transitionSpec.exit(state, makeTransitionContext({ tExit: 1 }));
    expect(result.opacity).toBeCloseTo(0);
  });

  it('transitionSpec.exit at tExit=0 preserves opacity', () => {
    const state: SceneBackground = { opacity: 0.8 };
    const result = widget.transitionSpec.exit(state, makeTransitionContext({ tExit: 0 }));
    expect(result.opacity).toBeCloseTo(0.8);
  });

  it('transitionSpec.enter at tEnter=0 has near-zero opacity', () => {
    const state: SceneBackground = { opacity: 1 };
    const result = widget.transitionSpec.enter(state, makeTransitionContext({ tEnter: 0 }));
    expect(result.opacity).toBeCloseTo(0);
  });

  it('transitionSpec.enter at tEnter=1 returns full opacity', () => {
    const state: SceneBackground = { opacity: 0.6 };
    const result = widget.transitionSpec.enter(state, makeTransitionContext({ tEnter: 1 }));
    expect(result.opacity).toBeCloseTo(0.6);
  });

  it('transitionSpec.interpolate cross-fades opacity when imageUrls differ', () => {
    const from: SceneBackground = { opacity: 1, imageUrl: '/a.jpg' };
    const to: SceneBackground = { opacity: 1, imageUrl: '/b.jpg' };
    // At tFull=0.25 (first half of cross-fade): fading out from image
    const at25 = widget.transitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 0.25 }));
    expect(at25.opacity).toBeLessThan(1);
    expect(at25.imageUrl).toBe('/a.jpg');
    // At tFull=0.75 (second half): fading in to image
    const at75 = widget.transitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 0.75 }));
    expect(at75.imageUrl).toBe('/b.jpg');
  });

  it('transitionSpec.interpolate blends opacity when imageUrls are the same', () => {
    const from: SceneBackground = { opacity: 0, imageUrl: '/same.jpg' };
    const to: SceneBackground = { opacity: 1, imageUrl: '/same.jpg' };
    const result = widget.transitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 0.5 }));
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
    // Should not throw when domElement is null (default state)
    expect(() => {
      widget.apply({ opacity: 1 }, makeRenderContext());
    }).not.toThrow();
  });

  it('dispose() clears the DOM element reference', () => {
    const el = makeFakeDomElement();
    widget.setDomElement(el);
    widget.dispose();
    // After dispose, apply should not throw (domElement is null)
    expect(() => {
      widget.apply({ opacity: 0 }, makeRenderContext());
    }).not.toThrow();
  });
});
