import { describe, it, expect } from 'vitest';
import { Environment } from '../dsl';
import { DEFAULT_ENVIRONMENT, environmentTransitionSpec } from '../compile';
import { applyEnvironment } from '../render';
import type { SceneEnvironment } from '../types';
import { makeTransitionContext, makeInitContext } from '../../__tests__/elementTestMocks';

describe('environment compile + render', () => {
  it('defaults are disabled with intensity 1', () => {
    expect(DEFAULT_ENVIRONMENT.enabled).toBe(false);
    expect(DEFAULT_ENVIRONMENT.intensity).toBe(1);
  });

  it('transitionSpec.exit disables and fades intensity', () => {
    const state: SceneEnvironment = { enabled: true, intensity: 1, url: '/env.hdr' };
    const result = environmentTransitionSpec.exit(state, makeTransitionContext({ tExit: 1 }));
    expect(result.enabled).toBe(false);
    expect(result.intensity).toBeCloseTo(0);
  });

  it('transitionSpec.interpolate switches url at midpoint', () => {
    const from: SceneEnvironment = { enabled: true, intensity: 0.2, url: '/from.hdr' };
    const to: SceneEnvironment = { enabled: true, intensity: 0.8, url: '/to.hdr' };
    const at25 = environmentTransitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 0.25 }));
    const at75 = environmentTransitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 0.75 }));
    expect(at25.url).toBe('/from.hdr');
    expect(at75.url).toBe('/to.hdr');
  });

  it('applyEnvironment is a no-op stub that does not throw', () => {
    const ctx = makeInitContext();
    const state: SceneEnvironment = { enabled: true, intensity: 1 };
    expect(() => applyEnvironment(state, { scene: ctx.scene })).not.toThrow();
  });

  it('Environment DSL component renders null and has displayName', () => {
    expect(Environment.displayName).toBe('Environment');
    expect(Environment({})).toBeNull();
  });
});
