import {Mesh, MeshStandardMaterial, PlaneGeometry, RepeatWrapping, type Scene, type Texture, TextureLoader} from 'three';
import type {SceneFloor} from './types';

export type FloorThreeRefs = {
  scene: Scene;
};

class FloorRendererImpl {
  private mesh: Mesh | null = null;
  private geometry: PlaneGeometry | null = null;
  private material: MeshStandardMaterial | null = null;
  private textureLoader = new TextureLoader();
  private currentUrl: string | null = null;
  private warnedMissing = false;

  update(state: SceneFloor, scene: Scene): void {
    if (!state.enabled) {
      if (this.mesh) this.mesh.visible = false;
      return;
    }

    if (!this.mesh) {
      this.geometry = new PlaneGeometry(220, 220);
      this.material = new MeshStandardMaterial({ color: '#f4efe6', roughness: 0.35, metalness: 0.08 });
      this.mesh = new Mesh(this.geometry, this.material);
      this.mesh.rotation.set(-Math.PI / 2, 0, 0);
      this.mesh.position.set(0, -12, 0);
      scene.add(this.mesh);
    }

    this.mesh.visible = true;

    if (state.textureUrl && state.textureUrl !== this.currentUrl) {
      this.currentUrl = state.textureUrl;
      this.textureLoader.load(
        state.textureUrl,
        (texture: Texture) => {
          texture.wrapS = RepeatWrapping;
          texture.wrapT = RepeatWrapping;
          texture.repeat.set(2, 2);
          texture.needsUpdate = true;
          if (this.material) {
            this.material.map?.dispose();
            this.material.map = texture;
            this.material.needsUpdate = true;
          }
        },
        undefined,
        (error: unknown) => console.warn('[RobotRuntime]', 'runtime.renderer.floorTextureFailed', { url: state.textureUrl, error }),
      );
    }
  }

  dispose(): void {
    if (this.mesh) this.mesh.removeFromParent();
    this.geometry?.dispose();
    this.material?.dispose();
    this.geometry = null;
    this.material = null;
    this.mesh = null;
  }
}

// Cache for renderer instances keyed by Scene
const rendererCache = new WeakMap<Scene, FloorRendererImpl>();

/**
 * Apply floor state to Three.js scene.
 * Creates or reuses a renderer instance for the given Scene.
 */
export function applyFloor(state: SceneFloor, refs: FloorThreeRefs): void {
  let impl = rendererCache.get(refs.scene);
  if (!impl) {
    impl = new FloorRendererImpl();
    rendererCache.set(refs.scene, impl);
  }
  impl.update(state, refs.scene);
}
