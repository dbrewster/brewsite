// Pure coordinate transformation: diagram-unit positions → [0..1] NVS space.
// Extracted from compile.ts so that it can be independently imported and unit-tested.

import type { GroupBounds } from './groupCompiler';

/** Internal convenience aliases. */
type RawPosition = readonly [number, number, number];
type RawSize = readonly [number, number];

/**
 * Output of `normalizeToViewport`. All positions, sizes, and group bounds are
 * expressed in [0..1] NVS (Normalized Viewport Space) with the Y axis pointing down
 * (NVS y=0 = top, NVS y=1 = bottom).
 */
export type NormalizeToViewportResult = {
  readonly normalizedPositions: Map<string, RawPosition>;
  readonly normalizedSizes: Map<string, RawSize>;
  readonly normalizedGroups: Map<string, GroupBounds>;
  readonly contentAspect: number;
};

/**
 * Converts diagram-unit node positions and group bounds to [0..1] NVS space.
 * Y axis is flipped: Cartesian +Y (up) → NVS y=0 (top).
 *
 * @param nodes     Node list with diagram-unit positions (Cartesian Y-up)
 * @param groups    Group bounds map in diagram units (GroupBounds.y = Cartesian bottom)
 * @param padding   The resolved padding in diagram units (used for bounding-box expansion)
 * @returns         Normalized positions, sizes, and group bounds in [0..1] NVS
 */
export function normalizeToViewport(
  nodes: ReadonlyArray<{ id: string; position: RawPosition; size: RawSize }>,
  groups: Map<string, GroupBounds>,
  padding: number,
): NormalizeToViewportResult {
  // Step 1: Compute bounding box of all node outer edges.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const [px, py] = node.position;
    const [sw, sh] = node.size;
    minX = Math.min(minX, px - sw / 2);
    maxX = Math.max(maxX, px + sw / 2);
    minY = Math.min(minY, py - sh / 2);
    maxY = Math.max(maxY, py + sh / 2);
  }

  // Step 1b: Expand the fit extents to include full group bounds.
  // Group bounds already include resolved group padding/title band space.
  for (const bounds of groups.values()) {
    if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) continue;
    if (!Number.isFinite(bounds.w) || !Number.isFinite(bounds.h)) continue;
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
      contentAspect: 1.0,
    };
  }

  // Step 2: Expand by padding
  const spanX = (maxX - minX) + 2 * padding;
  const spanY = (maxY - minY) + 2 * padding;
  const originX = minX - padding;
  const originY = minY - padding;  // BOTTOM of diagram in Cartesian Y-up

  // Guard against degenerate diagrams (single node with zero size)
  const safeSpanX = spanX > 0 ? spanX : 1;
  const safeSpanY = spanY > 0 ? spanY : 1;

  // Step 3: Normalize node positions (with Y-flip: Cartesian Y-up → NVS Y-down)
  const normalizedPositions = new Map<string, RawPosition>();
  const normalizedSizes = new Map<string, RawSize>();
  for (const node of nodes) {
    const [px, py, pz] = node.position;
    const [sw, sh] = node.size;
    const nx = (px - originX) / safeSpanX;
    const ny = 1 - (py - originY) / safeSpanY;   // Y-flip: Cartesian up → NVS down
    normalizedPositions.set(node.id, [nx, ny, pz]);
    normalizedSizes.set(node.id, [sw / safeSpanX, sh / safeSpanY]);
  }

  // Step 4: Normalize group bounds
  // GroupBounds.y is Cartesian BOTTOM (Y-up) pre-normalization.
  // After Y-flip, NVS top = 1 - (Cartesian top - originY) / safeSpanY
  const normalizedGroups = new Map<string, GroupBounds>();
  for (const [groupId, bounds] of groups) {
    const nvsX = (bounds.x - originX) / safeSpanX;
    const cartesianTop = bounds.y + bounds.h;
    const nvsY = 1 - (cartesianTop - originY) / safeSpanY;  // Y-flip: Cartesian top → NVS top
    const nvsW = bounds.w / safeSpanX;
    const nvsH = bounds.h / safeSpanY;
    const [pt, pr, pb, pl] = bounds.padding;
    normalizedGroups.set(groupId, {
      x: nvsX,
      y: nvsY,
      w: nvsW,
      h: nvsH,
      padding: [pt / safeSpanY, pr / safeSpanX, pb / safeSpanY, pl / safeSpanX],
      titleGap: bounds.titleGap / safeSpanY,
    });
  }

  return { normalizedPositions, normalizedSizes, normalizedGroups, contentAspect: safeSpanX / safeSpanY };
}
