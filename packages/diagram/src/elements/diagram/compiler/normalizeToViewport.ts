// Pure coordinate transformation: layout Y-up positions → [0..1] NVS space.
// Uniformly scales dense layouts to fit, then centers and Y-flips.

import type { GroupBounds } from './groupCompiler';

type RawPosition = readonly [number, number, number];
type RawSize = readonly [number, number];

/** Margin per side when scale-to-fit is triggered. 2% = usable area is 96% of [0..1]. */
const SCALE_TO_FIT_MARGIN = 0.02;

/**
 * Output of normalizeToViewport(). All positions are in [0..1] NVS with Y-down.
 * Sizes may be uniformly scaled if the layout exceeded [0..1].
 * Group bounds are scaled, Y-flipped, and centered.
 */
export type NormalizeToViewportResult = {
  readonly normalizedPositions: Map<string, RawPosition>;
  readonly normalizedSizes: Map<string, RawSize>;
  readonly normalizedGroups: Map<string, GroupBounds>;
  /**
   * Uniform normalization factor for thickness-type values.
   * Computed as scaleFactor * max(defaultNodeSize[0], defaultNodeSize[1]).
   * Converts theme-authored thickness (content-unit scale) to NVS-proportional
   * values. The renderer multiplies by uniformWorldW to convert to world units.
   */
  readonly thicknessNormFactor: number;
};

/**
 * Centers layout output within [0..1] NVS, uniformly scales to fit if needed,
 * and flips Y axis.
 *
 * Layout algorithms produce positions in NVS-scale Cartesian Y-up space.
 * This function:
 * 1. Computes the bounding box of all node outer edges + group bounds
 * 2. If span exceeds 1.0 on either axis: uniformly scales ALL positions AND sizes
 *    by `usableArea / max(spanX, spanY)` — preserving aspect ratios
 * 3. Translates positions so the bounding box is centered in [0..1]
 * 4. Flips Y: Cartesian +Y (up) → NVS y=0 (top)
 *
 * @param nodes          Node list with NVS-scale positions (Cartesian Y-up)
 * @param groups         Group bounds map (Cartesian Y-up, GroupBounds.y = bottom)
 * @param defaultNodeSize Theme default node size — used for thickness normalization
 */
export function normalizeToViewport(
  nodes: ReadonlyArray<{ id: string; position: RawPosition; size: RawSize }>,
  groups: Map<string, GroupBounds>,
  defaultNodeSize: readonly [number, number] = [0.15, 0.08],
): NormalizeToViewportResult {
  // Step 1: Compute bounding box of all node outer edges + group bounds.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const [px, py] = node.position;
    const [sw, sh] = node.size;
    minX = Math.min(minX, px - sw / 2);
    maxX = Math.max(maxX, px + sw / 2);
    minY = Math.min(minY, py - sh / 2);
    maxY = Math.max(maxY, py + sh / 2);
  }

  for (const bounds of groups.values()) {
    if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) continue;
    if (bounds.w <= 0 && bounds.h <= 0) continue;
    minX = Math.min(minX, bounds.x);
    maxX = Math.max(maxX, bounds.x + bounds.w);
    minY = Math.min(minY, bounds.y);
    maxY = Math.max(maxY, bounds.y + bounds.h);
  }

  // Degenerate case: no nodes and no non-empty groups.
  if (!Number.isFinite(minX)) {
    return {
      normalizedPositions: new Map(),
      normalizedSizes: new Map(),
      normalizedGroups: new Map(),
      thicknessNormFactor: Math.max(defaultNodeSize[0], defaultNodeSize[1]),
    };
  }

  // Step 2: Determine uniform scale factor.
  // If the layout bounding box exceeds [0..1] on either axis, scale everything down
  // uniformly so it fits within the usable area (1.0 - 2 * margin per axis).
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const usableArea = 1.0 - 2 * SCALE_TO_FIT_MARGIN;  // 0.96
  const maxSpan = Math.max(spanX, spanY);
  const scaleFactor = maxSpan > usableArea ? usableArea / maxSpan : 1.0;

  // Step 3: Apply scale to all positions and sizes, compute new bounding box center.
  // Scale around the layout's center to keep relative positions intact.
  const layoutCenterX = (minX + maxX) / 2;
  const layoutCenterY = (minY + maxY) / 2;

  // After scaling, the new center in layout space is still (layoutCenterX, layoutCenterY).
  // We want to map this to NVS [0.5, 0.5].
  // For a point P: scaled_P = layoutCenter + (P - layoutCenter) * scaleFactor
  // Then: nvs_P = scaled_P + (0.5 - layoutCenter)
  // Simplified: nvs_P = (P - layoutCenter) * scaleFactor + 0.5

  // Step 4: Normalize positions (scale + center + Y-flip: Cartesian Y-up → NVS Y-down).
  const normalizedPositions = new Map<string, RawPosition>();
  const normalizedSizes = new Map<string, RawSize>();
  for (const node of nodes) {
    const [px, py, pz] = node.position;
    const nx = (px - layoutCenterX) * scaleFactor + 0.5;
    const ny = 1 - ((py - layoutCenterY) * scaleFactor + 0.5);  // Y-flip
    normalizedPositions.set(node.id, [nx, ny, pz]);
    // Scale sizes uniformly (only changes when scaleFactor < 1)
    normalizedSizes.set(node.id, [node.size[0] * scaleFactor, node.size[1] * scaleFactor]);
  }

  // Step 5: Normalize group bounds (scale + center + Y-flip).
  const normalizedGroups = new Map<string, GroupBounds>();
  for (const [groupId, bounds] of groups) {
    // Scale group position relative to layout center
    const scaledX = (bounds.x - layoutCenterX) * scaleFactor + 0.5;
    const cartesianTop = bounds.y + bounds.h;
    const scaledTop = (cartesianTop - layoutCenterY) * scaleFactor + 0.5;
    const nvsY = 1 - scaledTop;  // Y-flip
    const scaledW = bounds.w * scaleFactor;
    const scaledH = bounds.h * scaleFactor;
    normalizedGroups.set(groupId, {
      x: scaledX,
      y: nvsY,
      w: scaledW,
      h: scaledH,
      padding: bounds.padding,    // padding stays as authored NVS fraction
      titleGap: bounds.titleGap,  // titleGap stays as authored NVS fraction
    });
  }

  return {
    normalizedPositions,
    normalizedSizes,
    normalizedGroups,
    thicknessNormFactor: scaleFactor * Math.max(defaultNodeSize[0], defaultNodeSize[1]),
  };
}
