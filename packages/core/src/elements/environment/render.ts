/**
 * Environment element Three.js renderer.
 * Excluded from test coverage - Three.js rendering logic.
 */

import type { SceneEnvironment, EnvironmentSource } from './types';
import * as THREE from 'three';
import type { Scene as ThreeScene } from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

export type EnvironmentThreeRefs = {
  scene: ThreeScene;
  renderer?: THREE.WebGLRenderer;
};

type EnvironmentCache = {
  sourceKey?: string;
  envMap?: THREE.Texture;
  background?: THREE.Texture;
  raw?: THREE.Texture;
  pmrem?: THREE.PMREMGenerator;
  loading?: Promise<void>;
};

const ENV_KEY = '__brewsite_environment';

const getCache = (scene: THREE.Scene): EnvironmentCache => {
  const existing = scene.userData[ENV_KEY] as EnvironmentCache | undefined;
  if (existing) return existing;
  const created: EnvironmentCache = {};
  scene.userData[ENV_KEY] = created;
  return created;
};

const getSourceKey = (source: EnvironmentSource): string => {
  if (source.type === 'cube') {
    return `cube:${source.urls.join('|')}:${source.background ? 'bg' : 'nobg'}`;
  }
  return `${source.type}:${source.url}:${source.background ? 'bg' : 'nobg'}`;
};

const clearEnvironment = (scene: THREE.Scene, cache: EnvironmentCache): void => {
  scene.environment = null;
  scene.background = null;
  const textures = new Set<THREE.Texture>();
  if (cache.envMap) textures.add(cache.envMap);
  if (cache.background) textures.add(cache.background);
  if (cache.raw) textures.add(cache.raw);
  textures.forEach((tex) => tex.dispose());
  cache.envMap = undefined;
  cache.background = undefined;
  cache.raw = undefined;
  cache.sourceKey = undefined;
  cache.loading = undefined;
};

const setIntensity = (scene: THREE.Scene, intensity: number, background: boolean): void => {
  const sceneAny = scene as unknown as {
    environmentIntensity?: number;
    backgroundIntensity?: number;
  };
  if ('environmentIntensity' in sceneAny) {
    sceneAny.environmentIntensity = intensity;
  }
  if (background && 'backgroundIntensity' in sceneAny) {
    sceneAny.backgroundIntensity = intensity;
  }
};

const setEnvironmentResult = (
  scene: THREE.Scene,
  cache: EnvironmentCache,
  envMap: THREE.Texture,
  raw: THREE.Texture,
  background: boolean,
): void => {
  scene.environment = envMap;
  scene.background = background ? raw : null;
  cache.envMap = envMap;
  cache.raw = raw;
  cache.background = background ? raw : undefined;
};

const loadHdri = async (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  cache: EnvironmentCache,
  source: EnvironmentSource,
): Promise<void> => {
  const pmrem = cache.pmrem ?? new THREE.PMREMGenerator(renderer);
  cache.pmrem = pmrem;
  if (source.type === 'hdr') {
    const loader = new RGBELoader();
    const texture = await loader.loadAsync(source.url);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const envMap = pmrem.fromEquirectangular(texture).texture;
    setEnvironmentResult(scene, cache, envMap, texture, source.background === true);
    return;
  }
  if (source.type === 'exr') {
    const loader = new EXRLoader();
    const texture = await loader.loadAsync(source.url);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const envMap = pmrem.fromEquirectangular(texture).texture;
    setEnvironmentResult(scene, cache, envMap, texture, source.background === true);
    return;
  }
  const loader = new THREE.CubeTextureLoader();
  const texture = await loader.loadAsync(source.urls);
  texture.mapping = THREE.CubeReflectionMapping;
  const envMap = pmrem.fromCubemap(texture).texture;
  setEnvironmentResult(scene, cache, envMap, texture, source.background === true);
};

export function applyEnvironment(state: SceneEnvironment, refs: EnvironmentThreeRefs): void {
  const scene = refs.scene as THREE.Scene;
  const cache = getCache(scene);
  if (!state.enabled || !state.source || !refs.renderer) {
    clearEnvironment(scene, cache);
    return;
  }

  const sourceKey = getSourceKey(state.source);
  if (cache.sourceKey !== sourceKey) {
    clearEnvironment(scene, cache);
    cache.sourceKey = sourceKey;
    cache.loading = loadHdri(refs.renderer, scene, cache, state.source).catch((err) => {
      console.warn('[Environment] failed to load environment', err);
      clearEnvironment(scene, cache);
    });
  }

  setIntensity(scene, state.intensity, state.source.background === true);
}
