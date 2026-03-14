// ModelMaterialManager.test.ts — Material cache and override application tests.
// Uses real THREE.MeshStandardMaterial (no WebGL required).

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ModelMaterialManager } from '../ModelMaterialManager';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMat(
  overrides: Partial<{
    color: string;
    opacity: number;
    metalness: number;
    roughness: number;
    transparent: boolean;
  }> = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: overrides.color ?? '#ffffff',
    opacity: overrides.opacity ?? 1,
    metalness: overrides.metalness ?? 0,
    roughness: overrides.roughness ?? 1,
    transparent: overrides.transparent ?? false,
  });
}

// ─── cacheMaterial ────────────────────────────────────────────────────────────

describe('ModelMaterialManager.cacheMaterial', () => {
  it('caches a single material by uuid', () => {
    const mgr = new ModelMaterialManager();
    const mat = makeMat({ opacity: 0.8, metalness: 0.5 });
    mgr.cacheMaterial(mat);

    // Mutate the material
    mat.opacity = 0.1;
    mat.metalness = 0.9;

    // Restore via applyOverrides with no overrides (restores to base)
    mgr.applyOverrides(mat, {});
    expect(mat.opacity).toBeCloseTo(0.8);
    expect(mat.metalness).toBeCloseTo(0.5);
  });

  it('caches an array of materials', () => {
    const mgr = new ModelMaterialManager();
    const mat1 = makeMat({ opacity: 0.9 });
    const mat2 = makeMat({ opacity: 0.4 });
    mgr.cacheMaterial([mat1, mat2]);

    mat1.opacity = 0.1;
    mat2.opacity = 0.1;

    mgr.applyOverrides([mat1, mat2], {});
    expect(mat1.opacity).toBeCloseTo(0.9);
    expect(mat2.opacity).toBeCloseTo(0.4);
  });

  it('skips already-cached materials on subsequent calls (idempotent)', () => {
    const mgr = new ModelMaterialManager();
    const mat = makeMat({ opacity: 0.7 });
    mgr.cacheMaterial(mat);

    // Mutate and re-cache — second cache call should NOT overwrite the base
    mat.opacity = 0.3;
    mgr.cacheMaterial(mat); // should be a no-op (already cached by uuid)

    // Restoring should bring back the original 0.7, not the mutated 0.3
    mgr.applyOverrides(mat, {});
    expect(mat.opacity).toBeCloseTo(0.7);
  });
});

// ─── applyOverrides ───────────────────────────────────────────────────────────

describe('ModelMaterialManager.applyOverrides', () => {
  let mgr: ModelMaterialManager;
  let mat: THREE.MeshStandardMaterial;

  beforeEach(() => {
    mgr = new ModelMaterialManager();
    mat = makeMat({ color: '#ff0000', opacity: 1, metalness: 0, roughness: 1 });
    mgr.cacheMaterial(mat);
  });

  it('restores to base first, then applies overrides', () => {
    // Dirty the material
    mat.opacity = 0;
    mat.metalness = 1;

    mgr.applyOverrides(mat, { opacity: 0.5, metalness: 0.8 });
    expect(mat.opacity).toBeCloseTo(0.5);
    expect(mat.metalness).toBeCloseTo(0.8);
  });

  it('applies roughness override', () => {
    mgr.applyOverrides(mat, { roughness: 0.3 });
    expect(mat.roughness).toBeCloseTo(0.3);
  });

  it('applies color override as hex string', () => {
    mgr.applyOverrides(mat, { color: '#0000ff' });
    // Color should be blue
    expect(mat.color.b).toBeGreaterThan(0.9);
    expect(mat.color.r).toBeCloseTo(0);
  });

  it('sets transparent=true and depthWrite=false when opacity < 1', () => {
    mgr.applyOverrides(mat, { opacity: 0.5 });
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
  });

  it('restores depthWrite=true when opacity is 1', () => {
    // First apply at opacity < 1 to set depthWrite=false
    mgr.applyOverrides(mat, { opacity: 0.5 });
    expect(mat.depthWrite).toBe(false);

    // Now apply opacity=1 — should restore depthWrite
    mgr.applyOverrides(mat, { opacity: 1 });
    expect(mat.depthWrite).toBe(true);
  });

  it('no-ops for uncached materials (does not crash)', () => {
    const unknownMat = makeMat();
    // Not cached — should not throw
    expect(() => mgr.applyOverrides(unknownMat, { opacity: 0.5 })).not.toThrow();
  });

  it('accepts an array of materials', () => {
    const mat2 = makeMat({ metalness: 0.2 });
    mgr.cacheMaterial(mat2);

    mgr.applyOverrides([mat, mat2], { metalness: 0.9 });
    expect(mat.metalness).toBeCloseTo(0.9);
    expect(mat2.metalness).toBeCloseTo(0.9);
  });

  it('restores base values across multiple apply calls', () => {
    mgr.applyOverrides(mat, { opacity: 0.2 });
    expect(mat.opacity).toBeCloseTo(0.2);

    // Second apply with no opacity override → restores to base (1)
    mgr.applyOverrides(mat, {});
    expect(mat.opacity).toBeCloseTo(1);
  });
});

// ─── disposeMaterials ─────────────────────────────────────────────────────────

describe('ModelMaterialManager.disposeMaterials', () => {
  it('clears the cache so applyOverrides no longer has a base to restore', () => {
    const mgr = new ModelMaterialManager();
    const mat = makeMat({ opacity: 0.7 });
    mgr.cacheMaterial(mat);

    mgr.disposeMaterials();

    // After clearing cache, dirty the material — restore should have no effect
    mat.opacity = 0.1;
    mgr.applyOverrides(mat, {});
    // Base is gone, so no restoration — opacity stays at 0.1
    expect(mat.opacity).toBeCloseTo(0.1);
  });

  it('can be called multiple times without error', () => {
    const mgr = new ModelMaterialManager();
    mgr.disposeMaterials();
    mgr.disposeMaterials();
  });
});

// ─── removeMaterial ───────────────────────────────────────────────────────────

describe('ModelMaterialManager.removeMaterial', () => {
  it('removes a single material from the cache by reference', () => {
    const mgr = new ModelMaterialManager();
    const mat = makeMat({ opacity: 0.8 });
    mgr.cacheMaterial(mat);

    mgr.removeMaterial(mat);

    // No longer in cache — applyOverrides is a no-op, dirty value stays
    mat.opacity = 0.1;
    mgr.applyOverrides(mat, {});
    expect(mat.opacity).toBeCloseTo(0.1);
  });

  it('removes materials by array', () => {
    const mgr = new ModelMaterialManager();
    const mat1 = makeMat({ opacity: 0.9 });
    const mat2 = makeMat({ opacity: 0.6 });
    mgr.cacheMaterial([mat1, mat2]);

    mgr.removeMaterial([mat1, mat2]);

    mat1.opacity = 0.1;
    mat2.opacity = 0.1;
    mgr.applyOverrides([mat1, mat2], {});
    // Both removed — values stay at 0.1
    expect(mat1.opacity).toBeCloseTo(0.1);
    expect(mat2.opacity).toBeCloseTo(0.1);
  });

  it('is a no-op for unknown materials', () => {
    const mgr = new ModelMaterialManager();
    const mat = makeMat();
    // Not cached — should not throw
    expect(() => mgr.removeMaterial(mat)).not.toThrow();
  });
});
