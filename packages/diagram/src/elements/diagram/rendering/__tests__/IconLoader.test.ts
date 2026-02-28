import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { sharedIconLoader } from '../IconLoader';

describe('IconLoader — failed load cache eviction', () => {
  let svgSpy: ReturnType<typeof vi.spyOn>;
  let texSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sharedIconLoader.disposeAll();
  });

  afterEach(() => {
    svgSpy?.mockRestore();
    texSpy?.mockRestore();
  });

  it('failed SVG load → cache entry deleted; subsequent call retries', async () => {
    let callCount = 0;
    svgSpy = vi.spyOn(SVGLoader.prototype, 'load').mockImplementation(
      // @ts-expect-error - signature compatibility for test
      (url: string, onLoad: (data: unknown) => void, _onProgress, onError: (err: Error) => void) => {
        callCount += 1;
        if (callCount === 1) {
          onError(new Error('fail'));
        } else {
          onLoad({ paths: [] });
        }
        return undefined as unknown as SVGLoader;
      },
    );

    await sharedIconLoader.load('icon.svg', 1, 1, 'flat', 0.1, 0.3, 0.7);
    await sharedIconLoader.load('icon.svg', 1, 1, 'flat', 0.1, 0.3, 0.7);
    expect(callCount).toBe(2);
  });

  it('successful load → underlying fetch cached; returns distinct node instances', async () => {
    texSpy = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(
      // @ts-expect-error - signature compatibility for test
      (url: string, onLoad: (tex: THREE.Texture) => void) => {
        onLoad(new THREE.Texture());
        return undefined as unknown as THREE.Texture;
      },
    );

    const o1 = await sharedIconLoader.load('icon.png', 1, 1, 'flat', 0.1, 0.3, 0.7);
    const o2 = await sharedIconLoader.load('icon.png', 1, 1, 'flat', 0.1, 0.3, 0.7);
    expect(o1).not.toBe(o2);
    expect(texSpy).toHaveBeenCalledTimes(1);
  });

  it('disposeAll() → cache cleared', async () => {
    texSpy = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(
      // @ts-expect-error - signature compatibility for test
      (url: string, onLoad: (tex: THREE.Texture) => void) => {
        onLoad(new THREE.Texture());
        return undefined as unknown as THREE.Texture;
      },
    );
    const p1 = sharedIconLoader.load('icon.png', 1, 1, 'flat', 0.1, 0.3, 0.7);
    await p1;
    sharedIconLoader.disposeAll();
    const p2 = sharedIconLoader.load('icon.png', 1, 1, 'flat', 0.1, 0.3, 0.7);
    expect(p2).not.toBe(p1);
  });
});
