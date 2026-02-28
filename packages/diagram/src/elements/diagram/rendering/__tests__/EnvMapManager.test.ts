import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { HDRLoader } from '../HDRLoader';
import { EnvMapManager } from '../EnvMapManager';

describe('EnvMapManager', () => {
  let loadSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = (globalThis as { __BREWSITE_ENV__?: { DEV?: boolean } }).__BREWSITE_ENV__;
  const originalLocation = (globalThis as { location?: unknown }).location;
  const originalSessionStorage = (globalThis as { sessionStorage?: unknown }).sessionStorage;

  beforeEach(() => {
    loadSpy = vi.spyOn(HDRLoader.prototype, 'load').mockImplementation(
      // @ts-expect-error - signature is compatible enough for test
      (url: string, onLoad: (tex: THREE.Texture) => void) => {
        const tex = new THREE.Texture();
        tex.userData = { src: url };
        onLoad(tex);
        return undefined as unknown as THREE.Texture;
      },
    );
  });

  afterEach(() => {
    loadSpy.mockRestore();
    if (originalEnv === undefined) {
      delete (globalThis as { __BREWSITE_ENV__?: { DEV?: boolean } }).__BREWSITE_ENV__;
    } else {
      (globalThis as { __BREWSITE_ENV__?: { DEV?: boolean } }).__BREWSITE_ENV__ = originalEnv;
    }
    if (originalLocation === undefined) {
      delete (globalThis as { location?: unknown }).location;
    } else {
      (globalThis as { location?: unknown }).location = originalLocation;
    }
    if (originalSessionStorage === undefined) {
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    } else {
      (globalThis as { sessionStorage?: unknown }).sessionStorage = originalSessionStorage;
    }
  });

  it('apply() with same URL twice → loader called only once (cache hit)', () => {
    const mgr = new EnvMapManager();
    const scene = new THREE.Scene();
    mgr.apply(scene, 'test.hdr', 1);
    mgr.apply(scene, 'test.hdr', 1);
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('applies cached env map to a different scene with same URL', () => {
    const mgr = new EnvMapManager();
    const sceneA = new THREE.Scene();
    const sceneB = new THREE.Scene();
    mgr.apply(sceneA, 'test.hdr', 1);
    expect(sceneA.environment).toBeTruthy();
    mgr.apply(sceneB, 'test.hdr', 0.7);
    expect(sceneB.environment).toBe(sceneA.environment);
    expect((sceneB as THREE.Scene & { environmentIntensity?: number }).environmentIntensity).toBe(0.7);
  });

  it('apply() with url=\"none\" → scene.environment set to null', () => {
    const mgr = new EnvMapManager();
    const scene = new THREE.Scene();
    scene.environment = new THREE.Texture();
    mgr.apply(scene, 'none', 1);
    expect(scene.environment).toBeNull();
  });

  it('apply() with url=null → scene.environment left unchanged', () => {
    const mgr = new EnvMapManager();
    const scene = new THREE.Scene();
    const tex = new THREE.Texture();
    scene.environment = tex;
    mgr.apply(scene, null, 1);
    expect(scene.environment).toBe(tex);
  });

  it('disposeAll() → cache cleared; next apply() re-fetches', () => {
    const mgr = new EnvMapManager();
    const scene = new THREE.Scene();
    mgr.apply(scene, 'test.hdr', 1);
    mgr.disposeAll();
    mgr.apply(scene, 'test.hdr', 1);
    expect(loadSpy).toHaveBeenCalledTimes(2);
  });

  it('dev HDR load failure triggers a single page reload per URL', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const reload = vi.fn();
    const store = new Map<string, string>();
    (globalThis as { __BREWSITE_ENV__?: { DEV?: boolean } }).__BREWSITE_ENV__ = { DEV: true };
    (globalThis as { location?: { reload: () => void } }).location = { reload };
    (globalThis as { sessionStorage?: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } }).sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
    };

    loadSpy.mockImplementation(
      // @ts-expect-error - signature is compatible enough for test
      (_url: string, _onLoad: (tex: THREE.Texture) => void, _onProgress: unknown, onError: () => void) => {
        onError();
        return undefined as unknown as THREE.Texture;
      },
    );

    const mgr = new EnvMapManager();
    const scene = new THREE.Scene();
    mgr.apply(scene, 'bad.hdr', 1);
    mgr.apply(scene, 'bad.hdr', 1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('prod HDR load failure does not reload and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    (globalThis as { __BREWSITE_ENV__?: { DEV?: boolean } }).__BREWSITE_ENV__ = { DEV: false };

    loadSpy.mockImplementation(
      // @ts-expect-error - signature is compatible enough for test
      (_url: string, _onLoad: (tex: THREE.Texture) => void, _onProgress: unknown, onError: () => void) => {
        onError();
        return undefined as unknown as THREE.Texture;
      },
    );

    const mgr = new EnvMapManager();
    const scene = new THREE.Scene();
    mgr.apply(scene, 'bad.hdr', 1);
    expect(warn).toHaveBeenCalled();
  });
});
