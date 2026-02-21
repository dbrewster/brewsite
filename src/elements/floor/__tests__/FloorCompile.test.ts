import { describe, it, expect } from 'vitest';
import { Floor } from '../dsl';
import { DEFAULT_FLOOR, floorTransitionSpec } from '../compile';
import { applyFloor } from '../render';
import type { SceneFloor } from '../types';
import { makeFrameSlice, makeInitContext } from '../../__tests__/elementTestMocks';

describe('floor compile + render', () => {
  it('defaults are disabled with no texture', () => {
    expect(DEFAULT_FLOOR.enabled).toBe(false);
    expect(DEFAULT_FLOOR.textureUrl).toBeUndefined();
  });

  it('transitionSpec.exit disables at tExit=1', () => {
    const state: SceneFloor = { enabled: true, textureUrl: '/floor.jpg' };
    const frames = makeFrameSlice(2);
    floorTransitionSpec.exit(frames, 'floor', state);
    const result = frames[1]!.state.widgets['floor'] as SceneFloor;
    expect(result.enabled).toBe(false);
  });

  it('transitionSpec.interpolate switches texture at midpoint', () => {
    const from: SceneFloor = { enabled: true, textureUrl: '/from.jpg' };
    const to: SceneFloor = { enabled: true, textureUrl: '/to.jpg' };
    const frames = makeFrameSlice(5);
    floorTransitionSpec.interpolate(frames, 'floor', from, to);
    const at25 = frames[1]!.state.widgets['floor'] as SceneFloor;
    const at75 = frames[3]!.state.widgets['floor'] as SceneFloor;
    expect(at25.textureUrl).toBe('/from.jpg');
    expect(at75.textureUrl).toBe('/to.jpg');
  });

  it('applyFloor is a no-op stub that does not throw', () => {
    const ctx = makeInitContext();
    const state: SceneFloor = { enabled: true };
    expect(() => applyFloor(state, { scene: ctx.scene })).not.toThrow();
  });

  it('Floor DSL component renders null and has displayName', () => {
    expect(Floor.displayName).toBe('Floor');
    expect(Floor({})).toBeNull();
  });
});
