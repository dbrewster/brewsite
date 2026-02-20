import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFromEquirectangular = vi.fn(() => ({ texture: { dispose: vi.fn() } }));
const mockFromScene = vi.fn(() => ({ texture: { dispose: vi.fn() } }));
const mockPmremDispose = vi.fn();

vi.mock('three', () => ({
  EquirectangularReflectionMapping: 0,
  PMREMGenerator: vi.fn().mockImplementation(() => ({
    fromEquirectangular: mockFromEquirectangular,
    fromScene: mockFromScene,
    dispose: mockPmremDispose,
  })),
  TextureLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
  })),
}));

vi.mock('three/examples/jsm/environments/RoomEnvironment.js', () => ({
  RoomEnvironment: vi.fn().mockImplementation(() => ({})),
}));

import { applyEnvironment } from '../render';

// Each test uses a fresh renderer+scene pair so the WeakMap cache doesn't bleed.
const makeRefs = () => {
  const scene = { environment: null as unknown } as unknown as import('three').Scene;
  // A unique object per call so the WeakMap cache creates a new renderer each time.
  const renderer = {} as import('three').WebGLRenderer;
  return { scene, renderer };
};

describe('applyEnvironment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply return values after clearAllMocks (clearAllMocks resets mock return values)
    mockFromEquirectangular.mockReturnValue({ texture: { dispose: vi.fn() } });
    mockFromScene.mockReturnValue({ texture: { dispose: vi.fn() } });
  });

  it('leaves scene.environment as null when disabled (no prior texture set)', () => {
    const { scene, renderer } = makeRefs();
    applyEnvironment({ enabled: false, intensity: 1 }, { scene, renderer });
    expect((scene as unknown as { environment: unknown }).environment).toBeNull();
  });

  it('clears scene.environment when disabled after room preset was applied', () => {
    const { scene, renderer } = makeRefs();
    const refs = { scene, renderer };
    // First: enable with room preset — this sets scene.environment to presetTexture
    applyEnvironment({ enabled: true, preset: 'room', intensity: 1 }, refs);
    const envAfterEnable = (scene as unknown as { environment: unknown }).environment;
    expect(envAfterEnable).toBeDefined();
    // Second: disable — clear() should recognise this is our texture and null it
    applyEnvironment({ enabled: false, intensity: 1 }, refs);
    expect((scene as unknown as { environment: unknown }).environment).toBeNull();
  });

  it('leaves scene.environment as null when enabled but no url or preset', () => {
    const { scene, renderer } = makeRefs();
    applyEnvironment({ enabled: true, intensity: 1 }, { scene, renderer });
    expect((scene as unknown as { environment: unknown }).environment).toBeNull();
  });

  it('triggers a texture load request when enabled with a url', async () => {
    const { TextureLoader } = await import('three');
    const loadFn = vi.fn();
    (TextureLoader as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({ load: loadFn }));
    const { scene, renderer } = makeRefs();
    applyEnvironment({ enabled: true, url: '/assets/env.hdr', intensity: 1 }, { scene, renderer });
    expect(loadFn).toHaveBeenCalledWith(
      '/assets/env.hdr',
      expect.any(Function),
      undefined,
      expect.any(Function),
    );
  });

  it('applies room preset via PMREMGenerator.fromScene', () => {
    const { scene, renderer } = makeRefs();
    applyEnvironment({ enabled: true, preset: 'room', intensity: 1 }, { scene, renderer });
    expect(mockFromScene).toHaveBeenCalled();
    expect((scene as unknown as { environment: unknown }).environment).not.toBeNull();
  });

  it('reuses the same PMREMGenerator for repeated calls with the same renderer', async () => {
    const { PMREMGenerator } = await import('three');
    const refs = makeRefs();
    applyEnvironment({ enabled: false, intensity: 1 }, refs);
    applyEnvironment({ enabled: false, intensity: 1 }, refs);
    expect((PMREMGenerator as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});
