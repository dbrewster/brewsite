// Loads and caches HDR environment maps; applies to THREE.Scene.
import * as THREE from 'three';
import { HDRLoader } from './HDRLoader';

export class EnvMapManager {
  private readonly cache = new Map<string, THREE.Texture>();
  private readonly pending = new Map<string, Array<{ scene: THREE.Scene; intensity: number }>>();
  private readonly loader = new HDRLoader();
  private readonly devCacheBustToken = Date.now();

  private isDevRuntime(): boolean {
    const injected = (globalThis as { __BREWSITE_ENV__?: { DEV?: boolean } }).__BREWSITE_ENV__;
    if (injected?.DEV !== undefined) return injected.DEV;
    return !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;
  }

  private reloadPageOnceForHdr(url: string): boolean {
    if (!this.isDevRuntime()) return false;
    const g = globalThis as {
      location?: { reload?: () => void };
      sessionStorage?: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };
    };
    if (!g.location?.reload || !g.sessionStorage) return false;
    const key = `brewsite:envmap-reload:${url}`;
    if (g.sessionStorage.getItem(key) === '1') return false;
    g.sessionStorage.setItem(key, '1');
    g.location.reload();
    return true;
  }

  private buildRequestUrl(url: string): string {
    if (!this.isDevRuntime()) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}__brewsite_hdr_bust=${this.devCacheBustToken}`;
  }

  apply(scene: THREE.Scene, url: string | 'none' | null, intensity: number): void {
    if (url === null) return;

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

    const pend = this.pending.get(url);
    if (pend) {
      pend.push({ scene, intensity });
      return;
    }

    this.pending.set(url, [{ scene, intensity }]);

    this.loader.load(
      this.buildRequestUrl(url),
      (tex: THREE.Texture) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        this.cache.set(url, tex);
        const waiting = this.pending.get(url) ?? [];
        this.pending.delete(url);
        waiting.forEach(({ scene: waitingScene, intensity: waitingIntensity }) => {
          waitingScene.environment = tex;
          (waitingScene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = waitingIntensity;
        });
      },
      undefined,
      () => {
        this.pending.delete(url);
        if (!this.reloadPageOnceForHdr(url)) {
          console.warn(`Diagram EnvMapManager: failed to load HDR env map "${url}".`);
        }
      },
    );
  }

  disposeAll(): void {
    for (const tex of this.cache.values()) {
      tex.dispose();
    }
    this.cache.clear();
    this.pending.clear();
  }
}
