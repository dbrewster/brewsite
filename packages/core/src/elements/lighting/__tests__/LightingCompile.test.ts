import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_LIGHTING,
  applyLightingEnter,
  applyLightingExit,
  applyLightingInterpolate,
  functionalLightingTransitionSpec,
} from '../compile';
import { makeSimpleContext } from '../../../compiler/transitions/transitionResolver';
import { applyLighting, setSceneLightEnabled, isSceneLightEnabled, clearSceneLightOverrides } from '../render';
import {
  Lighting,
  Ambient,
  Directional,
  Point,
  Spot,
  Panel,
  GlowPoint,
  LightStrand,
} from '../LightingWidget';
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
    expect(DEFAULT_LIGHTING.directionals[0]!.position).toHaveLength(3);
  });

  it('transitionSpec.interpolate blends ambient intensity', () => {
    const from = makeLighting({ ambient: { intensity: 2, color: '#ffffff' } });
    const to = makeLighting({ ambient: { intensity: 0, color: '#ffffff' } });
    const result = applyLightingInterpolate(from, to, 0.5);
    expect(result.ambient.intensity).toBeGreaterThan(0);
    expect(result.ambient.intensity).toBeLessThan(2);
  });

  it('functional transitionSpec.exit at t=0 preserves ambient intensity', () => {
    const from = makeLighting({ ambient: { intensity: 2, color: '#ffffff' } });
    const fn = functionalLightingTransitionSpec.exitFn(from);
    const result = fn(makeSimpleContext(0));
    expect(result.ambient.intensity).toBeCloseTo(2);
  });

  it('functional transitionSpec.exit at t=1 fades ambient to 0', () => {
    const from = makeLighting({ ambient: { intensity: 2, color: '#ffffff' } });
    const fn = functionalLightingTransitionSpec.exitFn(from);
    const result = fn(makeSimpleContext(1));
    expect(result.ambient.intensity).toBeCloseTo(0);
  });

  it('functional transitionSpec.enter at t=0 returns near-zero ambient intensity', () => {
    const to = makeLighting({ ambient: { intensity: 2, color: '#ffffff' } });
    const fn = functionalLightingTransitionSpec.enterFn(to);
    const result = fn(makeSimpleContext(0));
    expect(result.ambient.intensity).toBeCloseTo(0);
  });

  it('functional transitionSpec.enter at t=1 returns full ambient intensity', () => {
    const to = makeLighting({ ambient: { intensity: 2, color: '#ffffff' } });
    const fn = functionalLightingTransitionSpec.enterFn(to);
    const result = fn(makeSimpleContext(1));
    expect(result.ambient.intensity).toBeCloseTo(2);
  });

  it('functional transitionSpec.interpolate at t=0 returns from state', () => {
    const from = makeLighting({ ambient: { intensity: 2, color: '#ffffff' } });
    const to = makeLighting({ ambient: { intensity: 0, color: '#ffffff' } });
    const fn = functionalLightingTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0));
    expect(result.ambient.intensity).toBeCloseTo(2);
  });

  it('functional transitionSpec.interpolate at t=1 returns to state', () => {
    const from = makeLighting({ ambient: { intensity: 2, color: '#ffffff' } });
    const to = makeLighting({ ambient: { intensity: 0, color: '#ffffff' } });
    const fn = functionalLightingTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(1));
    expect(result.ambient.intensity).toBeCloseTo(0);
  });

  it('functional transitionSpec.interpolate at t=0.5 blends ambient intensity', () => {
    const from = makeLighting({ ambient: { intensity: 2, color: '#ffffff' } });
    const to = makeLighting({ ambient: { intensity: 0, color: '#ffffff' } });
    const fn = functionalLightingTransitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
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
      directionals: [{ intensity: 1, color: '#ff0000', position: [0, 0, 0] }],
    });
    const to = makeLighting({
      directionals: [{ intensity: 1, color: '#00ff00', position: [2, 2, 2] }],
    });
    const result = applyLightingInterpolate(from, to, 0.5);
    expect(result.directionals[0]!.color).toBe('#808000');
    expect(result.directionals[0]!.position).toEqual([1, 1, 1]);
  });

  it('transitionSpec.interpolate blends glowPoint', () => {
    const from = makeLighting({
      glowPoint: { intensity: 0.2, color: '#ff0000', position: [0, 1, 2], distance: 10, decay: 1 },
    });
    const to = makeLighting({
      glowPoint: { intensity: 1.2, color: '#00ff00', position: [2, 3, 4], distance: 30, decay: 2 },
    });
    const result = applyLightingInterpolate(from, to, 0.5);
    expect(result.glowPoint?.intensity).toBeCloseTo(0.7);
    expect(result.glowPoint?.position).toEqual([1, 2, 3]);
    expect(result.glowPoint?.color).toBe('#808000');
    expect(result.glowPoint?.distance).toBeCloseTo(20);
    expect(result.glowPoint?.decay).toBeCloseTo(1.5);
  });

  it('transitionSpec.interpolate blends light strands by id', () => {
    const from = makeLighting({
      lightStrands: [{
        id: 'strand',
        count: 3,
        intensity: 0.2,
        color: '#ff0000',
        position: [0, 1, 2],
        distance: 10,
        decay: 1,
        shape: {
          kind: 'wave',
          curve: {
            length: 8,
            yOffset: 1,
            z: 2,
            waveAmplitude: 0.5,
            waveFrequency: 1,
            depthAmplitude: 0.25,
            depthFrequency: 2,
            depthPhase: 0,
          },
        },
      }],
    });
    const to = makeLighting({
      lightStrands: [{
        id: 'strand',
        count: 5,
        intensity: 1.0,
        color: '#00ff00',
        position: [2, 3, 4],
        distance: 30,
        decay: 2,
        shape: {
          kind: 'wave',
          curve: {
            length: 12,
            yOffset: 3,
            z: 4,
            waveAmplitude: 1.5,
            waveFrequency: 2,
            depthAmplitude: 0.75,
            depthFrequency: 4,
            depthPhase: 1,
          },
        },
      }],
    });
    const result = applyLightingInterpolate(from, to, 0.5);
    expect(result.lightStrands?.[0]?.count).toBeCloseTo(4);
    expect(result.lightStrands?.[0]?.intensity).toBeCloseTo(0.6);
    expect(result.lightStrands?.[0]?.color).toBe('#808000');
    expect(result.lightStrands?.[0]?.position).toEqual([1, 2, 3]);
    if (result.lightStrands?.[0]?.shape.kind !== 'wave') {
      throw new Error('expected wave shape');
    }
    expect(result.lightStrands[0].shape.curve.length).toBeCloseTo(10);
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

  it('blends points when only one side exists', () => {
    const from = makeLighting({
      points: [{ intensity: 1, color: '#ff0000', position: [0, 1, 0] }],
    });
    const to = makeLighting({ points: [] });
    const exit = applyLightingExit(from, 0.5);
    expect(exit.points?.[0].intensity).toBeLessThan(1);

    const enter = applyLightingEnter(makeLighting({ points: [{ intensity: 2, color: '#00ff00', position: [0, 1, 0] }] }), 0.5);
    expect(enter.points?.[0].intensity).toBeGreaterThan(0);
  });

  it('blends points by id when order changes', () => {
    const from = makeLighting({
      points: [
        { id: 'a', intensity: 0, color: '#ff0000', position: [0, 0, 0] },
        { id: 'b', intensity: 2, color: '#00ff00', position: [10, 0, 0] },
      ],
    });
    const to = makeLighting({
      points: [
        { id: 'b', intensity: 0, color: '#0000ff', position: [20, 0, 0] },
        { id: 'a', intensity: 2, color: '#ffffff', position: [5, 0, 0] },
      ],
    });
    const result = applyLightingInterpolate(from, to, 0.5);
    const byId = new Map((result.points ?? []).map((p) => [p.id, p] as const));
    expect(byId.get('a')?.intensity).toBeCloseTo(1);
    expect(byId.get('a')?.position).toEqual([2.5, 0, 0]);
    expect(byId.get('b')?.intensity).toBeCloseTo(1);
    expect(byId.get('b')?.position).toEqual([15, 0, 0]);
  });

  it('blends spots when only one side exists', () => {
    const from = makeLighting({
      spots: [{
        intensity: 1,
        color: '#ff0000',
        position: [0, 1, 0],
        target: [0, 0, 0],
        angle: 0.4,
        penumbra: 0.1,
      }],
    });
    const exit = applyLightingExit(from, 0.5);
    expect(exit.spots?.[0].intensity).toBeLessThan(1);

    const enter = applyLightingEnter(makeLighting({
      spots: [{
        intensity: 2,
        color: '#00ff00',
        position: [0, 1, 0],
        target: [0, 0, 0],
        angle: 0.4,
        penumbra: 0.1,
      }],
    }), 0.5);
    expect(enter.spots?.[0].intensity).toBeGreaterThan(0);
  });

  it('blends spots by id when order changes', () => {
    const from = makeLighting({
      spots: [{
        id: 'key',
        intensity: 1,
        color: '#ff0000',
        position: [0, 1, 0],
        target: [0, 0, 0],
        angle: 0.4,
        penumbra: 0.1,
      }],
    });
    const to = makeLighting({
      spots: [{
        id: 'key',
        intensity: 3,
        color: '#00ff00',
        position: [4, 1, 0],
        target: [2, 0, 0],
        angle: 0.6,
        penumbra: 0.3,
      }],
    });
    const result = applyLightingInterpolate(from, to, 0.5);
    expect(result.spots?.[0]?.id).toBe('key');
    expect(result.spots?.[0]?.intensity).toBeCloseTo(2);
    expect(result.spots?.[0]?.position).toEqual([2, 1, 0]);
    expect(result.spots?.[0]?.target).toEqual([1, 0, 0]);
  });

  it('blends panels when only one side exists and matrix is missing', () => {
    const from = makeLighting({
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
    const exit = applyLightingExit(from, 0.5);
    expect(exit.panels?.[0].intensity).toBeLessThan(1);

    const enter = applyLightingEnter(makeLighting({
      panels: [{
        id: 'panel2',
        origin: [1, 0, 0],
        rows: 2,
        cols: 2,
        spacing: [2, 2, 2],
        intensity: 2,
        color: '#ffffff',
      }],
    }), 0.5);
    expect(enter.panels?.[0].intensity).toBeGreaterThan(0);
  });
  it('applyLighting populates scene and cleans up managed lights', () => {
    const scene = new THREE.Scene();
    const state: SceneLighting = makeLighting({
      ambient: { intensity: 1, color: '#ffffff' },
      directionals: [{ intensity: 1, color: '#ffffff', position: [1, 2, 3] }],
      glowPoint: { intensity: 1, color: '#ffaa33', position: [3, 4, 5], distance: 12, decay: 1.25 },
      lightStrands: [{
        id: 'strand',
        count: 3,
        intensity: 0.6,
        color: '#88bbff',
        position: [5, 6, 7],
        distance: 20,
        decay: 1,
        shape: {
          kind: 'wave',
          curve: {
            length: 10,
            yOffset: 0.5,
            z: 2,
            waveAmplitude: 1,
            waveFrequency: 1,
            depthAmplitude: 0.5,
            depthFrequency: 2,
            depthPhase: 0.3,
          },
        },
      }],
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

    const panelPointLight = scene.children.find((child) =>
      child instanceof THREE.PointLight && child.position.x === 0 && child.position.y === 0 && child.position.z === 0,
    ) as THREE.PointLight | undefined;
    expect(panelPointLight?.castShadow).toBe(false);

    const glowPointLight = scene.children.find((child) =>
      child instanceof THREE.PointLight && child.position.x === 3 && child.position.y === 4 && child.position.z === 5,
    ) as THREE.PointLight | undefined;
    expect(glowPointLight).toBeDefined();
    expect(glowPointLight?.castShadow).toBe(false);

    const pointLights = scene.children.filter((child) => child instanceof THREE.PointLight);
    expect(pointLights.length).toBe(6);
    const strandLight = scene.children.find((child) =>
      child instanceof THREE.PointLight
      && child.position.x >= 0
      && child.position.x <= 10
      && child.position.y >= 5
      && child.position.y <= 7.5
      && child.position.z >= 8.5
      && child.position.z <= 9.5,
    ) as THREE.PointLight | undefined;
    expect(strandLight).toBeDefined();
  });

  it('supports enabling/disabling lights by id at runtime', () => {
    const scene = new THREE.Scene();
    const state: SceneLighting = makeLighting({
      points: [{ id: 'key-fill', intensity: 1, color: '#ff0000', position: [1, 2, 3] }],
    });

    setSceneLightEnabled(scene, 'key-fill', false);
    expect(isSceneLightEnabled(scene, 'key-fill')).toBe(false);
    applyLighting(state, { scene });
    const point = scene.children.find((child) =>
      child instanceof THREE.PointLight
      && child.position.x === 1
      && child.position.y === 2
      && child.position.z === 3,
    ) as THREE.PointLight | undefined;
    expect(point?.intensity).toBeCloseTo(0, 6);

    setSceneLightEnabled(scene, 'key-fill', true);
    applyLighting(state, { scene });
    expect(point?.intensity).toBeCloseTo(1, 6);

    clearSceneLightOverrides(scene);
    expect(isSceneLightEnabled(scene, 'key-fill')).toBe(true);
  });

  describe('applyLightingExit — directionals array', () => {
    it('fades all directional lights to intensity 0', () => {
      const state: SceneLighting = {
        ...DEFAULT_LIGHTING,
        directionals: [
          { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
          { id: 'd-1', intensity: 0.5, color: '#ff0000', position: [-5, 5, 5] },
        ],
      };
      const result = applyLightingExit(state, 1.0);
      expect(result.directionals[0]!.intensity).toBe(0);
      expect(result.directionals[1]!.intensity).toBe(0);
    });

    it('preserves directional count and ids', () => {
      const state: SceneLighting = {
        ...DEFAULT_LIGHTING,
        directionals: [
          { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
          { id: 'd-1', intensity: 0.5, color: '#ff0000', position: [-5, 5, 5] },
        ],
      };
      const result = applyLightingExit(state, 0.5);
      expect(result.directionals).toHaveLength(2);
      expect(result.directionals[0]!.id).toBe('d-0');
      expect(result.directionals[1]!.id).toBe('d-1');
    });
  });

  describe('applyLightingEnter — directionals array', () => {
    it('fades in all directional lights from intensity 0', () => {
      const state: SceneLighting = {
        ...DEFAULT_LIGHTING,
        directionals: [
          { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
          { id: 'd-1', intensity: 0.5, color: '#ff0000', position: [-5, 5, 5] },
        ],
      };
      const result = applyLightingEnter(state, 1.0);
      expect(result.directionals[0]!.intensity).toBeCloseTo(1.0);
      expect(result.directionals[1]!.intensity).toBeCloseTo(0.5);
    });

    it('is at near-zero intensity at t=0', () => {
      const state: SceneLighting = {
        ...DEFAULT_LIGHTING,
        directionals: [
          { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
        ],
      };
      const result = applyLightingEnter(state, 0);
      expect(result.directionals[0]!.intensity).toBe(0);
    });
  });

  describe('applyLightingInterpolate — directionals array', () => {
    it('interpolates matched directionals by id', () => {
      const from: SceneLighting = {
        ...DEFAULT_LIGHTING,
        directionals: [
          { id: 'd-0', intensity: 0.0, color: '#000000', position: [0, 0, 0] },
        ],
      };
      const to: SceneLighting = {
        ...DEFAULT_LIGHTING,
        directionals: [
          { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
        ],
      };
      const result = applyLightingInterpolate(from, to, 0.5);
      expect(result.directionals[0]!.intensity).toBeCloseTo(0.5);
    });

    it('fades out a directional not in the target scene', () => {
      const from: SceneLighting = {
        ...DEFAULT_LIGHTING,
        directionals: [
          { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
          { id: 'd-extra', intensity: 0.8, color: '#ffff00', position: [5, 5, 5] },
        ],
      };
      const to: SceneLighting = {
        ...DEFAULT_LIGHTING,
        directionals: [
          { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
        ],
      };
      const result = applyLightingInterpolate(from, to, 1.0);
      const extra = result.directionals.find((d) => d.id === 'd-extra');
      expect(extra).toBeDefined();
      expect(extra!.intensity).toBe(0);
    });
  });

  it('Lighting DSL components render null and have displayName', () => {
    expect(Lighting.displayName).toBe('Lighting');
    expect(Ambient.displayName).toBe('Ambient');
    expect(Directional.displayName).toBe('Directional');
    expect(Point.displayName).toBe('Point');
    expect(GlowPoint.displayName).toBe('GlowPoint');
    expect(Spot.displayName).toBe('Spot');
    expect(LightStrand.displayName).toBe('LightStrand');
    expect(Panel.displayName).toBe('Panel');
    expect(Lighting({})).toBeNull();
    expect(Ambient({ intensity: 1, color: '#fff' })).toBeNull();
  });
});
