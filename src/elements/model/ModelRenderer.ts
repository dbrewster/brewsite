/**
 * ModelRenderer - Three.js rendering for model elements.
 *
 * Responsibilities:
 * - Load GLB models
 * - Apply model state (position, rotation, scale)
 * - Manage animation playback
 * - Apply motion transformations
 *
 * This is a placeholder stub for Phase 10 that implements the minimal interface.
 * Full implementation with animation and motion will follow in subsequent phases.
 */

import * as THREE from 'three';
import type { SceneModelInstanceState } from './types';
import type { CompiledAnimation } from './compile';
import type { WidgetRenderContext } from '../../widget/types';
import { applyModelTransform } from './render';
import type { IRenderable as RenderInterface } from './render';

export class ModelRenderer {
  private scene: THREE.Scene;
  private model: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Load a GLB model from a URL.
   */
  async loadGlb(glbUrl: string, _anchorTargets?: Record<string, string>): Promise<void> {
    // Placeholder: actual loading will be implemented in a later phase
    console.log('[ModelRenderer] loadGlb:', glbUrl);
  }

  /**
   * Apply model state to the Three.js scene.
   */
  apply(
    state: SceneModelInstanceState,
    _animation?: CompiledAnimation,
    _ctx?: WidgetRenderContext,
  ): void {
    if (!this.model) return;

    // Create a wrapper object that adapts THREE.Group to IRenderable interface
    const group = this.model;
    const wrapper: RenderInterface = {
      get localPosition() {
        const pos = group.position;
        return [pos.x, pos.y, pos.z] as [number, number, number];
      },
      set localPosition(value: [number, number, number]) {
        group.position.set(value[0], value[1], value[2]);
      },
      get localRotation() {
        const euler = new THREE.Euler().setFromQuaternion(group.quaternion);
        return [euler.x, euler.y, euler.z] as [number, number, number];
      },
      set localRotation(value: [number, number, number]) {
        group.quaternion.setFromEuler(new THREE.Euler(value[0], value[1], value[2]));
      },
      get localScale() {
        const scale = group.scale;
        return [scale.x, scale.y, scale.z] as [number, number, number];
      },
      set localScale(value: [number, number, number]) {
        group.scale.set(value[0], value[1], value[2]);
      },
    };

    // Apply the model transform
    applyModelTransform(state.model, wrapper);

    // Animation and motion application will be implemented in later phases
  }

  /**
   * Get world positions of all bones.
   */
  getBoneWorldPositions(): Map<string, [number, number, number]> {
    return new Map();
  }

  /**
   * Get a bone node by anchor key.
   */
  getAnchorBoneNode(_anchorKey: string): THREE.Object3D | null {
    return null;
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    if (this.model) {
      this.scene.remove(this.model);
      this.model = null;
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
  }
}
