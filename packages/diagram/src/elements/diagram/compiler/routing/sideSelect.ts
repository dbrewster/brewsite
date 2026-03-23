// 2D side selection and port placement for the edge routing pipeline.

import type {
  SideId,
  Vec2,
  NodeRect,
  EdgeRoutingRequest,
  FlowConfig,
  BundleHint,
} from './routingTypes';
import {
  addVec2,
  scaleVec2,
  clamp,
  DEFAULT_FLOW_CONFIG,
} from './routingTypes';

// ─── Exported types ──────────────────────────────────────────────────────────

/** Result of side selection for a single edge. */
export type SideSelection = {
  readonly sourceSide: SideId;
  readonly destinationSide: SideId;
  readonly sourceAnchor: Vec2;
  readonly destinationAnchor: Vec2;
  readonly sourceStub: Vec2;
  readonly destinationStub: Vec2;
};

// ─── Pure geometry helpers ───────────────────────────────────────────────────

/**
 * Outward unit normal for a side in the 2D plane.
 */
export function sideNormal(side: SideId): Vec2 {
  switch (side) {
    case 'left':   return [-1, 0];
    case 'right':  return [1, 0];
    case 'top':    return [0, 1];
    case 'bottom': return [0, -1];
  }
}

/**
 * Center point of a side on a node rect.
 */
export function sideCenter(rect: NodeRect, side: SideId): Vec2 {
  switch (side) {
    case 'left':   return [rect.cx - rect.hw, rect.cy];
    case 'right':  return [rect.cx + rect.hw, rect.cy];
    case 'top':    return [rect.cx, rect.cy + rect.hh];
    case 'bottom': return [rect.cx, rect.cy - rect.hh];
  }
}

/**
 * Nearest side for a node, considering aspect ratio.
 * Pure 2D: compares |dx|/halfW vs |dy|/halfH. No Z.
 *
 * Degenerate cases:
 * - When |dx|/halfW === |dy|/halfH (equal magnitudes): prefer vertical (top/bottom).
 * - When dx === 0 and dy === 0 (co-located nodes): return 'top'.
 */
export function nearestSide(from: Vec2, to: Vec2, halfW: number, halfH: number): SideId {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];

  // Co-located: return 'top' as fallback.
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return 'top';

  // Normalize by half-dimension to get aspect-ratio-weighted magnitudes.
  // Guard against zero half-dimensions by treating as very large (forces that axis).
  const nx = halfW > 1e-9 ? Math.abs(dx) / halfW : Infinity;
  const ny = halfH > 1e-9 ? Math.abs(dy) / halfH : Infinity;

  // Prefer vertical when equal (ny >= nx means horizontal dominates — use left/right).
  if (nx > ny) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'top' : 'bottom';
}

/**
 * Compute port anchor on a side, offset laterally for multi-port spreading.
 * portIndex/portCount control lateral distribution along the side span.
 */
export function portAnchor(
  rect: NodeRect,
  side: SideId,
  portIndex: number,
  portCount: number,
): Vec2 {
  if (portCount <= 1) return sideCenter(rect, side);

  // Compute a lateral parameter t ∈ (0, 1) evenly distributed.
  const t = (portIndex + 1) / (portCount + 1);

  switch (side) {
    case 'left':
    case 'right': {
      const x = side === 'left' ? rect.cx - rect.hw : rect.cx + rect.hw;
      const yMin = rect.cy - rect.hh;
      const ySpan = rect.hh * 2;
      return [x, yMin + ySpan * t];
    }
    case 'top':
    case 'bottom': {
      const y = side === 'top' ? rect.cy + rect.hh : rect.cy - rect.hh;
      const xMin = rect.cx - rect.hw;
      const xSpan = rect.hw * 2;
      return [xMin + xSpan * t, y];
    }
  }
}

// ─── Side selection ──────────────────────────────────────────────────────────

/**
 * Select exit/entry sides and compute anchor points for a single edge.
 *
 * Algorithm:
 * 1. If ports are locked (fromPort/toPort DSL props), use them directly.
 * 2. Otherwise, pick sides by comparing the XY delta between node centers
 *    against each node's aspect ratio (nearest-side-for-node).
 * 3. For bundle hints (sibling flow edges sharing a source), lock the source
 *    side to the hinted side and compute a lateral-offset anchor.
 * 4. Compute anchor point: center of the selected side, optionally offset
 *    laterally toward the target for multi-edge port spreading.
 * 5. Compute stub point: anchor + sideNormal * stubLength.
 */
