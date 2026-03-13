// SpotlightRigCompile tests — pure compile layer. No mocks, no Three.js.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SPOTLIGHT_RIG_THEME,
  resolveSpotlightRig,
  resolveSpotlightLightState,
  spotlightRigTransitionSpec,
} from '../compile';
import type { SpotlightRigProps, SpotlightProps } from '../dsl';
import type { SpotlightRigState, SpotlightLightState } from '../types';
import type { SceneSnapshotContext } from '../../../compiler/sceneTypes';
import type { ThemeFamily } from '../../../theme/types';
import { makeSimpleContext } from '../../../compiler/transitions/transitionResolver';

/** Minimal valid SceneSnapshotContext for testing Resolvable props. */
const makeContext = (sceneIndex = 0, family: ThemeFamily = 'default'): SceneSnapshotContext => ({
  sceneIndex,
  numScenes: 3,
  assetsReady: true,
  themeFamily: family,
  themePolarity: 'dark',
});

// ─── resolveSpotlightRig — no children ────────────────────────────────────────

describe('resolveSpotlightRig — no children', () => {
  it('empty props produce lights array of length 0 (no children)', () => {
    const state = resolveSpotlightRig({}, [], makeContext());
    expect(state.lights).toHaveLength(0);
  });

  it('center defaults to [0, 0, 0]', () => {
    const state = resolveSpotlightRig({}, [], makeContext());
    expect(state.center).toEqual([0, 0, 0]);
  });

  it('target defaults to null', () => {
    const state = resolveSpotlightRig({}, [], makeContext());
    expect(state.target).toBeNull();
  });

  it('showHelper defaults to false', () => {
    const state = resolveSpotlightRig({}, [], makeContext());
    expect(state.showHelper).toBe(false);
  });

  it('enabled is true when called from handler', () => {
    const state = resolveSpotlightRig({}, [], makeContext());
    expect(state.enabled).toBe(true);
  });

  it('rig-level color override applies to all generated lights', () => {
    const lightPropsList: SpotlightProps[] = [{}, {}, {}];
    const state = resolveSpotlightRig({ color: '#AABBCC' }, lightPropsList, makeContext());
    for (const light of state.lights) {
      expect(light.color).toBe('#AABBCC');
    }
  });
});

// ─── resolveSpotlightRig — themeFamily preset lookup ─────────────────────────

describe('resolveSpotlightRig — themeFamily preset', () => {
  it('themeFamily darkGlass applies darkGlass spotlight preset', () => {
    const state = resolveSpotlightRig({}, [{}], makeContext(0, 'darkGlass'));
    expect(state.lights[0]!.color).toBe('#FFD0A0');
  });

  it('themeFamily neonCyber applies neonCyber preset', () => {
    const state = resolveSpotlightRig({}, [{}], makeContext(0, 'neonCyber'));
    expect(state.lights[0]!.color).toBe('#00E7FF');
    expect(state.lights[0]!.showHalo).toBe(true);
  });

  it('default themeFamily uses DEFAULT_SPOTLIGHT_RIG_THEME', () => {
    const state = resolveSpotlightRig({}, [{}], makeContext(0, 'default'));
    expect(state.lights[0]!.color).toBe(DEFAULT_SPOTLIGHT_RIG_THEME.color);
  });
});

// ─── resolveSpotlightRig — with children ──────────────────────────────────────

describe('resolveSpotlightRig — with children', () => {
  it('two children produce lights array of length 2', () => {
    const state = resolveSpotlightRig({}, [{}, {}], makeContext());
    expect(state.lights).toHaveLength(2);
  });

  it('three children produce lights array of length 3', () => {
    const state = resolveSpotlightRig({}, [{}, {}, {}], makeContext());
    expect(state.lights).toHaveLength(3);
  });

  it('per-light color override wins over rig-level color', () => {
    const lightPropsList: SpotlightProps[] = [
      { color: '#LIGHT0' },
      { color: '#LIGHT1' },
    ];
    const state = resolveSpotlightRig({ color: '#RIG' }, lightPropsList, makeContext());
    expect(state.lights[0]!.color).toBe('#LIGHT0');
    expect(state.lights[1]!.color).toBe('#LIGHT1');
  });

  it('rig-level color applies to lights that do not override it', () => {
    const lightPropsList: SpotlightProps[] = [
      { color: '#OVERRIDDEN' },
      {},
    ];
    const state = resolveSpotlightRig({ color: '#RIG_COLOR' }, lightPropsList, makeContext());
    expect(state.lights[0]!.color).toBe('#OVERRIDDEN');
    expect(state.lights[1]!.color).toBe('#RIG_COLOR');
  });

  it('per-light target is resolved into lights[i].target; null when absent', () => {
    const lightPropsList: SpotlightProps[] = [
      { target: [1, 2, 3] },
      {},
    ];
    const state = resolveSpotlightRig({}, lightPropsList, makeContext());
    expect(state.lights[0]!.target).toEqual([1, 2, 3]);
    expect(state.lights[1]!.target).toBeNull();
  });

  it('per-light explicit phase overrides auto-distribution', () => {
    const lightPropsList: SpotlightProps[] = [
      { phase: 1.23 },
      {},
    ];
    const state = resolveSpotlightRig({}, lightPropsList, makeContext());
    expect(state.lights[0]!.phase).toBe(1.23);
    // Second light uses auto-phase: 2π * 1 / 2
    expect(state.lights[1]!.phase).toBeCloseTo((Math.PI * 2 * 1) / 2);
  });

  it('auto-phase distributes evenly: 3 lights → phases 0, 2π/3, 4π/3', () => {
    const state = resolveSpotlightRig({}, [{}, {}, {}], makeContext());
    expect(state.lights[0]!.phase).toBeCloseTo(0);
    expect(state.lights[1]!.phase).toBeCloseTo((Math.PI * 2) / 3);
    expect(state.lights[2]!.phase).toBeCloseTo((Math.PI * 4) / 3);
  });

  it('Resolvable props on children are resolved using context', () => {
    const lightPropsList: SpotlightProps[] = [
      { intensity: (ctx) => ctx.sceneIndex === 0 ? 50 : 100 },
    ];
    const stateScene0 = resolveSpotlightRig({}, lightPropsList, makeContext(0));
    const stateScene1 = resolveSpotlightRig({}, lightPropsList, makeContext(1));
    expect(stateScene0.lights[0]!.intensity).toBe(50);
    expect(stateScene1.lights[0]!.intensity).toBe(100);
  });

  it('showHelper prop is set from rig props', () => {
    const state = resolveSpotlightRig({ showHelper: true }, [{}], makeContext());
    expect(state.showHelper).toBe(true);
  });
});

