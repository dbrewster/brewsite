// Material factory for chart renderers — caches MeshPhysicalMaterial by token key.

import * as THREE from 'three';
import { parseHexColor } from '@brewsite/core';
import { getInterpolator } from './colorUtils';
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

    const parsed = parseHexColor(tokens.color);
    const color = new THREE.Color(parsed.rgb);
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: tokens.emissiveIntensity,
      metalness: tokens.metalness,
      roughness: tokens.roughness,
      transmission: tokens.transmission,
      transparent: tokens.transmission > 0 || parsed.alpha < 1,
      opacity: parsed.alpha,
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

    const axisParsed = parseHexColor(theme.axis.lineColor);
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(axisParsed.rgb),
      transparent: true,
      opacity: 0.8 * axisParsed.alpha,
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

    const floorParsed = parseHexColor(theme.background.planeColor);
    const floorOp = theme.background.planeOpacity * floorParsed.alpha;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(floorParsed.rgb),
      transparent: floorOp < 1,
      opacity: floorOp,
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
    const interp = getInterpolator(interpolator);
    return new THREE.Color(interp(normalizedValue));
  }

  /** Apply opacity to all cached MeshPhysicalMaterial instances.
   *  Also scales emissiveIntensity proportionally so self-glow dims with
   *  the chart (e.g. carousel back-of-ring items). */
  applyOpacity(opacity: number): void {
    for (const mat of this.cache.values()) {
      if (mat instanceof THREE.MeshPhysicalMaterial) {
        mat.opacity = Math.min(opacity, mat.transmission > 0 ? 0.85 : 1.0);
        mat.transparent = mat.transparent || opacity < 1;
        // Scale emissive intensity so self-glow fades with opacity.
        if (mat.userData) {
          if (mat.userData.baseEmissiveIntensity === undefined) {
            mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
          }
          mat.emissiveIntensity = (mat.userData.baseEmissiveIntensity as number) * opacity;
        }
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
