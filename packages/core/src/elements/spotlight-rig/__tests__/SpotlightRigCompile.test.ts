// SpotlightRigCompile tests — pure compile layer. No mocks, no Three.js.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SPOTLIGHT_RIG_THEME,
  DEFAULT_SPOTLIGHT_RIG_COUNT,
  resolveSpotlightRigState,
  spotlightRigTransitionSpec,
  mergeSpotlightRigTheme,
} from '../compile';
import type { SpotlightRigProps } from '../dsl';
import type { SpotlightRigState } from '../types';
import type { SceneSnapshotContext } from '../../../compiler/sceneTypes';
import { makeSimpleContext } from '../../../compiler/transitions/transitionResolver';

/** Minimal valid SceneSnapshotContext for testing Resolvable props. */
const makeContext = (sceneIndex = 0): SceneSnapshotContext => ({
  sceneIndex,
  numScenes: 3,
  assetsReady: true,
});

describe('resolveSpotlightRigState', () => {
  it('with no props returns DEFAULT_SPOTLIGHT_RIG_THEME values and default count', () => {
    const state = resolveSpotlightRigState({}, makeContext());
    expect(state.color).toBe(DEFAULT_SPOTLIGHT_RIG_THEME.color);
    expect(state.intensity).toBe(DEFAULT_SPOTLIGHT_RIG_THEME.intensity);
    expect(state.speed).toBe(DEFAULT_SPOTLIGHT_RIG_THEME.speed);
    expect(state.count).toBe(DEFAULT_SPOTLIGHT_RIG_COUNT);
    expect(state.showHelper).toBe(false);
    expect(state.enabled).toBe(true);
  });

  it('with props.theme applies theme values over defaults', () => {
    const theme = { ...DEFAULT_SPOTLIGHT_RIG_THEME, color: '#FF0000', intensity: 200 };
    const state = resolveSpotlightRigState({ theme }, makeContext());
    expect(state.color).toBe('#FF0000');
    expect(state.intensity).toBe(200);
    // Un-overridden theme fields carry default values
    expect(state.speed).toBe(DEFAULT_SPOTLIGHT_RIG_THEME.speed);
  });

  it('with theme + individual override, override wins over theme', () => {
    const theme = { ...DEFAULT_SPOTLIGHT_RIG_THEME, color: '#FF0000', intensity: 200 };
    const state = resolveSpotlightRigState({ theme, color: '#00FF00' }, makeContext());
    expect(state.color).toBe('#00FF00');
    // theme value still applies for non-overridden keys
    expect(state.intensity).toBe(200);
  });

  it('Resolvable<number> speed is resolved via context', () => {
    const props: SpotlightRigProps = {
      speed: (ctx) => ctx.sceneIndex === 0 ? 0.3 : 0.8,
    };
    const stateScene0 = resolveSpotlightRigState(props, makeContext(0));
    const stateScene1 = resolveSpotlightRigState(props, makeContext(1));
    expect(stateScene0.speed).toBe(0.3);
    expect(stateScene1.speed).toBe(0.8);
  });

  it('showHelper boolean prop is NOT Resolvable — passed through directly', () => {
    // showHelper is typed as plain boolean, not Resolvable<boolean>.
    // It must be set directly from props.showHelper without function resolution.
    const state = resolveSpotlightRigState({ showHelper: true }, makeContext());
    expect(state.showHelper).toBe(true);
    const stateOff = resolveSpotlightRigState({ showHelper: false }, makeContext());
    expect(stateOff.showHelper).toBe(false);
  });
});

describe('spotlightRigTransitionSpec.enterFn', () => {
  const toState: SpotlightRigState = {
    ...DEFAULT_SPOTLIGHT_RIG_THEME,
    center: [0, 0, 0],
    target: null,
    count: 3,
    showHelper: false,
    enabled: true,
  };

  it('at t=0 produces intensity=0, beamOpacity=0, haloOpacity=0', () => {
    const fn = spotlightRigTransitionSpec.enterFn(toState);
    const result = fn(makeSimpleContext(0));
    expect(result.intensity).toBe(0);
    expect(result.beamOpacity).toBe(0);
    expect(result.haloOpacity).toBe(0);
  });

  it('at t=1 produces full toState intensity and opacity', () => {
    const fn = spotlightRigTransitionSpec.enterFn(toState);
    const result = fn(makeSimpleContext(1));
    expect(result.intensity).toBeCloseTo(toState.intensity);
    expect(result.beamOpacity).toBeCloseTo(toState.beamOpacity);
    expect(result.haloOpacity).toBeCloseTo(toState.haloOpacity);
  });
});

