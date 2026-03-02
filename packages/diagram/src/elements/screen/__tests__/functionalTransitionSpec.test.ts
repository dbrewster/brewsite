import { describe, it, expect } from 'vitest';
import { makeSimpleContext } from '@brewsite/core';
import { functionalScreenTransitionSpec } from '../compile';
import type { ScreenState } from '../types';

const makeState = (overrides: Partial<ScreenState> = {}): ScreenState => ({
  id: 'screen',
  src: 'https://example.com',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  width: 12,
  height: 7.5,
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

  it('interpolateFn blends position at t=0.5', () => {
    const from = makeState({ position: [0, 0, 0] });
    const to = makeState({ position: [10, 0, 0] });
    const result = functionalScreenTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.position[0]).toBeCloseTo(5);
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

  it('interpolateFn: width and height step at t=0.5 (no resize animation)', () => {
    const from = makeState({ width: 10, height: 6 });
    const to = makeState({ width: 12, height: 7.5 });
    const result = functionalScreenTransitionSpec.interpolateFn(from, to)(0.51);
    expect(result.width).toBe(12);
    expect(result.height).toBe(7.5);
  });
});
