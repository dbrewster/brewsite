// Material factory for chart renderers — caches MeshPhysicalMaterial by token key.

import * as THREE from 'three';
import type { ChartTheme } from '../../themes/types';

type MaterialKey = string;

/**
 * Caches MeshPhysicalMaterial instances by a composite token key.
 * Shared across renderer types for a single ChartRenderer instance.
 * Dispose with dispose() when the chart widget is destroyed.
 */
export class ChartMaterialFactory {
  private readonly cache = new Map<MaterialKey, THREE.MeshPhysicalMaterial>();

  /** Returns a cached (or new) material for the given series index. */
  getSeriesMaterial(theme: ChartTheme, seriesIndex: number): THREE.MeshPhysicalMaterial {
    const tokens = theme.series[seriesIndex % theme.series.length]!;
    const key = `${tokens.color}|${tokens.metalness}|${tokens.roughness}|${tokens.transmission}|${tokens.emissiveIntensity}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const color = new THREE.Color(tokens.color);
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: tokens.emissiveIntensity,
      metalness: tokens.metalness,
      roughness: tokens.roughness,
      transmission: tokens.transmission,
      transparent: tokens.transmission > 0,
      side: THREE.FrontSide,
    });
    this.cache.set(key, mat);
    return mat;
  }

  /** Returns a cached (or new) material for axis lines. */
  createAxisMaterial(theme: ChartTheme): THREE.LineBasicMaterial {
    const key = `axis|${theme.axis.lineColor}`;
    const cached = this.cache.get(key);
    if (cached instanceof THREE.LineBasicMaterial) return cached;

    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(theme.axis.lineColor),
      transparent: true,
      opacity: 0.8,
    });
    this.cache.set(key, mat as unknown as THREE.MeshPhysicalMaterial);
    return mat;
  }

  /** Returns a cached (or new) material for the floor/background plane. */
  createFloorMaterial(theme: ChartTheme): THREE.MeshStandardMaterial | null {
    if (!theme.background.planeColor) return null;
    const key = `floor|${theme.background.planeColor}|${theme.background.planeOpacity}`;
    const cached = this.cache.get(key);
    if (cached instanceof THREE.MeshStandardMaterial) return cached;

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.background.planeColor),
      transparent: theme.background.planeOpacity < 1,
      opacity: theme.background.planeOpacity,
      side: THREE.FrontSide,
      metalness: 0,
      roughness: 0.9,
    });
    this.cache.set(key, mat as unknown as THREE.MeshPhysicalMaterial);
    return mat;
  }

  /** Apply opacity to all cached MeshPhysicalMaterial instances. */
  applyOpacity(opacity: number): void {
    for (const mat of this.cache.values()) {
      if (mat instanceof THREE.MeshPhysicalMaterial) {
        mat.opacity = Math.min(opacity, mat.transmission > 0 ? 0.85 : 1.0) * opacity;
        mat.transparent = mat.transparent || opacity < 1;
      }
    }
  }

  /** Dispose all cached materials. */
  dispose(): void {
    for (const mat of this.cache.values()) {
      mat.dispose();
    }
    this.cache.clear();
  }
}
