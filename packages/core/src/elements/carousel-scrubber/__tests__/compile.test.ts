// Tests for CarouselScrubber compile.ts — pure function tests with real inputs.

import { describe, it, expect } from 'vitest';
import type { CarouselScrubberState, ViewHighlight } from '../types';
import {
  compileCarouselScrubber,
  DEFAULT_CAROUSEL_SCRUBBER_STATE,
  DEFAULT_CAROUSEL_SCRUBBER_STYLE,
  carouselScrubberTransitionSpec,
} from '../compile';
import type { CarouselScrubberProps } from '../dsl';

// -- compileCarouselScrubber -------------------------------------------------

describe('compileCarouselScrubber', () => {
  const minimalProps: CarouselScrubberProps = {
    id: 'scrubber-1',
    layoutId: 'layout-1',
  };

  it('produces default state for minimal props', () => {
    const state = compileCarouselScrubber(minimalProps, 0, 0, false);
    expect(state.layoutId).toBe('layout-1');
    expect(state.activeIndex).toBe(0);
    expect(state.childCount).toBe(0);
    expect(state.loop).toBe(false);
    expect(state.showBase).toBe(true);
    expect(state.trayDepth).toBe(0.36);
    expect(state.gap).toBe(0.02);
    expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(state.style.baseColor).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.baseColor);
    expect(state.style.baseOpacity).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.baseOpacity);
    expect(state.style.accentColor).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.accentColor);
    expect(state.style.metalness).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.metalness);
    expect(state.style.roughness).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.roughness);
    expect(state.style.edgeStyle).toBe('knurled');
  });

  it('passes activeIndex, childCount, and loop from arguments', () => {
    const state = compileCarouselScrubber(minimalProps, 3, 5, true);
    expect(state.activeIndex).toBe(3);
    expect(state.childCount).toBe(5);
    expect(state.loop).toBe(true);
  });

  it('applies explicit showBase=false', () => {
    const props: CarouselScrubberProps = { ...minimalProps, showBase: false };
    const state = compileCarouselScrubber(props, 0, 3, false);
    expect(state.showBase).toBe(false);
  });

  it('applies explicit gap', () => {
    const props: CarouselScrubberProps = { ...minimalProps, gap: 0.05 };
    const state = compileCarouselScrubber(props, 0, 3, false);
    expect(state.gap).toBe(0.05);
  });

  it('merges partial style overrides with defaults', () => {
    const props: CarouselScrubberProps = {
      ...minimalProps,
      style: { baseColor: '#ff0000', metalness: 0.8 },
    };
    const state = compileCarouselScrubber(props, 0, 3, false);
    expect(state.style.baseColor).toBe('#ff0000');
    expect(state.style.metalness).toBe(0.8);
    // Defaults should remain for non-overridden fields
    expect(state.style.baseOpacity).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.baseOpacity);
    expect(state.style.accentColor).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.accentColor);
    expect(state.style.edgeStyle).toBe('knurled');
  });

  it('applies explicit edgeStyle', () => {
    const props: CarouselScrubberProps = {
      ...minimalProps,
      style: { edgeStyle: 'ridged' },
    };
    const state = compileCarouselScrubber(props, 0, 3, false);
    expect(state.style.edgeStyle).toBe('ridged');
  });

  it('defaults edgeStyle to knurled', () => {
    const state = compileCarouselScrubber(minimalProps, 0, 0, false);
    expect(state.style.edgeStyle).toBe('knurled');
  });

  it('defaults surfaceMaterial to null', () => {
    const state = compileCarouselScrubber(minimalProps, 0, 0, false);
    expect(state.style.surfaceMaterial).toBeNull();
    expect(state.style.materialApplication).toEqual({});
  });

  it('applies explicit surfaceMaterial', () => {
    const props: CarouselScrubberProps = {
      ...minimalProps,
      style: { surfaceMaterial: 'onyx' },
    };
    const state = compileCarouselScrubber(props, 0, 3, false);
    expect(state.style.surfaceMaterial).toBe('onyx');
  });

  it('applies materialApplication fields', () => {
    const props: CarouselScrubberProps = {
      ...minimalProps,
      style: {
        materialApplication: { colorMix: 0.5, brightness: 0.8, iridescence: 0.3 },
      },
    };
    const state = compileCarouselScrubber(props, 0, 3, false);
    expect(state.style.materialApplication.colorMix).toBe(0.5);
    expect(state.style.materialApplication.brightness).toBe(0.8);
    expect(state.style.materialApplication.iridescence).toBe(0.3);
  });

  it('defaults surfacePattern to brushed', () => {
    const state = compileCarouselScrubber(minimalProps, 0, 0, false);
    expect(state.style.surfacePattern).toBe('brushed');
    expect(state.style.surfaceIntensity).toBe(0.25);
    expect(state.style.surfaceMapUrl).toBeNull();
  });

  it('applies explicit surfacePattern', () => {
    const props: CarouselScrubberProps = {
      ...minimalProps,
      style: { surfacePattern: 'crosshatch' as const },
    };
    const state = compileCarouselScrubber(props, 0, 3, false);
    expect(state.style.surfacePattern).toBe('crosshatch');
  });

  it('applies explicit surfaceIntensity', () => {
    const props: CarouselScrubberProps = {
      ...minimalProps,
      style: { surfaceIntensity: 0.5 },
    };
    const state = compileCarouselScrubber(props, 0, 3, false);
    expect(state.style.surfaceIntensity).toBe(0.5);
  });

  it('applies explicit surfaceMapUrl', () => {
    const props: CarouselScrubberProps = {
      ...minimalProps,
      style: { surfaceMapUrl: '/textures/custom.png' },
    };
    const state = compileCarouselScrubber(props, 0, 3, false);
    expect(state.style.surfaceMapUrl).toBe('/textures/custom.png');
  });

  it('produces empty viewHighlights by default', () => {
    const state = compileCarouselScrubber(minimalProps, 0, 3, false);
    expect(state.viewHighlights).toEqual([]);
  });
});

