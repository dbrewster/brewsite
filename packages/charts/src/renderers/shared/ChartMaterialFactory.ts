// Material factory for chart renderers — caches MeshPhysicalMaterial by token key.

import * as THREE from 'three';
import {
  interpolateBlues,
  interpolateReds,
  interpolateViridis,
  interpolatePlasma,
} from 'd3-scale-chromatic';
import type { ChartTheme } from '../../themes/types';
import type { ScatterChartOptions } from './IChartRenderer';

type MaterialKey = string;

/**
 * Caches MeshPhysicalMaterial instances by a composite token key.
 * Shared across renderer types for a single ChartRenderer instance.
 * Dispose with dispose() when the chart widget is destroyed.
 */
export class ChartMaterialFactory {
  private readonly cache = new Map<MaterialKey, THREE.Material>();

  /** Returns a cached (or new) material for the given series index. */
  getSeriesMaterial(
    theme: ChartTheme,
    seriesIndex: number,
    options?: { flatShading?: boolean },
  ): THREE.MeshPhysicalMaterial {
    const tokens = theme.series[seriesIndex % theme.series.length]!;
    const flatShading = options?.flatShading === true;
    const key = `${tokens.color}|${tokens.metalness}|${tokens.roughness}|${tokens.transmission}|${tokens.emissiveIntensity}|${flatShading}`;
    const cached = this.cache.get(key);
    if (cached instanceof THREE.MeshPhysicalMaterial) return cached;

    const color = new THREE.Color(tokens.color);
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: tokens.emissiveIntensity,
      metalness: tokens.metalness,
      roughness: tokens.roughness,
      transmission: tokens.transmission,
      transparent: tokens.transmission > 0,
      flatShading,
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
    this.cache.set(key, mat);
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
    this.cache.set(key, mat);
    return mat;
  }

  /**
   * Returns a fresh MeshPhysicalMaterial for a specific datum color (colorField encoding).
   * Not cached — caller is responsible for disposal.
   */
  getColorFieldMaterial(color: THREE.Color, opacity: number): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.1,
      metalness: 0.1,
      roughness: 0.6,
      transparent: opacity < 1,
      opacity,
      side: THREE.FrontSide,
    });
  }

  /**
   * Maps a normalized [0,1] value to a Three.js Color using the specified d3-scale-chromatic interpolator.
   * Used by ScatterRenderer for continuous colorField encoding.
   */
  static interpolateColor(
    normalizedValue: number,
    interpolator: ScatterChartOptions['colorInterpolator'],
  ): THREE.Color {
    let cssColor: string;
    switch (interpolator) {
      case 'blues':
        cssColor = interpolateBlues(normalizedValue);
        break;
      case 'reds':
        cssColor = interpolateReds(normalizedValue);
        break;
      case 'plasma':
        cssColor = interpolatePlasma(normalizedValue);
        break;
      case 'viridis':
      default:
        cssColor = interpolateViridis(normalizedValue);
        break;
    }
    return new THREE.Color(cssColor);
  }

  /** Apply opacity to all cached MeshPhysicalMaterial instances. */
  applyOpacity(opacity: number): void {
    for (const mat of this.cache.values()) {
      if (mat instanceof THREE.MeshPhysicalMaterial) {
        mat.opacity = Math.min(opacity, mat.transmission > 0 ? 0.85 : 1.0);
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