// ─── resolveSpotlightLightState — unit tests ──────────────────────────────────

describe('resolveSpotlightLightState', () => {
  const theme = DEFAULT_SPOTLIGHT_RIG_THEME;
  const emptyRig: SpotlightRigProps = {};

  it('with all props absent uses theme defaults', () => {
    const result = resolveSpotlightLightState({}, emptyRig, theme, makeContext(), 0);
    expect(result.color).toBe(theme.color);
    expect(result.intensity).toBe(theme.intensity);
    expect(result.speed).toBe(theme.speed);
    expect(result.radius).toBe(theme.radius);
  });

  it('with light-level intensity wins over rig and theme', () => {
    const result = resolveSpotlightLightState(
      { intensity: 999 },
      { intensity: 111 },
      theme,
      makeContext(),
      0,
    );
    expect(result.intensity).toBe(999);
  });

  it('with rig-level intensity and no light-level override rig value used', () => {
    const result = resolveSpotlightLightState(
      {},
      { intensity: 42 },
      theme,
      makeContext(),
      0,
    );
    expect(result.intensity).toBe(42);
  });

  it('with only theme theme value used', () => {
    const customTheme = { ...theme, intensity: 77 };
    const result = resolveSpotlightLightState({}, emptyRig, customTheme, makeContext(), 0);
    expect(result.intensity).toBe(77);
  });

  it('phase explicit value returned as-is', () => {
    const result = resolveSpotlightLightState({ phase: 2.5 }, emptyRig, theme, makeContext(), 0.1);
    expect(result.phase).toBe(2.5);
  });

  it('phase absent uses autoPhase argument', () => {
    const result = resolveSpotlightLightState({}, emptyRig, theme, makeContext(), 1.57);
    expect(result.phase).toBeCloseTo(1.57);
  });

  it('target absent returns null', () => {
    const result = resolveSpotlightLightState({}, emptyRig, theme, makeContext(), 0);
    expect(result.target).toBeNull();
  });

  it('target present resolved to tuple', () => {
    const result = resolveSpotlightLightState({ target: [1, 2, 3] }, emptyRig, theme, makeContext(), 0);
    expect(result.target).toEqual([1, 2, 3]);
  });
});

// ─── spotlightRigTransitionSpec — updated for lights[] ────────────────────────

/** Build a minimal SpotlightLightState for testing. */
const makeLightState = (overrides: Partial<SpotlightLightState> = {}): SpotlightLightState => ({
  ...DEFAULT_SPOTLIGHT_RIG_THEME,
  phase: 0,
  target: null,
  ...overrides,
});

/** Build a SpotlightRigState with lights[] for testing. */
const makeRigState = (
  numLights: number,
  lightOverrides: Partial<SpotlightLightState> = {},
  rigOverrides: Partial<Omit<SpotlightRigState, 'lights'>> = {},
): SpotlightRigState => ({
  center: [0, 0, 0],
  target: null,
  showHelper: false,
  enabled: true,
  lights: Array.from({ length: numLights }, () => makeLightState(lightOverrides)),
  ...rigOverrides,
});

