import { describe, it, expect } from 'vitest';
import { Environment } from '../dsl';
import { DEFAULT_ENVIRONMENT, environmentTransitionSpec, functionalEnvironmentTransitionSpec } from '../compile';
import { applyEnvironment } from '../render';
import type { SceneEnvironment } from '../types';
import { makeInitContext } from '../../__tests__/elementTestMocks';

describe('environment compile + render', () => {
  it('defaults are disabled with intensity 1', () => {
    expect(DEFAULT_ENVIRONMENT.enabled).toBe(false);
    expect(DEFAULT_ENVIRONMENT.intensity).toBe(1);
  });

  it('functional transitionSpec.exit disables and fades intensity', () => {
    const state: SceneEnvironment = {
      enabled: true,
      intensity: 1,
      source: { type: 'hdr', url: '/env.hdr' },
    };
    const fn = functionalEnvironmentTransitionSpec.exitFn(state);
    const result = fn(1);
    expect(result.enabled).toBe(false);
    expect(result.intensity).toBeCloseTo(0);
  });

  it('functional transitionSpec.exit at t=0 preserves intensity', () => {
    const state: SceneEnvironment = { enabled: true, intensity: 0.6 };
    const fn = functionalEnvironmentTransitionSpec.exitFn(state);
    const result = fn(0);
    expect(result.enabled).toBe(true);
    expect(result.intensity).toBeCloseTo(0.6);
  });

  it('functional transitionSpec.enter enables and fades intensity in', () => {
    const state: SceneEnvironment = { enabled: true, intensity: 0.8 };
    const fn = functionalEnvironmentTransitionSpec.enterFn(state);
    const result = fn(0.5);
    expect(result.enabled).toBe(true);
    expect(result.intensity).toBeGreaterThan(0);
  });

  it('functional transitionSpec.enter at t=1 returns full intensity', () => {
    const state: SceneEnvironment = { enabled: true, intensity: 0.8 };
    const fn = functionalEnvironmentTransitionSpec.enterFn(state);
    const result = fn(1);
    expect(result.intensity).toBeCloseTo(0.8);
  });

  it('functional transitionSpec.interpolate at t=0 returns from state', () => {
    const from: SceneEnvironment = { enabled: true, intensity: 0.2, source: { type: 'hdr', url: '/from.hdr' } };
    const to: SceneEnvironment = { enabled: true, intensity: 0.8, source: { type: 'hdr', url: '/to.hdr' } };
    const fn = functionalEnvironmentTransitionSpec.interpolateFn(from, to);
    const result = fn(0);
    expect(result.source && 'url' in result.source ? result.source.url : '').toBe('/from.hdr');
    expect(result.intensity).toBeCloseTo(0.2);
  });

  it('functional transitionSpec.interpolate at t=1 returns to state', () => {
    const from: SceneEnvironment = { enabled: true, intensity: 0.2, source: { type: 'hdr', url: '/from.hdr' } };
    const to: SceneEnvironment = { enabled: true, intensity: 0.8, source: { type: 'hdr', url: '/to.hdr' } };
    const fn = functionalEnvironmentTransitionSpec.interpolateFn(from, to);
    const result = fn(1);
    expect(result.source && 'url' in result.source ? result.source.url : '').toBe('/to.hdr');
    expect(result.intensity).toBeCloseTo(0.8);
  });

  it('functional transitionSpec.interpolate at t=0.5 blends intensity', () => {
    const from: SceneEnvironment = { enabled: true, intensity: 0.2 };
    const to: SceneEnvironment = { enabled: true, intensity: 0.8 };
    const fn = functionalEnvironmentTransitionSpec.interpolateFn(from, to);
    const result = fn(0.5);
    expect(result.intensity).toBeGreaterThan(0.2);
    expect(result.intensity).toBeLessThan(0.8);
  });

  it('functional transitionSpec.interpolate switches source at midpoint', () => {
    const from: SceneEnvironment = {
      enabled: true,
      intensity: 0.2,
      source: { type: 'hdr', url: '/from.hdr' },
    };
    const to: SceneEnvironment = {
      enabled: true,
      intensity: 0.8,
      source: { type: 'hdr', url: '/to.hdr' },
    };
    const fn = functionalEnvironmentTransitionSpec.interpolateFn(from, to);
    const at25 = fn(0.25);
    const at75 = fn(0.75);
    expect(at25.source?.type).toBe('hdr');
    expect(at75.source?.type).toBe('hdr');
    expect(at25.source && 'url' in at25.source ? at25.source.url : '').toBe('/from.hdr');
    expect(at75.source && 'url' in at75.source ? at75.source.url : '').toBe('/to.hdr');
  });

  it('discrete transitionSpec.exit writes frames with fading intensity', () => {
    const frames = Array.from({ length: 3 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const from: SceneEnvironment = { enabled: true, intensity: 1 };
    environmentTransitionSpec.exit(frames, 'env', from);
    expect((frames[0]!.state.widgets['env'] as SceneEnvironment).intensity).toBeCloseTo(1);
    expect((frames[2]!.state.widgets['env'] as SceneEnvironment).intensity).toBeCloseTo(0);
  });

  it('discrete transitionSpec.interpolate blends enabled state', () => {
    const frames = Array.from({ length: 3 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const from: SceneEnvironment = { enabled: true, intensity: 0.2 };
    const to: SceneEnvironment = { enabled: false, intensity: 0.8 };
    environmentTransitionSpec.interpolate(frames, 'env', from, to);
    const mid = frames[1]!.state.widgets['env'] as SceneEnvironment;
    expect(mid.enabled).toBe(true);
  });

  it('applyEnvironment does not throw without a renderer', () => {
    const ctx = makeInitContext();
    const state: SceneEnvironment = { enabled: true, intensity: 1 };
    expect(() => applyEnvironment(state, { scene: ctx.scene })).not.toThrow();
  });

  it('Environment DSL component renders null and has displayName', () => {
    expect(Environment.displayName).toBe('Environment');
    expect(Environment({})).toBeNull();
  });
});
