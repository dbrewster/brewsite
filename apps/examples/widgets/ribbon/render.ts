import * as THREE from 'three';
import type { RibbonConfig, SceneRibbon } from './types';

export class RibbonRenderer {
  private scene: THREE.Scene;
  private group: THREE.Group | null = null;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.MeshStandardMaterial | null = null;
  private glowLight: THREE.PointLight | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  update(state: SceneRibbon): void {
    if (!state.enabled || !state.config) {
      if (this.group) this.group.visible = false;
      return;
    }
    if (!this.group) {
      this.group = new THREE.Group();
      this.scene.add(this.group);
    }
    this.group.visible = true;

    const config = state.config;
    this.group.position.set(config.position[0], config.position[1], config.position[2]);
    this.group.rotation.set(config.rotation[0], config.rotation[1], config.rotation[2]);
    this.group.scale.set(config.scale[0], config.scale[1], config.scale[2]);

    if (!this.mesh || !this.material) {
      const geom = new THREE.TorusGeometry(1, 0.08, 12, 48);
      this.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(config.glowLightColor ?? '#ffffff'),
        transparent: true,
        opacity: typeof config.opacity === 'number' ? config.opacity : 0.9,
      });
      this.mesh = new THREE.Mesh(geom, this.material);
      this.group.add(this.mesh);
    }

    if (this.material) {
      this.material.opacity = typeof config.opacity === 'number' ? config.opacity : 0.9;
      this.material.color = new THREE.Color(config.glowLightColor ?? '#ffffff');
    }

    this.updateGlowLight(config);
  }

  private updateGlowLight(config: RibbonConfig): void {
    const enabled = config.glowLightsEnabled && config.glowLightIntensity > 0;
    if (!enabled) {
      if (this.glowLight) {
        this.glowLight.removeFromParent();
        this.glowLight = null;
      }
      return;
    }

    if (!this.glowLight) {
      this.glowLight = new THREE.PointLight();
      this.glowLight.castShadow = false;
      this.glowLight.position.set(0, 0, 0);
      this.group?.add(this.glowLight);
    }

    this.glowLight.color = new THREE.Color(config.glowLightColor ?? '#ffffff');
    this.glowLight.intensity = config.glowLightIntensity;
    this.glowLight.distance = config.glowLightDistance;
    this.glowLight.decay = config.glowLightDecay;
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (this.material) this.material.dispose();
      this.mesh.removeFromParent();
    }
    if (this.group) {
      this.group.removeFromParent();
    }
    if (this.glowLight) {
      this.glowLight.removeFromParent();
      this.glowLight = null;
    }
    this.group = null;
    this.mesh = null;
    this.material = null;
  }
}
