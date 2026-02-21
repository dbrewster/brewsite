import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_LIGHTING,
  applyLightingEnter,
  applyLightingExit,
  applyLightingInterpolate,
} from '../compile';
import { applyLighting } from '../render';
import {
  Lighting,
  Ambient,
  Directional,
  Point,
  Spot,
  Panel,
} from '../dsl';
import type { SceneLighting } from '../types';

const makeLighting = (overrides: Partial<SceneLighting> = {}): SceneLighting => ({
  ...DEFAULT_LIGHTING,
  points: [],
  spots: [],
  panels: [],
  ...overrides,
});

describe('lighting compile + render', () => {
  it('defaults include ambient and directional', () => {
    expect(DEFAULT_LIGHTING.ambient.intensity).toBeGreaterThan(0);
    expect(DEFAULT_LIGHTING.directional.position).toHaveLength(3);
  });

  it('transitionSpec.interpolate blends ambient intensity', () => {
    const from = makeLighting({ ambient: { intensity: 2, color: '#ffffff' } });
    const to = makeLighting({ ambient: { intensity: 0, color: '#ffffff' } });
    const result = applyLightingInterpolate(from, to, 0.5);
    expect(result.ambient.intensity).toBeGreaterThan(0);
    expect(result.ambient.intensity).toBeLessThan(2);
  });

  it('transitionSpec.exit fades intensity scale', () => {
    const from = makeLighting({ intensityScale: 1 });
    const result = applyLightingExit(from, 1);
    expect(result.intensityScale).toBeCloseTo(0);
  });

  it('transitionSpec.enter fades points and spots in', () => {
    const to = makeLighting({
      points: [{ intensity: 1, color: '#ff0000', position: [0, 1, 0] }],
      spots: [{
        intensity: 2,
        color: '#00ff00',
        position: [0, 2, 0],
        target: [0, 0, 0],
        angle: 0.4,
        penumbra: 0.1,
      }],
    });
    const result = applyLightingEnter(to, 0.5);
    expect(result.points?.[0].intensity).toBeGreaterThan(0);
    expect(result.points?.[0].intensity).toBeLessThan(1);
    expect(result.spots?.[0].intensity).toBeGreaterThan(0);
    expect(result.spots?.[0].intensity).toBeLessThan(2);
  });

  it('transitionSpec.exit fades arrays out', () => {
    const from = makeLighting({
      points: [{ intensity: 1, color: '#ff0000', position: [0, 1, 0] }],
      panels: [{
        id: 'panel',
        origin: [0, 0, 0],
        rows: 1,
        cols: 1,
        spacing: [1, 1, 1],
        intensity: 1,
        color: '#ffffff',
      }],
    });
    const result = applyLightingExit(from, 1);
    expect(result.points?.[0].intensity).toBeCloseTo(0);
    expect(result.panels?.[0].intensity).toBeCloseTo(0);
  });

  it('transitionSpec.interpolate blends directional color and position', () => {
    const from = makeLighting({
      directional: { intensity: 1, color: '#ff0000', position: [0, 0, 0] },
    });
    const to = makeLighting({
      directional: { intensity: 1, color: '#00ff00', position: [2, 2, 2] },
    });
    const result = applyLightingInterpolate(from, to, 0.5);
    expect(result.directional.color).toBe('#808000');
    expect(result.directional.position).toEqual([1, 1, 1]);
  });

  it('transitionSpec.interpolate blends panels and panel matrices', () => {
    const from = makeLighting({
      panels: [{
        id: 'panel',
        origin: [0, 0, 0],
        rows: 1,
        cols: 1,
        spacing: [1, 1, 1],
        intensity: 1,
        color: '#ffffff',
        matrix: [0xff0000ff],
      }],
    });
    const to = makeLighting({
      panels: [{
        id: 'panel',
        origin: [1, 0, 0],
        rows: 1,
        cols: 1,
        spacing: [2, 2, 2],
        intensity: 0,
        color: '#000000',
        matrix: [0x00ff00ff, 0xffffffff],
      }],
    });
    const result = applyLightingInterpolate(from, to, 0.5);
    const panel = result.panels?.[0];
    expect(panel?.origin).toEqual([0.5, 0, 0]);
    expect(panel?.spacing).toEqual([1.5, 1.5, 1.5]);
    expect(panel?.matrix?.length).toBe(2);
  });
  it('applyLighting populates scene and cleans up managed lights', () => {
    const scene = new THREE.Scene();
    const state: SceneLighting = makeLighting({
      ambient: { intensity: 1, color: '#ffffff' },
      directional: { intensity: 1, color: '#ffffff', position: [1, 2, 3] },
      points: [{ intensity: 1, color: '#ff0000', position: [0, 1, 0] }],
      spots: [{
        intensity: 1,
        color: '#00ff00',
        position: [0, 2, 0],
        target: [0, 0, 0],
        angle: 0.5,
        penumbra: 0.2,
      }],
      panels: [{
        id: 'panel',
        origin: [0, 0, 0],
        rows: 1,
        cols: 1,
        spacing: [1, 1, 1],
        intensity: 1,
        color: '#ffffff',
      }],
    });

    applyLighting(state, { scene });
    const firstCount = scene.children.length;
    expect(firstCount).toBeGreaterThan(0);

    applyLighting(state, { scene });
    const secondCount = scene.children.length;
    expect(secondCount).toBe(firstCount);
  });

  it('Lighting DSL components render null and have displayName', () => {
    expect(Lighting.displayName).toBe('Lighting');
    expect(Ambient.displayName).toBe('Ambient');
    expect(Directional.displayName).toBe('Directional');
    expect(Point.displayName).toBe('Point');
    expect(Spot.displayName).toBe('Spot');
    expect(Panel.displayName).toBe('Panel');
    expect(Lighting({})).toBeNull();
    expect(Ambient({ intensity: 1, color: '#fff' })).toBeNull();
  });
});
