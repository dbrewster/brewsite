import { describe, it, expect } from 'vitest';
import { Floor } from '../dsl';
import { DEFAULT_FLOOR, floorTransitionSpec, functionalFloorTransitionSpec } from '../compile';
import { applyFloor } from '../render';
import type { SceneFloor } from '../types';
import { makeInitContext } from '../../__tests__/elementTestMocks';

describe('floor compile + render', () => {
  it('defaults are disabled with no texture', () => {
    expect(DEFAULT_FLOOR.enabled).toBe(false);
    expect(DEFAULT_FLOOR.surface).toBeUndefined();
  });

  it('functional transitionSpec.exit disables at t=1', () => {
    const state: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/floor.jpg' } };
    const fn = functionalFloorTransitionSpec.exitFn(state);
    const result = fn(1);
    expect(result.enabled).toBe(false);
  });

  it('functional transitionSpec.exit preserves enabled at t=0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = functionalFloorTransitionSpec.exitFn(state);
    const result = fn(0);
    expect(result.enabled).toBe(true);
  });

  it('functional transitionSpec.enter disables at t=0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = functionalFloorTransitionSpec.enterFn(state);
    const result = fn(0);
    expect(result.enabled).toBe(false);
  });

  it('functional transitionSpec.enter enables at t=1', () => {
    const state: SceneFloor = { enabled: true };
    const fn = functionalFloorTransitionSpec.enterFn(state);
    const result = fn(1);
    expect(result.enabled).toBe(true);
  });

  it('functional transitionSpec.interpolate at t=0 returns from state', () => {
    const from: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/from.jpg' } };
    const to: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/to.jpg' } };
    const fn = functionalFloorTransitionSpec.interpolateFn(from, to);
    const result = fn(0);
    expect((result.surface as { textureUrl?: string })?.textureUrl).toBe('/from.jpg');
  });

  it('functional transitionSpec.interpolate at t=1 returns to state', () => {
    const from: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/from.jpg' } };
    const to: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/to.jpg' } };
    const fn = functionalFloorTransitionSpec.interpolateFn(from, to);
    const result = fn(1);
    expect((result.surface as { textureUrl?: string })?.textureUrl).toBe('/to.jpg');
  });

  it('functional transitionSpec.interpolate switches texture at midpoint', () => {
    const from: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/from.jpg' } };
    const to: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/to.jpg' } };
    const fn = functionalFloorTransitionSpec.interpolateFn(from, to);
    const at25 = fn(0.25);
    const at75 = fn(0.75);
    expect(at25.surface?.type).toBe('physical');
    expect((at25.surface as { textureUrl?: string })?.textureUrl).toBe('/from.jpg');
    expect(at75.surface?.type).toBe('physical');
    expect((at75.surface as { textureUrl?: string })?.textureUrl).toBe('/to.jpg');
  });

  it('discrete transitionSpec.exit writes enabled false at end', () => {
    const frames = Array.from({ length: 3 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const from: SceneFloor = { enabled: true };
    floorTransitionSpec.exit(frames, 'floor', from);
    expect((frames[2]!.state.widgets['floor'] as SceneFloor).enabled).toBe(false);
  });

  it('discrete transitionSpec.enter writes enabled true at end', () => {
    const frames = Array.from({ length: 3 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const to: SceneFloor = { enabled: true };
    floorTransitionSpec.enter(frames, 'floor', to);
    expect((frames[2]!.state.widgets['floor'] as SceneFloor).enabled).toBe(true);
  });

  it('discrete transitionSpec.interpolate switches surface at midpoint', () => {
    const frames = Array.from({ length: 5 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const from: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/from.jpg' } };
    const to: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/to.jpg' } };
    floorTransitionSpec.interpolate(frames, 'floor', from, to);
    expect((frames[1]!.state.widgets['floor'] as SceneFloor).surface).toBe(from.surface);
    expect((frames[3]!.state.widgets['floor'] as SceneFloor).surface).toBe(to.surface);
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