export function selectSides(
  request: EdgeRoutingRequest,
  fromRect: NodeRect,
  toRect: NodeRect,
  bundleHint?: BundleHint,
  config?: FlowConfig,
): SideSelection {
  const cfg = config ?? DEFAULT_FLOW_CONFIG;
  const fromCenter: Vec2 = [fromRect.cx, fromRect.cy];
  const toCenter: Vec2 = [toRect.cx, toRect.cy];

  // 1. Determine source side.
  let sourceSide: SideId;
  if (request.fromPort) {
    sourceSide = request.fromPort;
  } else if (bundleHint) {
    sourceSide = bundleHint.sourceSide;
  } else {
    sourceSide = nearestSide(fromCenter, toCenter, fromRect.hw, fromRect.hh);
  }

  // 2. Determine destination side.
  let destinationSide: SideId;
  if (request.toPort) {
    destinationSide = request.toPort;
  } else {
    destinationSide = nearestSide(toCenter, fromCenter, toRect.hw, toRect.hh);
  }

  // 3. Compute source anchor (with optional bundle lateral offset).
  let sourceAnchor: Vec2;
  if (bundleHint && Math.abs(bundleHint.lateralOffset) > 1e-9) {
    const center = sideCenter(fromRect, sourceSide);
    // Lateral offset is perpendicular to the side normal.
    const lateral = lateralDirection(sourceSide);
    sourceAnchor = addVec2(center, scaleVec2(lateral, bundleHint.lateralOffset));
    // Clamp to side bounds to prevent overshoot.
    sourceAnchor = clampToSideBounds(fromRect, sourceSide, sourceAnchor);
  } else {
    sourceAnchor = sideCenter(fromRect, sourceSide);
  }

  // 4. Compute destination anchor.
  const destinationAnchor = sideCenter(toRect, destinationSide);

  // 5. Compute stub points (anchor + normal * stubLength).
  const stubLength = cfg.faceStub;
  const sourceStub = addVec2(sourceAnchor, scaleVec2(sideNormal(sourceSide), stubLength));
  const destinationStub = addVec2(destinationAnchor, scaleVec2(sideNormal(destinationSide), stubLength));

  return {
    sourceSide,
    destinationSide,
    sourceAnchor,
    destinationAnchor,
    sourceStub,
    destinationStub,
  };
}

// ─── Bundle inference ────────────────────────────────────────────────────────

/**
 * Infer bundle hints for sibling flow edges sharing the same source node.
 * Groups edges by source node, assigns shared source side + lateral offsets.
 * Ported from old `inferBundleHints()` in `edgeCandidatePlanner.ts` — uses
 * `SideId`/`Vec2`/`NodeRect` instead of `FaceId`/`Vec3`/`NodeDimensions`.
 */
export function inferBundleHints(
  edges: ReadonlyArray<EdgeRoutingRequest>,
  nodeRects: ReadonlyMap<string, NodeRect>,
): Map<string, BundleHint> {
  const result = new Map<string, BundleHint>();

  // Group flow edges by source node (ignore edges with explicit fromPort).
  const outgoing = new Map<string, EdgeRoutingRequest[]>();
  for (const edge of edges) {
    if (edge.profile !== 'flow' || edge.fromPort) continue;
    const group = outgoing.get(edge.fromId) ?? [];
    group.push(edge);
    outgoing.set(edge.fromId, group);
  }

  outgoing.forEach((group, sourceId) => {
    if (group.length < 2) return;
    const sourceRect = nodeRects.get(sourceId);
    if (!sourceRect) return;

    const sourceCenter: Vec2 = [sourceRect.cx, sourceRect.cy];
    const verticalTolerance = Math.max(0.04, sourceRect.hh * 2 * 0.08);

    // Determine if targets fan out to both left and right of the source.
    let hasLeft = false;
    let hasRight = false;
    let allPositiveY = true;
    let allNegativeY = true;

    for (const edge of group) {
      const targetRect = nodeRects.get(edge.toId);
      if (!targetRect) return;

      if (targetRect.cx < sourceRect.cx - sourceRect.hw * 0.2) hasLeft = true;
      if (targetRect.cx > sourceRect.cx + sourceRect.hw * 0.2) hasRight = true;

      const dy = targetRect.cy - sourceRect.cy;
      if (dy <= verticalTolerance) allPositiveY = false;
      if (dy >= -verticalTolerance) allNegativeY = false;
    }

    // Only bundle if targets span both sides and are all above or all below.
    if (!hasLeft || !hasRight) return;
    if (!allPositiveY && !allNegativeY) return;

    const sourceSide: SideId = allPositiveY ? 'top' : 'bottom';
    const sharedTrunkKey = `${sourceId}:${sourceSide}`;

    // All bundled edges share the same source anchor (center of source side)
    // with zero lateral offset. This ensures they start from the same point
    // so the A* produces overlapping leading segments that the trunk optimizer
    // can detect and trim — rendering a single shared pipe until the split.
    for (const edge of group) {
      result.set(edge.id, {
        sourceSide,
        lateralOffset: 0,
        sharedTrunkKey,
      });
    }
  });

  return result;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Get the lateral (tangent) direction for a side — perpendicular to the normal. */
function lateralDirection(side: SideId): Vec2 {
  switch (side) {
    case 'left':
    case 'right':  return [0, 1];
    case 'top':
    case 'bottom': return [1, 0];
  }
}

/** Clamp an anchor point to the bounds of a side on a rect. */
function clampToSideBounds(rect: NodeRect, side: SideId, anchor: Vec2): Vec2 {
  switch (side) {
    case 'left':
    case 'right':
      return [anchor[0], clamp(anchor[1], rect.cy - rect.hh, rect.cy + rect.hh)];
    case 'top':
    case 'bottom':
      return [clamp(anchor[0], rect.cx - rect.hw, rect.cx + rect.hw), anchor[1]];
  }
}
