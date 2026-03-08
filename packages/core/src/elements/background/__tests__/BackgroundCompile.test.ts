import { describe, it, expect } from 'vitest';
import { Background } from '../BackgroundWidget';
import { DEFAULT_BACKGROUND, backgroundTransitionSpec, functionalBackgroundTransitionSpec } from '../compile';
import { applyBackground } from '../render';
import type { SceneBackground } from '../types';
import { makeFakeDomElement } from '../../__tests__/elementTestMocks';
import { makeSimpleContext } from '../../../compiler/transitions/transitionResolver';

// Helper: make a fake DOM refs object with optional overlay element
const makeRefs = (overlay: HTMLElement | null = null) => ({
  element: makeFakeDomElement(),
  overlayElement: overlay,
});

describe('background compile + render', () => {
  // ─── DEFAULT_BACKGROUND ──────────────────────────────────────────────────

  it('defaults to opaque with no image', () => {
    expect(DEFAULT_BACKGROUND.opacity).toBe(1);
    expect(DEFAULT_BACKGROUND.imageUrl).toBeUndefined();
  });

  it('DEFAULT_BACKGROUND has all new fields as undefined', () => {
    expect(DEFAULT_BACKGROUND.gradient).toBeUndefined();
    expect(DEFAULT_BACKGROUND.cssFilter).toBeUndefined();
    expect(DEFAULT_BACKGROUND.overlayGradient).toBeUndefined();
    expect(DEFAULT_BACKGROUND.backdropFilter).toBeUndefined();
  });

  // ─── functionalBackgroundTransitionSpec ──────────────────────────────────

  it('functional transitionSpec.exit fades opacity to 0', () => {
    const state: SceneBackground = { opacity: 1, imageUrl: '/a.jpg' };
    const fn = functionalBackgroundTransitionSpec.exitFn(state);
    const result = fn(makeSimpleContext(1));
    expect(result.opacity).toBeCloseTo(0);
  });

  it('functional transitionSpec.exit at t=0 preserves opacity', () => {
    const state: SceneBackground = { opacity: 0.4, imageUrl: '/a.jpg' };
    const fn = functionalBackgroundTransitionSpec.exitFn(state);
    const result = fn(makeSimpleContext(0));
    expect(result.opacity).toBeCloseTo(0.4);
  });

  it('functional transitionSpec.enter fades opacity in', () => {
    const state: SceneBackground = { opacity: 0.8 };
    const fn = functionalBackgroundTransitionSpec.enterFn(state);
    const result = fn(makeSimpleContext(0.5));
    expect(result.opacity).toBeGreaterThan(0);
    expect(result.opacity).toBeLessThan(0.8);
  });

  it('functional transitionSpec.enter at t=1 returns full opacity', () => {
    const state: SceneBackground = { opacity: 0.8 };
    const fn = functionalBackgroundTransitionSpec.enterFn(state);
    const result = fn(makeSimpleContext(1));
    expect(result.opacity).toBeCloseTo(0.8);
  });

  it('functional transitionSpec.interpolate at t=0 returns fromState', () => {
    const from: SceneBackground = { opacity: 0.2, imageUrl: '/from.jpg' };
    const to: SceneBackground = { opacity: 0.9, imageUrl: '/to.jpg' };
    const fn = functionalBackgroundTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0));
    expect(result.imageUrl).toBe('/from.jpg');
    expect(result.opacity).toBeCloseTo(from.opacity ?? 0);
  });

  it('functional transitionSpec.interpolate at t=1 returns toState', () => {
    const from: SceneBackground = { opacity: 0.2, imageUrl: '/from.jpg' };
    const to: SceneBackground = { opacity: 0.9, imageUrl: '/to.jpg' };
    const fn = functionalBackgroundTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(1));
    expect(result.imageUrl).toBe('/to.jpg');
    expect(result.opacity).toBeCloseTo(to.opacity ?? 0);
  });

  it('functional transitionSpec.interpolate at t=0.5 blends opacity', () => {
    const from: SceneBackground = { opacity: 0, imageUrl: '/same.jpg' };
    const to: SceneBackground = { opacity: 1, imageUrl: '/same.jpg' };
    const fn = functionalBackgroundTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    expect(result.opacity).toBeGreaterThan(0);
    expect(result.opacity).toBeLessThan(1);
  });

  it('functional transitionSpec.interpolate cross-fades when image differs', () => {
    const from: SceneBackground = { opacity: 1, imageUrl: '/from.jpg' };
    const to: SceneBackground = { opacity: 1, imageUrl: '/to.jpg' };
    const fn = functionalBackgroundTransitionSpec.interpolateFn(from, to);
    const at25 = fn(makeSimpleContext(0.25));
    const at75 = fn(makeSimpleContext(0.75));
    expect(at25.imageUrl).toBe('/from.jpg');
    expect(at75.imageUrl).toBe('/to.jpg');
    expect(at25.opacity).toBeLessThan(1);
    expect(at75.opacity).toBeLessThan(1);
  });

  it('functional transitionSpec.interpolate preserves gradient at t=0.4 (from side)', () => {
    const from: SceneBackground = { opacity: 1, gradient: 'linear-gradient(#aaa, #bbb)' };
    const to: SceneBackground = { opacity: 1, gradient: 'linear-gradient(#ccc, #ddd)' };
    const fn = functionalBackgroundTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.4));
    expect(result.gradient).toBe('linear-gradient(#aaa, #bbb)');
  });

  it('functional transitionSpec.interpolate selects to-gradient at t=0.6', () => {
    const from: SceneBackground = { opacity: 1, gradient: 'linear-gradient(#aaa, #bbb)' };
    const to: SceneBackground = { opacity: 1, gradient: 'linear-gradient(#ccc, #ddd)' };
    const fn = functionalBackgroundTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.6));
    expect(result.gradient).toBe('linear-gradient(#ccc, #ddd)');
  });

  it('functional transitionSpec.interpolate preserves cssFilter at t=0.4 (from side)', () => {
    const from: SceneBackground = { opacity: 1, cssFilter: 'blur(4px)' };
    const to: SceneBackground = { opacity: 1, cssFilter: 'brightness(0.5)' };
    const fn = functionalBackgroundTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.4));
    expect(result.cssFilter).toBe('blur(4px)');
  });

  it('functional transitionSpec.interpolate selects to-cssFilter at t=0.6', () => {
    const from: SceneBackground = { opacity: 1, cssFilter: 'blur(4px)' };
    const to: SceneBackground = { opacity: 1, cssFilter: 'brightness(0.5)' };
    const fn = functionalBackgroundTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.6));
    expect(result.cssFilter).toBe('brightness(0.5)');
  });

  // ─── backgroundTransitionSpec (discrete/element) ──────────────────────────

  it('discrete transitionSpec.exit writes frames with fading opacity', () => {
    const frames = Array.from({ length: 3 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const from: SceneBackground = { opacity: 1, imageUrl: '/a.jpg' };
    backgroundTransitionSpec.exit(frames, 'bg', from);
    expect((frames[0]!.state.widgets['bg'] as SceneBackground).opacity).toBeCloseTo(1);
    expect((frames[2]!.state.widgets['bg'] as SceneBackground).opacity).toBeCloseTo(0);
  });

  it('discrete transitionSpec.enter writes frames with fading in opacity', () => {
    const frames = Array.from({ length: 3 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const to: SceneBackground = { opacity: 0.8, imageUrl: '/a.jpg' };
    backgroundTransitionSpec.enter(frames, 'bg', to);
    expect((frames[0]!.state.widgets['bg'] as SceneBackground).opacity).toBeCloseTo(0);
    expect((frames[2]!.state.widgets['bg'] as SceneBackground).opacity).toBeCloseTo(0.8);
  });

  it('discrete transitionSpec.interpolate switches image at midpoint', () => {
    const frames = Array.from({ length: 5 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const from: SceneBackground = { opacity: 1, imageUrl: '/from.jpg' };
    const to: SceneBackground = { opacity: 1, imageUrl: '/to.jpg' };
    backgroundTransitionSpec.interpolate(frames, 'bg', from, to);
    expect((frames[1]!.state.widgets['bg'] as SceneBackground).imageUrl).toBe('/from.jpg');
    expect((frames[3]!.state.widgets['bg'] as SceneBackground).imageUrl).toBe('/to.jpg');
  });

  it('discrete transitionSpec.interpolate switches cssFilter at midpoint (t=0.4 → from)', () => {
    // 5 frames: t values via transitionT are approx 0, 0.25, 0.5, 0.75, 1
    // Frame index 1 (t≈0.25) → from side; frame index 3 (t≈0.75) → to side
    const frames = Array.from({ length: 5 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const from: SceneBackground = { opacity: 1, cssFilter: 'blur(2px)' };
    const to: SceneBackground = { opacity: 1, cssFilter: 'brightness(0.8)' };
    backgroundTransitionSpec.interpolate(frames, 'bg', from, to);
    expect((frames[1]!.state.widgets['bg'] as SceneBackground).cssFilter).toBe('blur(2px)');
    expect((frames[3]!.state.widgets['bg'] as SceneBackground).cssFilter).toBe('brightness(0.8)');
  });

  // ─── applyBackground ──────────────────────────────────────────────────────

  it('applyBackground writes styles to the element', () => {
    const refs = makeRefs();
    const state: SceneBackground = {
      opacity: 0.6,
      imageUrl: '/hero.jpg',
      cssPosition: 'center',
      cssSize: 'cover',
      cssRepeat: 'no-repeat',
    };
    applyBackground(state, refs);
    const styles = refs.element.style as unknown as Record<string, string>;
    expect(styles.backgroundImage).toContain('hero.jpg');
    expect(styles.opacity).toBe('0.6');
    expect(styles.backgroundPosition).toBe('center');
    expect(styles.backgroundSize).toBe('cover');
    expect(styles.backgroundRepeat).toBe('no-repeat');
  });

  it('applyBackground sets element.style.background when gradient is set', () => {
    const refs = makeRefs();
    const state: SceneBackground = { opacity: 1, gradient: 'linear-gradient(180deg, #000, #fff)' };
    applyBackground(state, refs);
    const styles = refs.element.style as unknown as Record<string, string>;
    expect(styles.background).toBe('linear-gradient(180deg, #000, #fff)');
  });

  it('applyBackground clears backgroundColor and backgroundImage when gradient is set', () => {
    const refs = makeRefs();
    const state: SceneBackground = { opacity: 1, gradient: 'linear-gradient(#aaa, #bbb)' };
    applyBackground(state, refs);
    const styles = refs.element.style as unknown as Record<string, string>;
    expect(styles.backgroundColor).toBe('');
    expect(styles.backgroundImage).toBe('');
  });

  it('applyBackground sets element.style.filter when cssFilter is set', () => {
    const refs = makeRefs();
    const state: SceneBackground = { opacity: 1, cssFilter: 'blur(4px) brightness(0.8)' };
    applyBackground(state, refs);
    const styles = refs.element.style as unknown as Record<string, string>;
    expect(styles.filter).toBe('blur(4px) brightness(0.8)');
  });

  it('applyBackground sets overlay.style.background when overlayGradient is set', () => {
    const overlayEl = makeFakeDomElement();
    const refs = makeRefs(overlayEl);
    const state: SceneBackground = {
      opacity: 1,
      overlayGradient: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 50%)',
    };
    applyBackground(state, refs);
    const overlayStyles = overlayEl.style as unknown as Record<string, string>;
    expect(overlayStyles.background).toBe('linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 50%)');
    expect(overlayStyles.display).toBe('');
  });

  it('applyBackground sets overlay.style.display = "none" when neither overlayGradient nor backdropFilter is set', () => {
    const overlayEl = makeFakeDomElement();
    const refs = makeRefs(overlayEl);
    const state: SceneBackground = { opacity: 1 };
    applyBackground(state, refs);
    const overlayStyles = overlayEl.style as unknown as Record<string, string>;
    expect(overlayStyles.display).toBe('none');
  });

  it('applyBackground handles null overlayElement gracefully', () => {
    const refs = makeRefs(null);
    const state: SceneBackground = {
      opacity: 1,
      overlayGradient: 'linear-gradient(#aaa, #bbb)',
    };
    expect(() => applyBackground(state, refs)).not.toThrow();
  });

  it('Background DSL component renders null and has displayName', () => {
    expect(Background.displayName).toBe('Background');
    expect(Background({})).toBeNull();
  });
});
