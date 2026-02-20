import {describe, expect, it} from 'vitest';
import {lightingTransitionSpec} from '../../../elements/lighting/compile';
import type {SceneLighting} from '../../../model/robotSceneTypes';
import {buildContext, expectNumberClose, expectVec3Close} from './transitionTestUtils';

const baseLighting = (overrides: Partial<SceneLighting> = {}): SceneLighting => ({
  ambient: { intensity: 1, color: '#ffffff' },
  directional: { intensity: 1, color: '#aaaaaa', position: [0, 1, 0] },
  points: [{ intensity: 0.5, color: '#ff0000', position: [1, 2, 3] }],
  spots: [{
    intensity: 0.8,
    color: '#00ff00',
    position: [2, 3, 4],
    target: [0, 1, 0],
    angle: 0.3,
    penumbra: 0.1,
    distance: 10,
    decay: 1.2,
  }],
  panels: [{
    id: 'panel-a',
    origin: [0, 0, 0],
    rows: 2,
    cols: 3,
    spacing: [1, 1, 1],
    intensity: 0.4,
    distance: 9,
    decay: 0.9,
    color: '#123456',
    matrix: [1, 0, 0, 1],
  }],
  intensityScale: 1,
  color: '#111111',
  ...overrides,
});

describe('lighting transitions', () => {
  it('blends all lighting fields across', () => {
    const context = buildContext({ tFull: 0.5, tExit: 0.5, tEnter: 0.5 });
    const from = baseLighting({
      ambient: { intensity: 0, color: '#000000' },
      directional: { intensity: 2, color: '#101010', position: [0, 0, 0] },
      points: [{ intensity: 1, color: '#ff0000', position: [0, 0, 0] }],
      spots: [{
        intensity: 1,
        color: '#00ff00',
        position: [0, 0, 0],
        target: [0, 0, 0],
        angle: 0.1,
        penumbra: 0.2,
        distance: 5,
        decay: 0.5,
      }],
      panels: [{
        id: 'panel-a',
        origin: [0, 0, 0],
        rows: 2,
        cols: 2,
        spacing: [0, 0, 0],
        intensity: 0.2,
        distance: 4,
        decay: 0.4,
        color: '#0000ff',
        matrix: [0, 0, 0, 0],
      }],
      intensityScale: 0.5,
      color: '#000000',
    });
    const to = baseLighting({
      ambient: { intensity: 2, color: '#ffffff' },
      directional: { intensity: 4, color: '#202020', position: [2, 2, 2] },
      points: [{ intensity: 3, color: '#00ffff', position: [2, 2, 2] }],
      spots: [{
        intensity: 3,
        color: '#ff00ff',
        position: [2, 2, 2],
        target: [1, 1, 1],
        angle: 0.5,
        penumbra: 0.6,
        distance: 9,
        decay: 0.9,
      }],
      panels: [{
        id: 'panel-a',
        origin: [2, 2, 2],
        rows: 4,
        cols: 4,
        spacing: [2, 2, 2],
        intensity: 1.0,
        distance: 8,
        decay: 1.0,
        color: '#ffffff',
        matrix: [2, 2, 2, 2],
      }],
      intensityScale: 1.5,
      color: '#ffffff',
    });
    const result = lightingTransitionSpec.interpolate(from, to, context);

    expectNumberClose(result.ambient.intensity, 1);
    expect(result.ambient.color).toBe('#808080');
    expectNumberClose(result.directional.intensity, 3);
    expect(result.directional.color).toBe('#181818');
    expectVec3Close(result.directional.position, [1, 1, 1]);

    expectNumberClose(result.points?.[0]?.intensity, 2);
    expect(result.points?.[0]?.color).toBe('#808080');
    expectVec3Close(result.points?.[0]?.position, [1, 1, 1]);

    expectNumberClose(result.spots?.[0]?.intensity, 2);
    expect(result.spots?.[0]?.color).toBe('#808080');
    expectVec3Close(result.spots?.[0]?.position, [1, 1, 1]);
    expectVec3Close(result.spots?.[0]?.target, [0.5, 0.5, 0.5]);
    expectNumberClose(result.spots?.[0]?.angle, 0.3);
    expectNumberClose(result.spots?.[0]?.penumbra, 0.4);
    expectNumberClose(result.spots?.[0]?.distance, 7);
    expectNumberClose(result.spots?.[0]?.decay, 0.7);

    expectNumberClose(result.panels?.[0]?.intensity, 0.6);
    expect(result.panels?.[0]?.color).toBe('#8080ff');
    expectVec3Close(result.panels?.[0]?.origin, [1, 1, 1]);
    expectNumberClose(result.panels?.[0]?.rows, 3);
    expectNumberClose(result.panels?.[0]?.cols, 3);
    expectVec3Close(result.panels?.[0]?.spacing, [1, 1, 1]);
    expect(result.panels?.[0]?.matrix).toEqual([1, 1, 1, 1]);
    expectNumberClose(result.intensityScale, 1.0);
    expect(result.color).toBe('#808080');
  });

  it('transitions lighting out', () => {
    const context = buildContext({ tExit: 0.5 });
    const from = baseLighting({
      ambient: { intensity: 2, color: '#ffffff' },
      directional: { intensity: 4, color: '#202020', position: [2, 2, 2] },
      intensityScale: 1.5,
    });
    const result = lightingTransitionSpec.exit(from, context);
    expectNumberClose(result.ambient.intensity, 1);
    expectNumberClose(result.directional.intensity, 2);
    expectNumberClose(result.intensityScale, 0.75);
    expectNumberClose(result.points?.[0]?.intensity, 0.25);
  });

  it('transitions lighting in', () => {
    const context = buildContext({ tEnter: 0.5 });
    const to = baseLighting({
      ambient: { intensity: 2, color: '#ffffff' },
      directional: { intensity: 4, color: '#202020', position: [2, 2, 2] },
      intensityScale: 1.5,
    });
    const result = lightingTransitionSpec.enter(to, context);
    expectNumberClose(result.ambient.intensity, 1);
    expectNumberClose(result.directional.intensity, 2);
    expectNumberClose(result.intensityScale, 0.75);
    expectNumberClose(result.points?.[0]?.intensity, 0.25);
  });

  it('handles panel id changes as out/in (no blend)', () => {
    const context = buildContext({ tFull: 0.5, tExit: 0.5, tEnter: 0.5 });
    const from = baseLighting({
      panels: [{
        id: 'panel-a',
        origin: [0, 0, 0],
        rows: 1,
        cols: 1,
        spacing: [1, 1, 1],
        intensity: 1,
        color: '#ff0000',
      }],
    });
    const to = baseLighting({
      panels: [{
        id: 'panel-b',
        origin: [0, 0, 0],
        rows: 1,
        cols: 1,
        spacing: [1, 1, 1],
        intensity: 1,
        color: '#00ff00',
      }],
    });
    const result = lightingTransitionSpec.interpolate(from, to, context);
    // Expect no blending across differing ids; both are treated as out/in.
    expect(result.panels?.[0]?.id).toBe('panel-a');
  });
});
