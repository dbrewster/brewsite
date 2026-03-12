// Pure region helpers — padding normalization, inset computation, bounds composition.
// No Three.js, no React.

import type { NVSRect } from './types';
import type {
  RegionPadding,
  NormalizedPadding,
  RegionContract,
  ResolvedRegion,
} from './regionTypes';

/**
 * Converts any RegionPadding variant to a [top, right, bottom, left] 4-tuple.
 *
 * - number → [n, n, n, n]
 * - [v, h] → [v, h, v, h]
 * - [t, r, b, l] → [t, r, b, l]
 *
 * Returns [0, 0, 0, 0] for 0 or any invalid input.
 */
export function normalizePadding(padding: RegionPadding): NormalizedPadding {
  if (typeof padding === 'number') {
    return [padding, padding, padding, padding];
  }
  if (padding.length === 2) {
    const [v, h] = padding as readonly [number, number];
    return [v, h, v, h];
  }
  if (padding.length === 4) {
    return padding as NormalizedPadding;
  }
  return [0, 0, 0, 0];
}

/**
 * Returns the inner content rect after applying padding insets.
 * Clamps to non-negative width/height.
 *
 * result.x = rect.x + padding[3]         (left)
 * result.y = rect.y + padding[0]         (top)
 * result.w = max(0, rect.w - padding[1] - padding[3])  (right + left)
 * result.h = max(0, rect.h - padding[0] - padding[2])  (top + bottom)
 */
export function applyPaddingToRect(rect: NVSRect, padding: NormalizedPadding): NVSRect {
  return {
    x: rect.x + padding[3],
    y: rect.y + padding[0],
    w: Math.max(0, rect.w - padding[1] - padding[3]),
    h: Math.max(0, rect.h - padding[0] - padding[2]),
  };
}

/**
 * Resolves a RegionContract into a ResolvedRegion with computed content bounds.
 * Layer defaults to 0.
 */
export function resolveRegion(contract: RegionContract): ResolvedRegion {
  const normalized = normalizePadding(contract.padding);
  const contentBounds = applyPaddingToRect(contract.bounds, normalized);
  return {
    outerBounds: contract.bounds,
    contentBounds,
    padding: normalized,
    layer: 0,
  };
}

/**
 * Maps a child's local [0..1] coordinates into the parent's absolute NVS sub-rect.
 *
 * absolute.x = parent.x + local.x * parent.w
 * absolute.y = parent.y + local.y * parent.h
 * absolute.w = local.w * parent.w
 * absolute.h = local.h * parent.h
 *
 * The identity case (no parent) is handled by passing { x: 0, y: 0, w: 1, h: 1 } as parentRect.
 */
export function composeBoundsIntoParent(localRect: NVSRect, parentRect: NVSRect): NVSRect {
  return {
    x: parentRect.x + localRect.x * parentRect.w,
    y: parentRect.y + localRect.y * parentRect.h,
    w: localRect.w * parentRect.w,
    h: localRect.h * parentRect.h,
  };
}

/**
 * Returns the smallest axis-aligned bounding rect containing both a and b.
 *
 * minX = min(a.x, b.x)
 * minY = min(a.y, b.y)
 * maxX = max(a.x + a.w, b.x + b.w)
 * maxY = max(a.y + a.h, b.y + b.h)
 * result = { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
 */
export function unionBounds(a: NVSRect, b: NVSRect): NVSRect {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.w, b.x + b.w);
  const maxY = Math.max(a.y + a.h, b.y + b.h);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
