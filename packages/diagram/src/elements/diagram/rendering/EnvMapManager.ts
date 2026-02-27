// Loads and caches HDR environment maps; applies to THREE.Scene.
import * as THREE from 'three';
import { HDRLoader } from './HDRLoader';

export class EnvMapManager {
  private readonly cache = new Map<string, THREE.Texture>();
  private readonly loader = new HDRLoader();
  private lastAppliedUrl: string | null | 'none' = null;

  apply(scene: THREE.Scene, url: string | 'none' | null, intensity: number): void {
    if (url === null) return;
    if (this.lastAppliedUrl === url) return;
    this.lastAppliedUrl = url;

    if (url === 'none') {
      scene.environment = null;
      return;
    }

    const cached = this.cache.get(url);
    if (cached) {
      cached.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = cached;
      (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = intensity;
      return;
    }

    this.loader.load(
      url,
      (tex: THREE.Texture) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        this.cache.set(url, tex);
        scene.environment = tex;
        (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = intensity;
      },
      undefined,
      undefined,
    );
  }

  disposeAll(): void {
    for (const tex of this.cache.values()) {
      tex.dispose();
    }
    this.cache.clear();
    this.lastAppliedUrl = null;
  }
}
