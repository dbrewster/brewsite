// 2D obstacle rect construction with containment tiers for edge routing.

import type { SideId, Vec2, Rect2D, NodeRect } from './routingTypes';

// ─── Exported types ──────────────────────────────────────────────────────────

/** A 2D obstacle for the A* router. */
export type Obstacle = {
  readonly id: string;
  readonly kind: 'node' | 'group';
  readonly rect: Rect2D;               // tight bounding rect
  readonly expandedRect: Rect2D;       // rect + padding (nodes) or + padding * 1.35 (groups)
  readonly hard: boolean;              // true = node, false = group boundary
  readonly ownsEndpoint: boolean;      // true if this group contains the source or dest
  readonly allowedCorridors: ReadonlyArray<Rect2D>;  // narrow rects where the edge may cross
};

/** Result of building the obstacle model for a single edge. */
export type ObstacleModel = {
  readonly obstacles: ReadonlyArray<Obstacle>;
  readonly sourceOwningGroupIds: ReadonlySet<string>;
  readonly destOwningGroupIds: ReadonlySet<string>;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const GROUP_BOUNDARY_CLEARANCE_MULTIPLIER = 1.35;
const CORRIDOR_HALF_WIDTH_MIN = 0.1;

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Compute a tight 2D bounding rect from a NodeRect. */
function nodeRectToBounds(rect: NodeRect): Rect2D {
  return {
    left: rect.cx - rect.hw,
    right: rect.cx + rect.hw,
    top: rect.cy + rect.hh,
    bottom: rect.cy - rect.hh,
  };
}

/** Expand a rect outward by padding on all sides. */
function expandRect(rect: Rect2D, padding: number): Rect2D {
  return {
    left: rect.left - padding,
    right: rect.right + padding,
    top: rect.top + padding,
    bottom: rect.bottom - padding,
  };
}

/** Check if a 2D point lies inside (or on the boundary of) a rect. */
function pointInsideRect(point: Vec2, rect: Rect2D): boolean {
  return (
    point[0] >= rect.left &&
    point[0] <= rect.right &&
    point[1] >= rect.bottom &&
    point[1] <= rect.top
  );
}

/**
 * Compute the corridor rect for an endpoint that exits/enters through a group wall.
 * The corridor is a narrow axis-aligned rect from the anchor point outward along the side normal.
 */
function corridorForSide(
  groupRect: Rect2D,
  anchor: Vec2,
  side: SideId,
  padding: number,
): Rect2D {
  const halfWidth = Math.max(CORRIDOR_HALF_WIDTH_MIN, padding * 1.5);

  switch (side) {
    case 'left':
    case 'right':
      // Horizontal corridor: spans from anchor outward along X.
      return {
        left: side === 'left'
          ? groupRect.left - padding
          : anchor[0] - padding,
        right: side === 'right'
          ? groupRect.right + padding
          : anchor[0] + padding,
        bottom: Math.max(groupRect.bottom, anchor[1] - halfWidth),
        top: Math.min(groupRect.top, anchor[1] + halfWidth),
      };
    case 'top':
    case 'bottom':
      // Vertical corridor: spans from anchor outward along Y.
      return {
        left: Math.max(groupRect.left, anchor[0] - halfWidth),
        right: Math.min(groupRect.right, anchor[0] + halfWidth),
        bottom: side === 'bottom'
          ? groupRect.bottom - padding
          : anchor[1] - padding,
        top: side === 'top'
          ? groupRect.top + padding
          : anchor[1] + padding,
      };
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Build the 2D obstacle set for a single edge.
 *
 * Containment rules:
 * 1. Source and destination nodes are never obstacles (edges start/end there).
 * 2. Container groups (`variant="container"`) are invisible — not included.
 *    (compile.ts filters these out before calling the router, so `obstacleGroupIds`
 *    does not contain container groups.)
 * 3. Visible groups that contain the source or destination anchor get an
 *    allowed corridor: a narrow rect along the exit/entry side that lets
 *    the edge punch through the group wall near the anchor point.
 * 4. Visible groups unrelated to the edge are soft obstacles (lower penalty).
 * 5. All other nodes are hard obstacles (no crossing).
 *
 * Same-group endpoints: When source and destination are in the same group,
 * that group gets corridors for BOTH endpoints. No special case needed —
 * the existing corridor logic handles this naturally.
 */
export function buildObstacles(
  nodeRects: ReadonlyMap<string, NodeRect>,
  groupIds: ReadonlySet<string>,
  obstacleGroupIds: ReadonlySet<string>,
  sourceId: string,
  destId: string,
  sourceAnchor: Vec2,
  destAnchor: Vec2,
  sourceSide: SideId,
  destSide: SideId,
  padding: number,
): ObstacleModel {
  const obstacles: Obstacle[] = [];
  const sourceOwningGroupIds = new Set<string>();
  const destOwningGroupIds = new Set<string>();

  for (const [id, nodeRect] of nodeRects) {
    const isGroup = groupIds.has(id);
    const isObstacleGroup = isGroup && obstacleGroupIds.has(id);

    // Skip source/destination nodes (not groups that happen to be endpoints).
    if ((id === sourceId || id === destId) && !isObstacleGroup) continue;

    // Skip non-obstacle groups (container groups are not in obstacleGroupIds).
    if (isGroup && !isObstacleGroup) continue;

    const bounds = nodeRectToBounds(nodeRect);
    const obstaclePadding = isGroup
      ? padding * GROUP_BOUNDARY_CLEARANCE_MULTIPLIER
      : padding;
    const expandedRect = expandRect(bounds, obstaclePadding);

    // Determine containment — does this group own the source or dest?
    let ownsSource = false;
    let ownsDest = false;

    if (isGroup) {
      if (pointInsideRect(sourceAnchor, bounds)) {
        sourceOwningGroupIds.add(id);
        ownsSource = true;
      }
      if (pointInsideRect(destAnchor, bounds)) {
        destOwningGroupIds.add(id);
        ownsDest = true;
      }
    }

    const ownsEndpoint = ownsSource || ownsDest;

    // Build allowed corridors for groups that own endpoints.
    const allowedCorridors: Rect2D[] = [];
    if (ownsSource) {
      allowedCorridors.push(corridorForSide(bounds, sourceAnchor, sourceSide, obstaclePadding));
    }
    if (ownsDest) {
      allowedCorridors.push(corridorForSide(bounds, destAnchor, destSide, obstaclePadding));
    }

    obstacles.push({
      id,
      kind: isGroup ? 'group' : 'node',
      rect: bounds,
      expandedRect,
      hard: !isGroup,
      ownsEndpoint,
      allowedCorridors,
    });
  }

  return {
    obstacles,
    sourceOwningGroupIds,
    destOwningGroupIds,
  };
}
