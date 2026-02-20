import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { StubObject3D, StubMesh, StubPointLight } = vi.hoisted(() => {
  class StubObject3D {
    visible = true;
    position = { set: vi.fn() };
    rotation = { set: vi.fn() };
    scale = { set: vi.fn() };
    parent: StubObject3D | null = null;
    children: unknown[] = [];
    add = vi.fn((child: unknown) => {
      this.children.push(child);
      (child as StubObject3D).parent = this;
    });
    removeFromParent = vi.fn(() => {
      if (this.parent) {
        this.parent.children = this.parent.children.filter((c) => c !== this);
        this.parent = null;
      }
    });
  }

  class StubMesh extends StubObject3D {}

  class StubPointLight extends StubObject3D {
    color: unknown;
    intensity: number;
    distance: number;
    decay: number;
    name = '';
    constructor(_color: unknown, intensity: number, distance: number, decay: number) {
      super();
      this.intensity = intensity;
      this.distance = distance;
      this.decay = decay;
    }
  }

  return { StubObject3D, StubMesh, StubPointLight };
});

vi.mock('three', () => ({
  Object3D: StubObject3D,
  Mesh: StubMesh,
  PointLight: StubPointLight,
  TubeGeometry: vi.fn().mockImplementation(() => ({
    attributes: { position: { array: new Float32Array(9), needsUpdate: false } },
    setAttribute: vi.fn(),
    computeVertexNormals: vi.fn(),
    dispose: vi.fn(),
  })),
  BufferAttribute: vi.fn().mockImplementation((arr: Float32Array, itemSize: number) => ({
    array: arr,
    itemSize,
  })),
  MeshPhysicalMaterial: vi.fn().mockImplementation(() => ({
    opacity: 1,
    dispose: vi.fn(),
  })),
  Color: vi.fn().mockImplementation(() => ({
    r: 1, g: 1, b: 1,
    setHSL: vi.fn().mockReturnThis(),
  })),
  NormalBlending: 0,
}));

vi.mock('../../../../components/logoParticleOptimizedViewer/ribbonUtils', () => ({
  buildRibbonStrands: vi.fn().mockReturnValue([
    {
      curve: {},
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
        { x: 2, y: 2, z: 2 },
      ],
    },
  ]),
}));

import { applyRibbon, disposeRibbon } from '../render';

const baseConfig = () => ({
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
  strandCount: 1,
  spacing: 0.5,
  radius: 0.1,
  radiusTaper: 0.8,
  segments: 20,
  twistFrequency: 2,
  twistPhase: 0,
  opacity: 0.9,
  glowLightsEnabled: false,
  glowLightCount: 0,
  glowLightColor: '#ffffff',
  glowLightIntensity: 1,
  glowLightDistance: 10,
  glowLightDecay: 2,
  curve: {
    width: 5,
    yOffset: 0,
    z: -3,
    waveAmplitude: 0.5,
    waveFrequency: 1,
    depthAmplitude: 0,
    depthFrequency: 1,
    depthPhase: 0,
  },
});

type StubObject3DInstance = InstanceType<typeof StubObject3D>;

const makeScene = () => {
  const rootGroup = new StubObject3D();
  return {
    add: vi.fn((obj: StubObject3DInstance) => { rootGroup.add(obj); }),
    remove: vi.fn(),
    _rootGroup: rootGroup,
  };
};

describe('applyRibbon', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  afterEach(() => {
    // Reset the module-level singleton so each test starts fresh
    disposeRibbon();
  });

  it('does not add objects to scene when disabled', () => {
    const scene = makeScene();
    applyRibbon({ enabled: false }, { scene: scene as unknown as import('three').Scene });
    expect(scene.add).not.toHaveBeenCalled();
  });

  it('adds the ribbon group to the scene when enabled with config', () => {
    const scene = makeScene();
    applyRibbon({ enabled: true, config: baseConfig() }, { scene: scene as unknown as import('three').Scene });
    expect(scene.add).toHaveBeenCalledTimes(1);
  });

  it('hides the ribbon group when disabled after being enabled', () => {
    const scene = makeScene();
    const refs = { scene: scene as unknown as import('three').Scene };
    applyRibbon({ enabled: true, config: baseConfig() }, refs);
    const addedGroup = (scene.add as ReturnType<typeof vi.fn>).mock.calls[0][0] as StubObject3DInstance;
    applyRibbon({ enabled: false }, refs);
    expect(addedGroup.visible).toBe(false);
  });

  it('rebuilds geometry when structure key changes (e.g. strandCount changes)', async () => {
    const { TubeGeometry } = await import('three');
    const scene = makeScene();
    const refs = { scene: scene as unknown as import('three').Scene };
    applyRibbon({ enabled: true, config: baseConfig() }, refs);
    applyRibbon({ enabled: true, config: { ...baseConfig(), radius: 0.5 } }, refs);
    // Each distinct structure key triggers one geometry build per strand
    expect((TubeGeometry as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not rebuild geometry when structure key is unchanged', async () => {
    const { TubeGeometry } = await import('three');
    const scene = makeScene();
    const refs = { scene: scene as unknown as import('three').Scene };
    const config = baseConfig();
    applyRibbon({ enabled: true, config }, refs);
    const buildCount = (TubeGeometry as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    applyRibbon({ enabled: true, config }, refs);
    expect((TubeGeometry as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(buildCount);
  });

  it('does not recreate materials when only opacity changes', async () => {
    const { MeshPhysicalMaterial } = await import('three');
    const scene = makeScene();
    const refs = { scene: scene as unknown as import('three').Scene };
    applyRibbon({ enabled: true, config: baseConfig() }, refs);
    const buildCount = (MeshPhysicalMaterial as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    // Same structure, different opacity → material key change but no full geometry rebuild
    applyRibbon({ enabled: true, config: { ...baseConfig(), opacity: 0.5 } }, refs);
    expect((MeshPhysicalMaterial as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(buildCount);
  });

  it('adds glow lights inside the ribbon group when glowLightsEnabled is true', () => {
    const scene = makeScene();
    const config = { ...baseConfig(), glowLightsEnabled: true, glowLightCount: 2 };
    applyRibbon({ enabled: true, config }, { scene: scene as unknown as import('three').Scene });
    const addedGroup = (scene.add as ReturnType<typeof vi.fn>).mock.calls[0][0] as StubObject3DInstance;
    const lights = addedGroup.children.filter((c: unknown) => c instanceof StubPointLight);
    expect(lights.length).toBeGreaterThan(0);
  });
});
