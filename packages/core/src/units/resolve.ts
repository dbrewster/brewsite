// Resolution functions — converts parsed unit values to NVS fractions or radians.

import type { NVSCoordService } from '../widget/types';
import { parseAngle, parseLength } from './parse';
import type { SceneAngle, SceneLength } from './types';

/**
 * Context needed for unit resolution at render time.
 * Wraps the essential viewport dimensions from NVSCoordService.
 */
export type UnitContext = {
  /** min(visibleWorldWidth, visibleWorldHeight) — the vmin reference for uniform sizing. */
  readonly uniformScale: number;
  /** Viewport width in world units at z=0. */
  readonly visibleWorldWidth: number;
  /** Viewport height in world units at z=0. */
  readonly visibleWorldHeight: number;
};

/**
 * Resolves a SceneLength to an NVS fraction (0..1 range for typical values).
 *
 * All unit types resolve to value/100:
 * - `u`: value/100 (caller uses uniformSizing flag for vmin scaling)
 * - `%`: value/100
 * - `vw`: value/100
 * - `vh`: value/100
 * - `0`: 0
 *
 * The distinction between units is semantic — `u` sets the uniformSizing flag
 * via isUniformUnit(), while `%`/`vw`/`vh` use per-axis scaling.
 */
export function resolveToNVS(value: SceneLength): number {
  if (value === 0) return 0;
  const parsed = parseLength(value);
  return parsed.value / 100;
}

/**
 * Returns true if the given SceneLength uses the `u` (uniform) unit.
 * Used by compile layers to determine the uniformSizing flag value.
 */
export function isUniformUnit(value: SceneLength): boolean {
  if (value === 0) return false;
  const parsed = parseLength(value);
  return parsed.unit === 'u';
}

/**
 * Resolves a SceneAngle to radians.
 * - `deg`: value * (PI / 180)
 * - `rad`: passthrough
 * - `0`: 0
 */
export function resolveAngle(value: SceneAngle): number {
  if (value === 0) return 0;
  const parsed = parseAngle(value);
  if (parsed.unit === 'deg') {
    return parsed.value * (Math.PI / 180);
  }
  return parsed.value;
}

/**
 * Constructs a UnitContext from the existing NVSCoordService.
 * This is the bridge — UnitContext wraps NVSCoordService, it does not replace it.
 */
export function unitContextFromCoords(coords: NVSCoordService): UnitContext {
  return {
    uniformScale: Math.min(coords.visibleWorldWidth, coords.visibleWorldHeight),
    visibleWorldWidth: coords.visibleWorldWidth,
    visibleWorldHeight: coords.visibleWorldHeight,
  };
}
