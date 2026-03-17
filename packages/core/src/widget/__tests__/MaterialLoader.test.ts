// MaterialLoader — cache behavior, path resolution, dispose, and error handling.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MaterialLoader } from '../MaterialLoader';
import type { MaterialPreset } from '../materialTypes';
import type { WebGLRenderer, Texture } from 'three';

// ─── KTX2Loader mock at module boundary ──────────────────────────────────────

let loadAsyncMock: ReturnType<typeof vi.fn>;
let setTranscoderPathMock: ReturnType<typeof vi.fn>;
let detectSupportMock: ReturnType<typeof vi.fn>;
let ktx2DisposeMock: ReturnType<typeof vi.fn>;

vi.mock('three/examples/jsm/loaders/KTX2Loader.js', () => {
  return {
    KTX2Loader: class MockKTX2Loader {
      setTranscoderPath = setTranscoderPathMock;
      detectSupport = detectSupportMock;
      dispose = ktx2DisposeMock;
      loadAsync = loadAsyncMock;
    },
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fakeRenderer = {} as WebGLRenderer;
const fakeRenderer2 = {} as WebGLRenderer;

const makeTexture = (id: string): Texture => ({
  dispose: vi.fn(),
  wrapS: 0,
  wrapT: 0,
  minFilter: 0,
  magFilter: 0,
  colorSpace: '',
  _id: id,
} as unknown as Texture);

const onyxPreset: MaterialPreset = {
  maps: {
    color: 'presets/onyx/color.ktx2',
    normal: 'presets/onyx/normal.ktx2',
    roughness: 'presets/onyx/roughness.ktx2',
    displacement: 'presets/onyx/displacement.ktx2',
  },
  defaults: { metalness: 0.05, roughness: 0.25 },
};

const steelPreset: MaterialPreset = {
  maps: {
    color: 'presets/steel/color.ktx2',
    normal: 'presets/steel/normal.ktx2',
    roughness: 'presets/steel/roughness.ktx2',
  },
  defaults: { metalness: 0.95, roughness: 0.15 },
};

describe('MaterialLoader', () => {
  let loader: MaterialLoader;

  beforeEach(() => {
    loadAsyncMock = vi.fn((url: string) => {
      const tex = makeTexture(url);
      return Promise.resolve(tex);
    });
    setTranscoderPathMock = vi.fn();
    detectSupportMock = vi.fn();
    ktx2DisposeMock = vi.fn();
    loader = new MaterialLoader();
  });

  afterEach(() => {
    loader.dispose();
  });

  describe('initialization', () => {
    it('initializes KTX2Loader with default transcoder path', () => {
      loader.initialize(fakeRenderer);
      expect(setTranscoderPathMock).toHaveBeenCalledWith('/assets/materials/basis/');
      expect(detectSupportMock).toHaveBeenCalledWith(fakeRenderer);
      expect(loader.isInitialized).toBe(true);
    });

    it('initializes with custom transcoder path', () => {
      loader.initialize(fakeRenderer, '/custom/path/');
      expect(setTranscoderPathMock).toHaveBeenCalledWith('/custom/path/');
    });

    it('does not re-initialize for same renderer', () => {
      loader.initialize(fakeRenderer);
      loader.initialize(fakeRenderer);
      expect(setTranscoderPathMock).toHaveBeenCalledTimes(1);
    });

    it('reports not initialized before initialize() call', () => {
      expect(loader.isInitialized).toBe(false);
    });
  });

  describe('loadPreset', () => {
    it('loads all texture maps for a preset with displacement', async () => {
      loader.initialize(fakeRenderer);
      const result = await loader.loadPreset(onyxPreset, '/assets/materials');
      expect(result).not.toBeNull();
      expect(loadAsyncMock).toHaveBeenCalledTimes(4);
      expect(loadAsyncMock).toHaveBeenCalledWith('/assets/materials/presets/onyx/color.ktx2');
      expect(loadAsyncMock).toHaveBeenCalledWith('/assets/materials/presets/onyx/normal.ktx2');
      expect(loadAsyncMock).toHaveBeenCalledWith('/assets/materials/presets/onyx/roughness.ktx2');
      expect(loadAsyncMock).toHaveBeenCalledWith('/assets/materials/presets/onyx/displacement.ktx2');
      expect(result!.textures.color).toBeDefined();
      expect(result!.textures.normal).toBeDefined();
      expect(result!.textures.roughness).toBeDefined();
      expect(result!.textures.displacement).toBeDefined();
      expect(result!.defaults).toEqual({ metalness: 0.05, roughness: 0.25 });
    });

    it('loads preset without optional maps', async () => {
      loader.initialize(fakeRenderer);
      const result = await loader.loadPreset(steelPreset, '/assets/materials');
      expect(result).not.toBeNull();
      expect(loadAsyncMock).toHaveBeenCalledTimes(3);
      expect(result!.textures.displacement).toBeUndefined();
      expect(result!.textures.metalness).toBeUndefined();
    });

    it('returns cached result on second load of same preset', async () => {
      loader.initialize(fakeRenderer);
      const first = await loader.loadPreset(onyxPreset, '/assets/materials');
      loadAsyncMock.mockClear();
      const second = await loader.loadPreset(onyxPreset, '/assets/materials');
      expect(loadAsyncMock).not.toHaveBeenCalled();
      expect(second).toBe(first);
    });

    it('deduplicates concurrent loads of same preset', async () => {
      loader.initialize(fakeRenderer);
      const p1 = loader.loadPreset(onyxPreset, '/assets/materials');
      const p2 = loader.loadPreset(onyxPreset, '/assets/materials');
      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(r2);
      // Only 4 texture loads (not 8).
      expect(loadAsyncMock).toHaveBeenCalledTimes(4);
    });

    it('loads different presets independently', async () => {
      loader.initialize(fakeRenderer);
      const onyx = await loader.loadPreset(onyxPreset, '/assets/materials');
      const steel = await loader.loadPreset(steelPreset, '/assets/materials');
      expect(onyx).not.toBe(steel);
      expect(onyx!.defaults.metalness).toBe(0.05);
      expect(steel!.defaults.metalness).toBe(0.95);
    });
  });

  describe('path resolution', () => {
    it('joins basePath and relative path correctly', async () => {
      loader.initialize(fakeRenderer);
      await loader.loadPreset(steelPreset, '/assets/materials');
      expect(loadAsyncMock).toHaveBeenCalledWith('/assets/materials/presets/steel/color.ktx2');
    });

    it('handles basePath with trailing slash', async () => {
      loader.initialize(fakeRenderer);
      await loader.loadPreset(steelPreset, '/assets/materials/');
      expect(loadAsyncMock).toHaveBeenCalledWith('/assets/materials/presets/steel/color.ktx2');
    });
  });

  describe('getLoadedPresetByKey', () => {
    it('returns null before loading', () => {
      loader.initialize(fakeRenderer);
      const result = loader.getLoadedPresetByKey(onyxPreset, '/assets/materials');
      expect(result).toBeNull();
    });

    it('returns preset after loading', async () => {
      loader.initialize(fakeRenderer);
      const loaded = await loader.loadPreset(onyxPreset, '/assets/materials');
      const cached = loader.getLoadedPresetByKey(onyxPreset, '/assets/materials');
      expect(cached).toBe(loaded);
    });
  });

  describe('dispose', () => {
    it('disposes all cached textures', async () => {
      loader.initialize(fakeRenderer);
      await loader.loadPreset(onyxPreset, '/assets/materials');

      loader.dispose();

      // Verify the texture cache was cleared — getLoadedPresetByKey returns null.
      expect(loader.getLoadedPresetByKey(onyxPreset, '/assets/materials')).toBeNull();
      expect(loader.isInitialized).toBe(false);
    });

    it('disposes KTX2Loader', () => {
      loader.initialize(fakeRenderer);
      loader.dispose();
      expect(ktx2DisposeMock).toHaveBeenCalled();
    });
  });

  describe('disposeForRenderer', () => {
    it('disposes loader for specific renderer', () => {
      loader.initialize(fakeRenderer);
      loader.disposeForRenderer(fakeRenderer);
      expect(ktx2DisposeMock).toHaveBeenCalled();
    });

    it('does nothing for unknown renderer', () => {
      loader.initialize(fakeRenderer);
      ktx2DisposeMock.mockClear();
      loader.disposeForRenderer(fakeRenderer2);
      expect(ktx2DisposeMock).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('returns null and warns once when called before initialize', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result1 = await loader.loadPreset(onyxPreset, '/assets/materials');
      const result2 = await loader.loadPreset(onyxPreset, '/assets/materials');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
      // Only one warning, not two.
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/Not initialized/);
      warnSpy.mockRestore();
    });

    it('returns null and caches failure when texture load fails', async () => {
      loader.initialize(fakeRenderer);
      loadAsyncMock.mockRejectedValue(new Error('Missing KTX 2.0 identifier'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await loader.loadPreset(onyxPreset, '/assets/materials');
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/Failed to load material preset/);

      // Second call returns null immediately without re-requesting.
      loadAsyncMock.mockClear();
      const result2 = await loader.loadPreset(onyxPreset, '/assets/materials');
      expect(result2).toBeNull();
      expect(loadAsyncMock).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('reports failed preset via isPresetFailed', async () => {
      loader.initialize(fakeRenderer);
      loadAsyncMock.mockRejectedValue(new Error('404'));

      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(loader.isPresetFailed(onyxPreset, '/assets/materials')).toBe(false);
      await loader.loadPreset(onyxPreset, '/assets/materials');
      expect(loader.isPresetFailed(onyxPreset, '/assets/materials')).toBe(true);
      // A different preset is not failed.
      expect(loader.isPresetFailed(steelPreset, '/assets/materials')).toBe(false);
      vi.restoreAllMocks();
    });

    it('does not retry individual texture URLs that have failed', async () => {
      loader.initialize(fakeRenderer);

      // First two textures succeed, third (roughness) fails.
      let callCount = 0;
      loadAsyncMock.mockImplementation((url: string) => {
        callCount++;
        if (url.includes('roughness')) return Promise.reject(new Error('network error'));
        return Promise.resolve(makeTexture(url));
      });

      vi.spyOn(console, 'warn').mockImplementation(() => {});
      await loader.loadPreset(onyxPreset, '/assets/materials');
      const firstCallCount = callCount;

      // Second attempt should not re-request the failed URL.
      // (The preset itself is cached as failed, so no texture loads at all.)
      await loader.loadPreset(onyxPreset, '/assets/materials');
      expect(callCount).toBe(firstCallCount);

      vi.restoreAllMocks();
    });
  });

  describe('texture properties', () => {
    it('sets SRGBColorSpace on color map', async () => {
      loader.initialize(fakeRenderer);
      const result = await loader.loadPreset(steelPreset, '/assets/materials');
      expect(result!.textures.color.colorSpace).toBe('srgb');
    });

    it('sets LinearSRGBColorSpace on normal map', async () => {
      loader.initialize(fakeRenderer);
      const result = await loader.loadPreset(steelPreset, '/assets/materials');
      expect(result!.textures.normal.colorSpace).toBe('srgb-linear');
    });
  });
});
