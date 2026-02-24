import { describe, it, expect } from 'vitest';
import { Environment } from '../dsl';
import { DEFAULT_ENVIRONMENT, environmentTransitionSpec } from '../compile';
import { applyEnvironment } from '../render';
import type { SceneEnvironment } from '../types';
import { makeFrameSlice, makeInitContext } from '../../__tests__/elementTestMocks';

describe('environment compile + render', () => {
  it('defaults are disabled with intensity 1', () => {
    expect(DEFAULT_ENVIRONMENT.enabled).toBe(false);
    expect(DEFAULT_ENVIRONMENT.intensity).toBe(1);
  });

  it('transitionSpec.exit disables and fades intensity', () => {
    const state: SceneEnvironment = {
      enabled: true,
      intensity: 1,
      source: { type: 'hdr', url: '/env.hdr' },
    };
    const frames = makeFrameSlice(2);
    environmentTransitionSpec.exit(frames, 'env', state);
    const result = frames[1]!.state.widgets['env'] as SceneEnvironment;
    expect(result.enabled).toBe(false);
    expect(result.intensity).toBeCloseTo(0);
  });

  it('transitionSpec.interpolate switches source at midpoint', () => {
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
    const frames = makeFrameSlice(5);
    environmentTransitionSpec.interpolate(frames, 'env', from, to);
    const at25 = frames[1]!.state.widgets['env'] as SceneEnvironment;
    const at75 = frames[3]!.state.widgets['env'] as SceneEnvironment;
    expect(at25.source?.type).toBe('hdr');
    expect(at75.source?.type).toBe('hdr');
    expect(at25.source && 'url' in at25.source ? at25.source.url : '').toBe('/from.hdr');
    expect(at75.source && 'url' in at75.source ? at75.source.url : '').toBe('/to.hdr');
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
