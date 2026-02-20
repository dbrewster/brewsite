import {EquirectangularReflectionMapping, PMREMGenerator, type Scene, type Texture, TextureLoader, type WebGLRenderer,} from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {SceneEnvironment} from './types';

export type EnvironmentThreeRefs = {
  renderer: WebGLRenderer;
  scene: Scene;
};

/**
 * EnvironmentRenderer manages Three.js environment maps.
 * Handles loading equirectangular textures or room presets,
 * generating PMREM textures, and applying them to the scene.
 */
class EnvironmentRendererImpl {
  private currentUrl: string | null = null;
  private currentPreset: 'room' | null = null;
  private currentTexture: Texture | null = null;
  private envTexture: Texture | null = null;
  private presetTexture: Texture | null = null;
  private loader = new TextureLoader();
  private pmrem: PMREMGenerator;
  private scene: Scene;
  private renderer: WebGLRenderer;
  private warnedMissing = false;

  constructor(scene: Scene, renderer: WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.pmrem = new PMREMGenerator(renderer);
  }

  update(state: SceneEnvironment): void {
    if (!state.enabled || (!state.url && !state.preset)) {
      this.clear();
      return;
    }

    if (state.preset === 'room') {
      this.ensureRoomEnvironment();
    } else if (state.url && state.url !== this.currentUrl) {
      this.load(state.url);
    }

    if ('environmentIntensity' in this.scene) {
      (this.scene as unknown as { environmentIntensity: number }).environmentIntensity =
        state.intensity;
    }
  }

  dispose(): void {
    this.clear();
    this.pmrem.dispose();
  }

  private load(url: string): void {
    if (this.currentPreset) {
      this.clearPreset();
    }
    this.currentUrl = url;
    this.loader.load(
      url,
      (texture: Texture) => {
        this.currentTexture?.dispose();
        this.envTexture?.dispose();
        texture.mapping = EquirectangularReflectionMapping;
        this.currentTexture = texture;
        this.envTexture = this.pmrem.fromEquirectangular(texture).texture;
        this.scene.environment = this.envTexture;
      },
      undefined,
      (error: unknown) => {
        console.warn('[RobotRuntime]', 'runtime.renderer.environmentLoadFailed', { url, error });
      },
    );
  }

  private clear(): void {
    if (this.scene.environment === this.envTexture) {
      this.scene.environment = null;
    }
    if (this.scene.environment === this.presetTexture) {
      this.scene.environment = null;
    }
    this.currentUrl = null;
    this.currentPreset = null;
    this.currentTexture?.dispose();
    this.envTexture?.dispose();
    this.presetTexture?.dispose();
    this.currentTexture = null;
    this.envTexture = null;
    this.presetTexture = null;
  }

  private ensureRoomEnvironment(): void {
    if (this.currentPreset === 'room' && this.presetTexture) return;
    this.clearUrl();
    this.currentPreset = 'room';
    this.presetTexture?.dispose();
    this.presetTexture = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.presetTexture;
  }

  private clearUrl(): void {
    if (this.currentUrl) {
      this.currentUrl = null;
      this.currentTexture?.dispose();
      this.envTexture?.dispose();
      this.currentTexture = null;
      this.envTexture = null;
    }
  }

  private clearPreset(): void {
    if (this.currentPreset) {
      this.currentPreset = null;
      this.presetTexture?.dispose();
      this.presetTexture = null;
    }
  }
}

// Cache for renderer instances keyed by WebGLRenderer
const rendererCache = new WeakMap<WebGLRenderer, EnvironmentRendererImpl>();

/**
 * Apply environment state to Three.js scene.
 * Creates or reuses a renderer instance for the given WebGLRenderer.
 */
export function applyEnvironment(state: SceneEnvironment, refs: EnvironmentThreeRefs): void {
  let impl = rendererCache.get(refs.renderer);
  if (!impl) {
    impl = new EnvironmentRendererImpl(refs.scene, refs.renderer);
    rendererCache.set(refs.renderer, impl);
  }
  impl.update(state);
}