describe('spotlightRigTransitionSpec.exitFn', () => {
  const fromState: SpotlightRigState = {
    ...DEFAULT_SPOTLIGHT_RIG_THEME,
    intensity: 80,
    beamOpacity: 0.10,
    haloOpacity: 0.3,
    center: [0, 0, 0],
    target: null,
    count: 3,
    showHelper: false,
    enabled: true,
  };

  it('at t=1 produces intensity=0 (fully exited)', () => {
    const fn = spotlightRigTransitionSpec.exitFn(fromState);
    const result = fn(makeSimpleContext(1));
    expect(result.intensity).toBe(0);
    expect(result.beamOpacity).toBe(0);
    expect(result.haloOpacity).toBe(0);
  });
});

describe('spotlightRigTransitionSpec.interpolateFn', () => {
  const from: SpotlightRigState = {
    ...DEFAULT_SPOTLIGHT_RIG_THEME,
    intensity: 0,
    beamOpacity: 0,
    center: [0, 0, 0],
    target: null,
    count: 2,
    showHelper: false,
    enabled: true,
  };
  const to: SpotlightRigState = {
    ...DEFAULT_SPOTLIGHT_RIG_THEME,
    intensity: 100,
    beamOpacity: 0.20,
    center: [0, 0, 0],
    target: null,
    count: 4,         // discrete — should take to value
    showHelper: true, // discrete — should take to value
    enabled: true,
  };

  it('at t=0.5 produces midpoint intensity', () => {
    const fn = spotlightRigTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    expect(result.intensity).toBeCloseTo(50);
  });

  it('discrete field count takes to value immediately', () => {
    const fn = spotlightRigTransitionSpec.interpolateFn(from, to);
    const at0 = fn(makeSimpleContext(0));
    const at05 = fn(makeSimpleContext(0.5));
    const at1 = fn(makeSimpleContext(1));
    // count is discrete — always equals to.count
    expect(at0.count).toBe(to.count);
    expect(at05.count).toBe(to.count);
    expect(at1.count).toBe(to.count);
  });

  it('discrete field castShadow takes to value immediately', () => {
    const fromShadow: SpotlightRigState = { ...from, castShadow: false };
    const toShadow: SpotlightRigState = { ...to, castShadow: true };
    const fn = spotlightRigTransitionSpec.interpolateFn(fromShadow, toShadow);
    const result = fn(makeSimpleContext(0));
    expect(result.castShadow).toBe(true);
  });

  it('discrete field showHelper takes to value immediately', () => {
    const fn = spotlightRigTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0));
    expect(result.showHelper).toBe(to.showHelper);
  });
});

describe('mergeSpotlightRigTheme', () => {
  it('produces merged object with overrides applied', () => {
    const merged = mergeSpotlightRigTheme(DEFAULT_SPOTLIGHT_RIG_THEME, { color: '#AABBCC', intensity: 55 });
    expect(merged.color).toBe('#AABBCC');
    expect(merged.intensity).toBe(55);
    // Non-overridden fields preserved
    expect(merged.speed).toBe(DEFAULT_SPOTLIGHT_RIG_THEME.speed);
  });

  it('does not mutate the base theme', () => {
    const original = { ...DEFAULT_SPOTLIGHT_RIG_THEME };
    mergeSpotlightRigTheme(DEFAULT_SPOTLIGHT_RIG_THEME, { color: '#000000' });
    expect(DEFAULT_SPOTLIGHT_RIG_THEME.color).toBe(original.color);
  });

  it('does not mutate the overrides object', () => {
    const overrides: Partial<typeof DEFAULT_SPOTLIGHT_RIG_THEME> = { color: '#000000' };
    mergeSpotlightRigTheme(DEFAULT_SPOTLIGHT_RIG_THEME, overrides);
    expect(overrides.color).toBe('#000000');
  });
});
