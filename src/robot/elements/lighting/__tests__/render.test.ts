import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted so that these class declarations are available when vi.mock is hoisted
// to the top of the file. Without this, class declarations are in the temporal dead zone
// at the point vi.mock runs.
const {
  StubAmbientLight,
  StubDirectionalLight,
  StubPointLight,
  StubSpotLight,
} = vi.hoisted(() => {
  class StubAmbientLight {
    __managedByLightingElement?: boolean;
    intensity: number;
    constructor(_color: unknown, intensity: number) { this.intensity = intensity; }
  }
  class StubDirectionalLight {
    __managedByLightingElement?: boolean;
    intensity: number;
    position = { set: vi.fn() };
    constructor(_color: unknown, intensity: number) { this.intensity = intensity; }
  }
  class StubPointLight {
    __managedByLightingElement?: boolean;
    intensity: number;
    distance = 0;
    decay = 2;
    position = { set: vi.fn() };
    visible = true;
    constructor(_color: unknown, intensity: number) { this.intensity = intensity; }
  }
  class StubSpotLight {
    __managedByLightingElement?: boolean;
    intensity: number;
    angle = 0;
    penumbra = 0;
    distance?: number;
    decay?: number;
    position = { set: vi.fn() };
    target = { position: { set: vi.fn() }, updateMatrixWorld: vi.fn() };
    constructor(_color: unknown, intensity: number) { this.intensity = intensity; }
  }
  return { StubAmbientLight, StubDirectionalLight, StubPointLight, StubSpotLight };
});

vi.mock('three', () => ({
  AmbientLight: StubAmbientLight,
  DirectionalLight: StubDirectionalLight,
  PointLight: StubPointLight,
  SpotLight: StubSpotLight,
  Color: vi.fn().mockImplementation((c: unknown) => ({ value: c })),
}));

import { applyLighting } from '../render';
import type { SceneLighting } from '../types';

const makeScene = () => {
  const objects: unknown[] = [];
  return {
    add: vi.fn((obj: unknown) => objects.push(obj)),
    remove: vi.fn((obj: unknown) => {
      const idx = objects.indexOf(obj);
      if (idx >= 0) objects.splice(idx, 1);
    }),
    traverse: vi.fn((fn: (obj: unknown) => void) => { objects.forEach(fn); }),
    _objects: objects,
  };
};

const baseLighting = (): SceneLighting => ({
  color: '#ffffff',
  intensityScale: 1,
  ambient: { color: '#ffffff', intensity: 0.8 },
  directional: { color: '#ffffff', intensity: 1.0, position: [10, 10, 5] },
  points: [],
  spots: [],
  panels: [],
});

describe('applyLighting', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('adds an AmbientLight to the scene', () => {
    const scene = makeScene();
    applyLighting(baseLighting(), { scene: scene as unknown as import('three').Scene });
    const hasAmbient = scene._objects.some((obj) => obj instanceof StubAmbientLight);
    expect(hasAmbient).toBe(true);
  });

  it('adds a DirectionalLight to the scene', () => {
    const scene = makeScene();
    applyLighting(baseLighting(), { scene: scene as unknown as import('three').Scene });
    const hasDirectional = scene._objects.some((obj) => obj instanceof StubDirectionalLight);
    expect(hasDirectional).toBe(true);
  });

  it('marks all added lights with __managedByLightingElement', () => {
    const scene = makeScene();
    applyLighting(baseLighting(), { scene: scene as unknown as import('three').Scene });
    const allManaged = scene._objects.every(
      (obj) => (obj as { __managedByLightingElement?: boolean }).__managedByLightingElement === true,
    );
    expect(allManaged).toBe(true);
  });

  it('removes old managed lights on subsequent call (idempotent cleanup)', () => {
    const scene = makeScene();
    const refs = { scene: scene as unknown as import('three').Scene };
    applyLighting(baseLighting(), refs);
    const firstCount = scene._objects.length;
    // Lights from the first call should be in _objects; traverse will find them
    applyLighting(baseLighting(), refs);
    expect(scene.remove).toHaveBeenCalledTimes(firstCount);
    // Count stays the same (replaced, not doubled)
    expect(scene._objects.length).toBe(firstCount);
  });

  it('scales ambient intensity by intensityScale', () => {
    const scene = makeScene();
    const state = { ...baseLighting(), intensityScale: 2 };
    applyLighting(state, { scene: scene as unknown as import('three').Scene });
    const ambient = scene._objects.find((obj) => obj instanceof StubAmbientLight) as InstanceType<typeof StubAmbientLight> | undefined;
    expect(ambient?.intensity).toBe(0.8 * 2);
  });

  it('scales directional intensity by intensityScale', () => {
    const scene = makeScene();
    const state = { ...baseLighting(), intensityScale: 0.5 };
    applyLighting(state, { scene: scene as unknown as import('three').Scene });
    const dir = scene._objects.find((obj) => obj instanceof StubDirectionalLight) as InstanceType<typeof StubDirectionalLight> | undefined;
    expect(dir?.intensity).toBe(1.0 * 0.5);
  });

  it('adds one PointLight per entry in the points array', () => {
    const scene = makeScene();
    const state: SceneLighting = {
      ...baseLighting(),
      points: [
        { color: '#ff0000', intensity: 1.0, position: [0, 5, 0] },
        { color: '#00ff00', intensity: 0.5, position: [1, 2, 3] },
      ],
    };
    applyLighting(state, { scene: scene as unknown as import('three').Scene });
    const pointLights = scene._objects.filter((obj) => obj instanceof StubPointLight);
    expect(pointLights.length).toBe(2);
  });
});
