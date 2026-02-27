import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { HDRLoader } from '../HDRLoader';
import { EnvMapManager } from '../EnvMapManager';

describe('EnvMapManager', () => {
  let loadSpy: ReturnType<typeof vi.spyOn>;

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
  });

  it('apply() with same URL twice → loader called only once (cache hit)', () => {
    const mgr = new EnvMapManager();
    const scene = new THREE.Scene();
    mgr.apply(scene, 'test.hdr', 1);
    mgr.apply(scene, 'test.hdr', 1);
    expect(loadSpy).toHaveBeenCalledTimes(1);
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
});
