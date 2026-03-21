import { describe, it, expect } from 'vitest';
import { makeSimpleContext } from '@brewsite/core';
import { functionalImagePanelTransitionSpec } from '../compile';
import type { ImagePanelState } from '../types';

const makeState = (overrides: Partial<ImagePanelState> = {}): ImagePanelState => ({
  id: 'panel',
  src: '/a.png',
  nvsX: 0.5,
  nvsY: 0.5,
  z: 0,
  nvsWidth: 0.6,
  nvsHeight: undefined,
  rotation: [0, 0, 0],
  scale: 1,
  bezel: 'dark',
  bezelThickness: 0.3,
  opacity: 1,
  gloss: 0.5,
  glossRoughness: 0.05,
  selfIllumination: 0.15,
  glow: true,
  glowColor: '#88ccff',
  glowScale: 1.4,
  glowOpacity: 0.35,
  enabled: true,
  uniformSizing: false,
  ...overrides,
});

describe('functionalImagePanelTransitionSpec', () => {
  it('exitFn at t=0 returns full opacity', () => {
    const state = makeState({ opacity: 0.8 });
    const result = functionalImagePanelTransitionSpec.exitFn(state)(makeSimpleContext(0));
    expect(result.opacity).toBeCloseTo(0.8);
  });

  it('exitFn at t=1 returns opacity 0', () => {
    const state = makeState({ opacity: 0.8 });
    const result = functionalImagePanelTransitionSpec.exitFn(state)(makeSimpleContext(1));
    expect(result.opacity).toBeCloseTo(0);
  });

  it('enterFn at t=0 returns opacity 0', () => {
    const state = makeState({ opacity: 0.8 });
    const result = functionalImagePanelTransitionSpec.enterFn(state)(makeSimpleContext(0));
    expect(result.opacity).toBeCloseTo(0);
  });

  it('enterFn at t=1 returns full opacity', () => {
    const state = makeState({ opacity: 0.8 });
    const result = functionalImagePanelTransitionSpec.enterFn(state)(makeSimpleContext(1));
    expect(result.opacity).toBeCloseTo(0.8);
  });

  it('interpolateFn blends nvsX at t=0.5', () => {
    const from = makeState({ nvsX: 0.0 });
    const to = makeState({ nvsX: 1.0 });
    const result = functionalImagePanelTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.nvsX).toBeCloseTo(0.5);
  });

  it('interpolateFn blends nvsY at t=0.5', () => {
    const from = makeState({ nvsY: 0.0 });
    const to = makeState({ nvsY: 1.0 });
    const result = functionalImagePanelTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.nvsY).toBeCloseTo(0.5);
  });

  it('interpolateFn blends z at t=0.5', () => {
    const from = makeState({ z: 0 });
    const to = makeState({ z: 4 });
    const result = functionalImagePanelTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.z).toBeCloseTo(2);
  });

  it('interpolateFn blends nvsWidth at t=0.5', () => {
    const from = makeState({ nvsWidth: 0.2 });
    const to = makeState({ nvsWidth: 0.8 });
    const result = functionalImagePanelTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.nvsWidth).toBeCloseTo(0.5);
  });

  it('interpolateFn blends rotation at t=0.5', () => {
    const from = makeState({ rotation: [0, 0, 0] });
    const to = makeState({ rotation: [0, 1, 0] });
    const result = functionalImagePanelTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.rotation[1]).toBeCloseTo(0.5);
  });

  it('interpolateFn blends opacity at t=0.5', () => {
    const from = makeState({ opacity: 0 });
    const to = makeState({ opacity: 1 });
    const result = functionalImagePanelTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.opacity).toBeCloseTo(0.5);
  });

  it('interpolateFn: src steps at t=0.5 (not blended)', () => {
    const from = makeState({ src: '/a.png' });
    const to = makeState({ src: '/b.png' });
    const result = functionalImagePanelTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.49));
    expect(result.src).toBe('/a.png');
  });

  it('interpolateFn: bezel steps at t=0.5 (not blended)', () => {
    const from = makeState({ bezel: 'dark' });
    const to = makeState({ bezel: 'chrome' });
    const result = functionalImagePanelTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.51));
    expect(result.bezel).toBe('chrome');
  });
});
