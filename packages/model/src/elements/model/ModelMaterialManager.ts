// ModelMaterialManager.ts — Material base caching and override application.

import * as THREE from 'three';
import { parseHexColor } from '@brewsite/core';

/** Cached original material property values captured on first encounter. */
type MaterialBase = {
  color?: THREE.Color;
  opacity?: number;
  transparent?: boolean;
  depthWrite?: boolean;
  metalness?: number;
  roughness?: number;
};

/** Per-call material property overrides applied on top of the cached base. */
export type MaterialOverrides = {
  color?: string;
  opacity?: number;
  metalness?: number;
  roughness?: number;
};

/**
 * Caches original material properties and applies per-frame overrides.
 * Call `cacheMaterial()` once when a mesh is first ingested.
 * Call `applyOverrides()` each frame to restore base and apply the current delta.
 */
export class ModelMaterialManager {
  private materialBase = new Map<string, MaterialBase>();

  /**
   * Cache the original material properties from a mesh.
   * Should be called exactly once per material instance after the material is cloned.
   * Skips materials that have already been cached (by uuid).
   *
   * @param material - Single material or array of materials to cache.
   */
  cacheMaterial(material: THREE.Material | THREE.Material[]): void {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((mat) => {
      if (!mat || this.materialBase.has(mat.uuid)) return;
      const base: MaterialBase = {};
      if ('color' in mat && (mat as THREE.MeshStandardMaterial).color) {
        base.color = (mat as THREE.MeshStandardMaterial).color.clone();
      }
      if ('opacity' in mat) base.opacity = (mat as THREE.MeshStandardMaterial).opacity;
      if ('transparent' in mat) base.transparent = (mat as THREE.MeshStandardMaterial).transparent;
      if ('depthWrite' in mat) base.depthWrite = (mat as THREE.MeshStandardMaterial).depthWrite;
      if ('metalness' in mat) base.metalness = (mat as THREE.MeshStandardMaterial).metalness;
      if ('roughness' in mat) base.roughness = (mat as THREE.MeshStandardMaterial).roughness;
      this.materialBase.set(mat.uuid, base);
    });
  }

  /**
   * Apply overrides on top of the cached base values.
   * Restores to base first, then applies the per-frame delta.
   * No-ops for material entries that have no cached base (unknown material).
   *
   * @param material - Single material or array of materials to update.
   * @param overrides - Properties to override (on top of the cached base).
   */
  applyOverrides(
    material: THREE.Material | THREE.Material[],
    overrides: MaterialOverrides,
  ): void {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((mat) => {
      if (!mat) return;
      const base = this.materialBase.get(mat.uuid);
      if (base) {
        if ('color' in mat && base.color) {
          (mat as THREE.MeshStandardMaterial).color.copy(base.color);
        }
        if (typeof base.opacity === 'number') {
          (mat as THREE.MeshStandardMaterial).opacity = base.opacity;
        }
        if (typeof base.transparent === 'boolean') {
          (mat as THREE.MeshStandardMaterial).transparent = base.transparent;
        }
        if (typeof base.depthWrite === 'boolean') {
          (mat as THREE.MeshStandardMaterial).depthWrite = base.depthWrite;
        }
        if (typeof base.metalness === 'number') {
          (mat as THREE.MeshStandardMaterial).metalness = base.metalness;
        }
        if (typeof base.roughness === 'number') {
          (mat as THREE.MeshStandardMaterial).roughness = base.roughness;
        }
      }
      if ('color' in mat && overrides.color) {
        const colorParsed = parseHexColor(overrides.color);
        (mat as THREE.MeshStandardMaterial).color = new THREE.Color(colorParsed.rgb);
        if (colorParsed.alpha < 1) {
          (mat as THREE.MeshStandardMaterial).transparent = true;
          (mat as THREE.MeshStandardMaterial).opacity =
            ((mat as THREE.MeshStandardMaterial).opacity ?? 1) * colorParsed.alpha;
        }
      }
      if (typeof overrides.opacity === 'number') {
        (mat as THREE.MeshStandardMaterial).transparent = true;
        (mat as THREE.MeshStandardMaterial).opacity = overrides.opacity;
        const baseDepthWrite = base?.depthWrite ?? true;
        (mat as THREE.MeshStandardMaterial).depthWrite =
          overrides.opacity < 1 ? false : baseDepthWrite;
      }
      if (typeof overrides.metalness === 'number' && 'metalness' in mat) {
        (mat as THREE.MeshStandardMaterial).metalness = overrides.metalness;
      }
      if (typeof overrides.roughness === 'number' && 'roughness' in mat) {
        (mat as THREE.MeshStandardMaterial).roughness = overrides.roughness;
      }
    });
  }

  /**
   * Dispose all materials tracked in the cache and clear the cache.
   * Call when the model is removed from the scene.
   */
  disposeMaterials(): void {
    // Note: We do not dispose materials here because ModelRenderer.disposeObject3D handles
    // geometry+material disposal by traversing the Object3D tree. This method only clears
    // the cache so cached base values no longer hold references to freed materials.
    this.materialBase.clear();
  }

  /**
   * Remove a specific material (or array of materials) from the cache.
   * Use when disposing a single mesh without tearing down the entire model.
   *
   * @param material - Single material or array of materials to remove from the cache.
   */
  removeMaterial(material: THREE.Material | THREE.Material[]): void {
    const materials = Array.isArray(material) ? material : [material];
    for (const mat of materials) {
      if (mat) this.materialBase.delete(mat.uuid);
    }
  }
}