describe('spotlightRigTransitionSpec.enterFn', () => {
  it('at t=0: all lights have intensity=0, beamOpacity=0, haloOpacity=0', () => {
    const toState = makeRigState(2, { intensity: 80, beamOpacity: 0.1, haloOpacity: 0.3 });
    const fn = spotlightRigTransitionSpec.enterFn(toState);
    const result = fn(makeSimpleContext(0));
    for (const light of result.lights) {
      expect(light.intensity).toBe(0);
      expect(light.beamOpacity).toBe(0);
      expect(light.haloOpacity).toBe(0);
    }
  });

  it('at t=1: all lights have their toState intensity and opacity', () => {
    const toState = makeRigState(2, { intensity: 80, beamOpacity: 0.1, haloOpacity: 0.3 });
    const fn = spotlightRigTransitionSpec.enterFn(toState);
    const result = fn(makeSimpleContext(1));
    for (const light of result.lights) {
      expect(light.intensity).toBeCloseTo(80);
      expect(light.beamOpacity).toBeCloseTo(0.1);
      expect(light.haloOpacity).toBeCloseTo(0.3);
    }
  });
});

describe('spotlightRigTransitionSpec.exitFn', () => {
  it('at t=1: all lights have intensity=0, beamOpacity=0, haloOpacity=0 (fully exited)', () => {
    const fromState = makeRigState(3, { intensity: 80, beamOpacity: 0.1, haloOpacity: 0.3 });
    const fn = spotlightRigTransitionSpec.exitFn(fromState);
    const result = fn(makeSimpleContext(1));
    for (const light of result.lights) {
      expect(light.intensity).toBe(0);
      expect(light.beamOpacity).toBe(0);
      expect(light.haloOpacity).toBe(0);
    }
  });
});

describe('spotlightRigTransitionSpec.interpolateFn', () => {
  it('at t=0.5 with matching light counts: midpoint intensities', () => {
    const from = makeRigState(2, { intensity: 0 });
    const to = makeRigState(2, { intensity: 100 });
    const fn = spotlightRigTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    for (const light of result.lights) {
      expect(light.intensity).toBeCloseTo(50);
    }
  });

  it('from.lights.length=2, to.lights.length=4: result has length 4', () => {
    const from = makeRigState(2, { intensity: 80 });
    const to = makeRigState(4, { intensity: 60 });
    const fn = spotlightRigTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    expect(result.lights).toHaveLength(4);
  });

  it('new lights (indices 2, 3) fade in at t=0.5', () => {
    const from = makeRigState(2, { intensity: 80 });
    const to = makeRigState(4, { intensity: 60 });
    const fn = spotlightRigTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    // Lights 0 and 1 are blended (80→60 at t=0.5 = 70)
    expect(result.lights[0]!.intensity).toBeCloseTo(70);
    expect(result.lights[1]!.intensity).toBeCloseTo(70);
    // Lights 2 and 3 fade in from 0 (intensity at t=0.5 is half of toState)
    expect(result.lights[2]!.intensity).toBeCloseTo(30);
    expect(result.lights[3]!.intensity).toBeCloseTo(30);
  });

  it('from.lights.length=4, to.lights.length=2: result has length 4', () => {
    const from = makeRigState(4, { intensity: 80 });
    const to = makeRigState(2, { intensity: 60 });
    const fn = spotlightRigTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    expect(result.lights).toHaveLength(4);
  });

  it('removed lights (indices 2, 3) fade out at t=0.5', () => {
    const from = makeRigState(4, { intensity: 80 });
    const to = makeRigState(2, { intensity: 60 });
    const fn = spotlightRigTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    // Lights 2 and 3 fade out to 0 (intensity at t=0.5 is half of fromState)
    expect(result.lights[2]!.intensity).toBeCloseTo(40);
    expect(result.lights[3]!.intensity).toBeCloseTo(40);
  });

  it('discrete field castShadow takes to value at all t values', () => {
    const from = makeRigState(2, { castShadow: false });
    const to = makeRigState(2, { castShadow: true });
    const fn = spotlightRigTransitionSpec.interpolateFn(from, to);
    expect(fn(makeSimpleContext(0)).lights[0]!.castShadow).toBe(true);
    expect(fn(makeSimpleContext(0.5)).lights[0]!.castShadow).toBe(true);
    expect(fn(makeSimpleContext(1)).lights[0]!.castShadow).toBe(true);
  });

  it('center [0,0,0] → [4,0,0] at t=0.5 produces [2,0,0]', () => {
    const from = makeRigState(1, {}, { center: [0, 0, 0] });
    const to = makeRigState(1, {}, { center: [4, 0, 0] });
    const fn = spotlightRigTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    expect(result.center[0]).toBeCloseTo(2);
    expect(result.center[1]).toBeCloseTo(0);
    expect(result.center[2]).toBeCloseTo(0);
  });

  it('target null → [1,2,3]: takes to.target (null→non-null discrete)', () => {
    const from = makeRigState(1, {}, { target: null });
    const to = makeRigState(1, {}, { target: [1, 2, 3] });
    const fn = spotlightRigTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    expect(result.target).toEqual([1, 2, 3]);
  });

  it('target [0,0,-4] → [0,0,-8] at t=0.5 produces [0,0,-6]', () => {
    const from = makeRigState(1, {}, { target: [0, 0, -4] });
    const to = makeRigState(1, {}, { target: [0, 0, -8] });
    const fn = spotlightRigTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    expect(result.target![2]).toBeCloseTo(-6);
  });
});
