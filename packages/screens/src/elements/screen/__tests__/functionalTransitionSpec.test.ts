import { describe, it, expect } from 'vitest';
import { makeSimpleContext } from '@brewsite/core';
import { functionalScreenTransitionSpec } from '../compile';
import type { ScreenState } from '../types';

const makeState = (overrides: Partial<ScreenState> = {}): ScreenState => ({
  id: 'screen',
  src: 'https://example.com',
  nvsX: 0.5,
  nvsY: 0.5,
  z: 0,
  nvsWidth: 0.625,
  nvsHeight: undefined,
  rotation: [0, 0, 0],
  scale: 1,
  bezel: 'dark',
  bezelThickness: 0.3,
  opacity: 1,
  glow: true,
  glowColor: '#88ccff',
  glowScale: 1.4,
  glowOpacity: 0.35,
  enabled: true,
  ...overrides,
});

describe('functionalScreenTransitionSpec', () => {
  it('exitFn at t=1 returns opacity 0 (drives both bezel and iframe CSS)', () => {
    const state = makeState({ opacity: 0.9 });
    const result = functionalScreenTransitionSpec.exitFn(state)(makeSimpleContext(1));
    expect(result.opacity).toBeCloseTo(0);
  });

  it('enterFn at t=0 returns opacity 0', () => {
    const state = makeState({ opacity: 0.9 });
    const result = functionalScreenTransitionSpec.enterFn(state)(makeSimpleContext(0));
    expect(result.opacity).toBeCloseTo(0);
  });

  it('interpolateFn blends nvsX at t=0.5', () => {
    const from = makeState({ nvsX: 0.0 });
    const to = makeState({ nvsX: 1.0 });
    const result = functionalScreenTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.nvsX).toBeCloseTo(0.5);
  });

  it('interpolateFn blends nvsY at t=0.5', () => {
    const from = makeState({ nvsY: 0.0 });
    const to = makeState({ nvsY: 1.0 });
    const result = functionalScreenTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.nvsY).toBeCloseTo(0.5);
  });

  it('interpolateFn blends z at t=0.5', () => {
    const from = makeState({ z: 0 });
    const to = makeState({ z: 4 });
    const result = functionalScreenTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.z).toBeCloseTo(2);
  });

  it('interpolateFn blends opacity at t=0.5', () => {
    const from = makeState({ opacity: 0 });
    const to = makeState({ opacity: 1 });
    const result = functionalScreenTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.opacity).toBeCloseTo(0.5);
  });

  it('interpolateFn: src steps at t=0.5', () => {
    const from = makeState({ src: 'https://a.example.com' });
    const to = makeState({ src: 'https://b.example.com' });
    const result = functionalScreenTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.49));
    expect(result.src).toBe('https://a.example.com');
  });

  it('interpolateFn: nvsWidth steps at t=0.5 (no resize animation)', () => {
    const from = makeState({ nvsWidth: 0.4 });
    const to = makeState({ nvsWidth: 0.8 });
    const result = functionalScreenTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.51));
    expect(result.nvsWidth).toBe(0.8);
  });

  it('interpolateFn: nvsHeight steps at t=0.5 (no resize animation)', () => {
    const from = makeState({ nvsHeight: 0.3 });
    const to = makeState({ nvsHeight: 0.5 });
    const result = functionalScreenTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.51));
    expect(result.nvsHeight).toBe(0.5);
  });
});
