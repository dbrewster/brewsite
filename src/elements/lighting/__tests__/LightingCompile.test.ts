import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_LIGHTING,
  lightingTransitionSpec,
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
import { makeTransitionContext } from '../../__tests__/elementTestMocks';

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
    const result = lightingTransitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 0.5 }));
    expect(result.ambient.intensity).toBeGreaterThan(0);
    expect(result.ambient.intensity).toBeLessThan(2);
  });

  it('transitionSpec.exit fades intensity scale', () => {
    const from = makeLighting({ intensityScale: 1 });
    const result = lightingTransitionSpec.exit(from, makeTransitionContext({ tExit: 1 }));
    expect(result.intensityScale).toBeCloseTo(0);
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
