// Tests for functionalMediaScreenTransitionSpec: verifies blend behavior for all fields.
import { describe, it, expect } from 'vitest';
import { compileMediaScreen, functionalMediaScreenTransitionSpec } from '../compile';
import type { MediaScreenState } from '../types';

/** Minimal TransitionContext for tests. */
function ctx(t: number): { t: number; bp: number; channel: (name: string) => number } {
  return { t, bp: t, channel: () => t };
}

const fromState: MediaScreenState = compileMediaScreen({
  id: 'ms',
  src: '/from.mp4',
  x: '20%', y: '30%', z: -1,
  width: '50%',
  height: '40%',
  rotation: [0, 0, 0],
  scale: 0.8,
  opacity: 1,
  gloss: 0.2,
  glossRoughness: 0.1,
  selfIllumination: 0.1,
  glowOpacity: 0.2,
  glow: false,
  loop: false,
  muted: false,
  autoPlay: false,
  bezel: 'dark',
});

const toState: MediaScreenState = compileMediaScreen({
  id: 'ms',
  streamId: 'my-stream',
  x: '80%', y: '70%', z: 1,
  width: '90%',
  height: '80%',
  rotation: ['0.5rad', '0.5rad', '0.5rad'],
  scale: 1.5,
  opacity: 0.6,
  gloss: 0.8,
  glossRoughness: 0.02,
  selfIllumination: 0.6,
  glowOpacity: 0.9,
  glow: true,
  loop: true,
  muted: true,
  autoPlay: true,
  bezel: 'thin',
});

describe('functionalMediaScreenTransitionSpec.exitFn', () => {
  it('blends opacity to 0 at t=1', () => {
    const fn = functionalMediaScreenTransitionSpec.exitFn(fromState);
    const result = fn(ctx(1));
    expect(result.opacity).toBe(0);
  });

  it('keeps opacity at fromState at t=0', () => {
    const fn = functionalMediaScreenTransitionSpec.exitFn(fromState);
    const result = fn(ctx(0));
    expect(result.opacity).toBeCloseTo(fromState.opacity);
  });
});

describe('functionalMediaScreenTransitionSpec.enterFn', () => {
  it('blends opacity from 0 at t=0', () => {
    const fn = functionalMediaScreenTransitionSpec.enterFn(toState);
    const result = fn(ctx(0));
    expect(result.opacity).toBe(0);
  });

  it('reaches toState.opacity at t=1', () => {
    const fn = functionalMediaScreenTransitionSpec.enterFn(toState);
    const result = fn(ctx(1));
    expect(result.opacity).toBeCloseTo(toState.opacity);
  });
});

describe('functionalMediaScreenTransitionSpec.interpolateFn', () => {
  it('blends nvsX continuously', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    const mid = fn(ctx(0.5));
    expect(mid.nvsX).toBeCloseTo((fromState.nvsX + toState.nvsX) / 2);
  });

  it('blends nvsY continuously', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    const mid = fn(ctx(0.5));
    expect(mid.nvsY).toBeCloseTo((fromState.nvsY + toState.nvsY) / 2);
  });

  it('blends z continuously', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    const mid = fn(ctx(0.5));
    expect(mid.z).toBeCloseTo((fromState.z + toState.z) / 2);
  });

  it('blends nvsWidth continuously', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    const mid = fn(ctx(0.5));
    expect(mid.nvsWidth).toBeCloseTo((fromState.nvsWidth + toState.nvsWidth) / 2);
  });

  it('blends rotation continuously', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    const mid = fn(ctx(0.5));
    expect(mid.rotation[1]).toBeCloseTo(0.25);
  });

  it('blends scale continuously', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    const mid = fn(ctx(0.5));
    expect(mid.scale).toBeCloseTo((fromState.scale + toState.scale) / 2);
  });

  it('blends opacity continuously', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    const mid = fn(ctx(0.5));
    expect(mid.opacity).toBeCloseTo((fromState.opacity + toState.opacity) / 2, 1);
  });

  it('blends gloss continuously', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    const mid = fn(ctx(0.5));
    expect(mid.gloss).toBeCloseTo((fromState.gloss + toState.gloss) / 2);
  });

  it('blends selfIllumination continuously', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    const mid = fn(ctx(0.5));
    expect(mid.selfIllumination).toBeCloseTo((fromState.selfIllumination + toState.selfIllumination) / 2);
  });

  it('blends glowOpacity continuously', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    const mid = fn(ctx(0.5));
    expect(mid.glowOpacity).toBeCloseTo((fromState.glowOpacity + toState.glowOpacity) / 2);
  });

  it('steps src at midpoint: t<0.5 returns from, t>=0.5 returns to', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    expect(fn(ctx(0.4)).src).toBe(fromState.src);
    expect(fn(ctx(0.5)).src).toBe(toState.src);
  });

  it('steps streamId at midpoint: t<0.5 returns from, t>=0.5 returns to', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    expect(fn(ctx(0.4)).streamId).toBe(fromState.streamId);
    expect(fn(ctx(0.5)).streamId).toBe(toState.streamId);
  });

  it('steps sourceKind at midpoint', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    expect(fn(ctx(0.4)).sourceKind).toBe(fromState.sourceKind);
    expect(fn(ctx(0.5)).sourceKind).toBe(toState.sourceKind);
  });

  it('steps bezel at midpoint', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    expect(fn(ctx(0.4)).bezel).toBe(fromState.bezel);
    expect(fn(ctx(0.5)).bezel).toBe(toState.bezel);
  });

  it('steps glow at midpoint', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    expect(fn(ctx(0.4)).glow).toBe(fromState.glow);
    expect(fn(ctx(0.5)).glow).toBe(toState.glow);
  });

  it('steps loop at midpoint', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    expect(fn(ctx(0.4)).loop).toBe(fromState.loop);
    expect(fn(ctx(0.5)).loop).toBe(toState.loop);
  });

  it('steps muted at midpoint', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    expect(fn(ctx(0.4)).muted).toBe(fromState.muted);
    expect(fn(ctx(0.5)).muted).toBe(toState.muted);
  });

  it('steps autoPlay at midpoint', () => {
    const fn = functionalMediaScreenTransitionSpec.interpolateFn(fromState, toState);
    expect(fn(ctx(0.4)).autoPlay).toBe(fromState.autoPlay);
    expect(fn(ctx(0.5)).autoPlay).toBe(toState.autoPlay);
  });
});