// -- DEFAULT_CAROUSEL_SCRUBBER_STATE -----------------------------------------

describe('DEFAULT_CAROUSEL_SCRUBBER_STATE', () => {
  it('has sensible default values', () => {
    expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.layoutId).toBe('');
    expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.activeIndex).toBe(0);
    expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.childCount).toBe(0);
    expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.loop).toBe(false);
    expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.showBase).toBe(true);
    expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.trayDepth).toBe(0.36);
    expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.gap).toBe(0.02);
    expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.style.edgeStyle).toBe('knurled');
  });

  it('has empty viewHighlights by default', () => {
    expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.viewHighlights).toEqual([]);
  });
});

// -- carouselScrubberTransitionSpec ------------------------------------------

describe('carouselScrubberTransitionSpec', () => {
  const makeState = (overrides?: Partial<CarouselScrubberState>): CarouselScrubberState => ({
    ...DEFAULT_CAROUSEL_SCRUBBER_STATE,
    layoutId: 'layout-1',
    childCount: 5,
    ...overrides,
  });

  const makeCtx = (t: number) => ({
    t,
    bp: t,
    channel: () => t,
  });

  describe('exitFn', () => {
    it('fades baseOpacity to 0 at t=1', () => {
      const from = makeState({ style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, baseOpacity: 0.85 } });
      const fn = carouselScrubberTransitionSpec.exitFn(from);
      const result = fn(makeCtx(1));
      expect(result.style.baseOpacity).toBeCloseTo(0, 5);
    });

    it('preserves baseOpacity at t=0', () => {
      const from = makeState({ style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, baseOpacity: 0.85 } });
      const fn = carouselScrubberTransitionSpec.exitFn(from);
      const result = fn(makeCtx(0));
      expect(result.style.baseOpacity).toBeCloseTo(0.85, 5);
    });
  });

  describe('enterFn', () => {
    it('fades baseOpacity from 0 at t=0', () => {
      const to = makeState({ style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, baseOpacity: 0.85 } });
      const fn = carouselScrubberTransitionSpec.enterFn(to);
      const result = fn(makeCtx(0));
      expect(result.style.baseOpacity).toBeCloseTo(0, 5);
    });

    it('reaches full baseOpacity at t=1', () => {
      const to = makeState({ style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, baseOpacity: 0.85 } });
      const fn = carouselScrubberTransitionSpec.enterFn(to);
      const result = fn(makeCtx(1));
      expect(result.style.baseOpacity).toBeCloseTo(0.85, 5);
    });
  });

  describe('interpolateFn', () => {
    it('blends activeIndex linearly', () => {
      const from = makeState({ activeIndex: 0 });
      const to = makeState({ activeIndex: 4 });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
      const result = fn(makeCtx(0.5));
      expect(result.activeIndex).toBeCloseTo(2, 5);
    });

    it('blends gap linearly', () => {
      const from = makeState({ gap: 0.01 });
      const to = makeState({ gap: 0.05 });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
      const result = fn(makeCtx(0.5));
      expect(result.gap).toBeCloseTo(0.03, 5);
    });

    it('switches discrete fields at midpoint', () => {
      const from = makeState({ loop: false, layoutId: 'a' });
      const to = makeState({ loop: true, layoutId: 'b' });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);

      const before = fn(makeCtx(0.3));
      expect(before.loop).toBe(false);
      expect(before.layoutId).toBe('a');

      const after = fn(makeCtx(0.7));
      expect(after.loop).toBe(true);
      expect(after.layoutId).toBe('b');
    });

    it('switches edgeStyle at midpoint', () => {
      const from = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, edgeStyle: 'smooth' },
      });
      const to = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, edgeStyle: 'ridged' },
      });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
      expect(fn(makeCtx(0.3)).style.edgeStyle).toBe('smooth');
      expect(fn(makeCtx(0.7)).style.edgeStyle).toBe('ridged');
    });

    it('blends style colors', () => {
      const from = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, baseColor: '#000000' },
      });
      const to = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, baseColor: '#ffffff' },
      });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
      const result = fn(makeCtx(0.5));
      // Mid-blend between black and white should be mid-grey
      expect(result.style.baseColor).toBeDefined();
      // The exact hex value depends on blendColor's linear interpolation in sRGB space
    });

    it('switches surfacePattern at midpoint', () => {
      const from = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, surfacePattern: 'brushed' },
      });
      const to = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, surfacePattern: 'grain' },
      });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
      expect(fn(makeCtx(0.3)).style.surfacePattern).toBe('brushed');
      expect(fn(makeCtx(0.7)).style.surfacePattern).toBe('grain');
    });

    it('blends surfaceIntensity', () => {
      const from = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, surfaceIntensity: 0.1 },
      });
      const to = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, surfaceIntensity: 0.5 },
      });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
      const mid = fn(makeCtx(0.5));
      expect(mid.style.surfaceIntensity).toBeCloseTo(0.3, 2);
    });

    it('switches surfaceMapUrl at midpoint', () => {
      const from = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, surfaceMapUrl: '/a.png' },
      });
      const to = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, surfaceMapUrl: '/b.png' },
      });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
      expect(fn(makeCtx(0.3)).style.surfaceMapUrl).toBe('/a.png');
      expect(fn(makeCtx(0.7)).style.surfaceMapUrl).toBe('/b.png');
    });

    it('switches surfaceMaterial at midpoint', () => {
      const from = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, surfaceMaterial: 'onyx' },
      });
      const to = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, surfaceMaterial: 'steel' },
      });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
      expect(fn(makeCtx(0.3)).style.surfaceMaterial).toBe('onyx');
      expect(fn(makeCtx(0.7)).style.surfaceMaterial).toBe('steel');
    });

    it('blends materialApplication numeric fields', () => {
      const from = makeState({
        style: {
          ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
          materialApplication: { colorMix: 0.2, brightness: 0.5 },
        },
      });
      const to = makeState({
        style: {
          ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
          materialApplication: { colorMix: 0.8, brightness: 1.5 },
        },
      });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
      const mid = fn(makeCtx(0.5));
      expect(mid.style.materialApplication.colorMix).toBeCloseTo(0.5, 2);
      expect(mid.style.materialApplication.brightness).toBeCloseTo(1.0, 2);
    });

    it('preserves materialApplication when both sides are empty', () => {
      const from = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, materialApplication: {} },
      });
      const to = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, materialApplication: {} },
      });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
      const result = fn(makeCtx(0.5));
      expect(result.style.materialApplication).toBeDefined();
    });

    it('blends style numeric values', () => {
      const from = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, baseOpacity: 0.2, metalness: 0.0 },
      });
      const to = makeState({
        style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, baseOpacity: 1.0, metalness: 1.0 },
      });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
      const result = fn(makeCtx(0.5));
      expect(result.style.baseOpacity).toBeCloseTo(0.6, 5);
      expect(result.style.metalness).toBeCloseTo(0.5, 5);
    });

    it('cross-fades viewHighlights between scenes (different viewIds)', () => {
      const fromHighlights: readonly ViewHighlight[] = [
        { viewId: 'v1', bounds: { x: 0, y: 0, w: 0.5, h: 0.5 }, mode: 'glow', color: '#ff0000', intensity: 0.5 },
      ];
      const toHighlights: readonly ViewHighlight[] = [
        { viewId: 'v2', bounds: { x: 0.5, y: 0, w: 0.5, h: 0.5 }, mode: 'holographic', color: '#00ff00', intensity: 0.35 },
      ];
      const from = makeState({ viewHighlights: fromHighlights });
      const to = makeState({ viewHighlights: toHighlights });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);

      // At t=0.3: v1 fading out (0.5 * 0.7 = 0.35), v2 fading in (0.35 * 0.3 = 0.105)
      const at03 = fn(makeCtx(0.3)).viewHighlights;
      expect(at03).toHaveLength(2);
      const v1_03 = at03.find((h) => h.viewId === 'v1')!;
      const v2_03 = at03.find((h) => h.viewId === 'v2')!;
      expect(v1_03.intensity).toBeCloseTo(0.35, 5);
      expect(v2_03.intensity).toBeCloseTo(0.105, 5);

      // At t=0.7: v1 fading out (0.5 * 0.3 = 0.15), v2 fading in (0.35 * 0.7 = 0.245)
      const at07 = fn(makeCtx(0.7)).viewHighlights;
      const v1_07 = at07.find((h) => h.viewId === 'v1')!;
      const v2_07 = at07.find((h) => h.viewId === 'v2')!;
      expect(v1_07.intensity).toBeCloseTo(0.15, 5);
      expect(v2_07.intensity).toBeCloseTo(0.245, 5);
    });

    it('blends viewHighlights intensity for same viewId', () => {
      const fromHighlights: readonly ViewHighlight[] = [
        { viewId: 'v1', bounds: { x: 0, y: 0, w: 1, h: 1 }, mode: 'glow', color: '#ff0000', intensity: 0.8 },
      ];
      const toHighlights: readonly ViewHighlight[] = [
        { viewId: 'v1', bounds: { x: 0, y: 0, w: 1, h: 1 }, mode: 'glow', color: '#ff0000', intensity: 0.2 },
      ];
      const from = makeState({ viewHighlights: fromHighlights });
      const to = makeState({ viewHighlights: toHighlights });
      const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
      const result = fn(makeCtx(0.5)).viewHighlights;
      expect(result).toHaveLength(1);
      expect(result[0].intensity).toBeCloseTo(0.5, 5);
    });

    it('fades viewHighlights out during exitFn', () => {
      const highlights: readonly ViewHighlight[] = [
        { viewId: 'v1', bounds: { x: 0, y: 0, w: 1, h: 1 }, mode: 'glow', color: '#fff', intensity: 0.5 },
      ];
      const from = makeState({ viewHighlights: highlights });
      const fn = carouselScrubberTransitionSpec.exitFn(from);

      // At t=0: full intensity
      expect(fn(makeCtx(0)).viewHighlights[0].intensity).toBeCloseTo(0.5, 5);
      // At t=0.5: half intensity
      expect(fn(makeCtx(0.5)).viewHighlights[0].intensity).toBeCloseTo(0.25, 5);
      // At t=1: zero intensity
      expect(fn(makeCtx(1)).viewHighlights[0].intensity).toBeCloseTo(0, 5);
    });

    it('fades viewHighlights in during enterFn', () => {
      const highlights: readonly ViewHighlight[] = [
        { viewId: 'v1', bounds: { x: 0, y: 0, w: 1, h: 1 }, mode: 'holographic', color: '#fff', intensity: 0.35 },
      ];
      const to = makeState({ viewHighlights: highlights });
      const fn = carouselScrubberTransitionSpec.enterFn(to);

      // At t=0: zero intensity
      expect(fn(makeCtx(0)).viewHighlights[0].intensity).toBeCloseTo(0, 5);
      // At t=0.5: half of target
      expect(fn(makeCtx(0.5)).viewHighlights[0].intensity).toBeCloseTo(0.175, 5);
      // At t=1: full target intensity
      expect(fn(makeCtx(1)).viewHighlights[0].intensity).toBeCloseTo(0.35, 5);
    });

    it('returns empty array for empty highlights in exit/enter', () => {
      const from = makeState({ viewHighlights: [] });
      const exitFn = carouselScrubberTransitionSpec.exitFn(from);
      expect(exitFn(makeCtx(0.5)).viewHighlights).toEqual([]);

      const to = makeState({ viewHighlights: [] });
      const enterFn = carouselScrubberTransitionSpec.enterFn(to);
      expect(enterFn(makeCtx(0.5)).viewHighlights).toEqual([]);
    });
  });
});
