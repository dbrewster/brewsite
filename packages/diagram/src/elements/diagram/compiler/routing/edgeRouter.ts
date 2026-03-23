// Thin orchestrator: side select → obstacles → A* → pathBuilder → Z → snap → optimize.

import type { DiagramEdgePathState, DiagramEdgePathDebug, DiagramWarnFn } from '../../types';
import type {
  EdgeRoutingRequest,
  NodeRect,
  FlowConfig,
  EdgeRouteResult,
  Vec2,
  Vec3,
} from './routingTypes';
import { sideToApproach, DEFAULT_FLOW_CONFIG } from './routingTypes';
import { selectSides, sideNormal, inferBundleHints } from './sideSelect';
import { buildObstacles } from './obstacleModel';
import { routeOrthogonal } from './orthogonalRouter';
import type { PathCommand2D } from './pathBuilder';
import {
  buildFlowPath,
  buildCurvedPath,
  buildStraightPath,
  buildOrganicPath,
  assignDepth,
  commandsToControlPoints,
} from './pathBuilder';
// ─── Types ──────────────────────────────────────────────────────────────────

/** Input edge for the routing orchestrator (identical to EdgeRoutingRequest). */
export type EdgeRoutingInput = EdgeRoutingRequest;

// ─── Empty route constant ─────────────────────────────────────────────────

const EMPTY_PATH: DiagramEdgePathState = {
  commands: [],
  startTangent: [0, 0, 0],
  endTangent: [0, 0, 0],
  punctures: [],
};

const EMPTY_ROUTE: EdgeRouteResult = {
  path: EMPTY_PATH,
  controlPoints: [],
};

// ─── Y-mirror helpers (inline, no separate module) ──────────────────────────

/** Negate cy on each NodeRect. Y-down NVS → Y-up router space. */
function mirrorNodeRectsY(rects: ReadonlyMap<string, NodeRect>): Map<string, NodeRect> {
  const mirrored = new Map<string, NodeRect>();
  for (const [id, r] of rects) {
    mirrored.set(id, { ...r, cy: -r.cy });
  }
  return mirrored;
}

/** Negate Y on all path command points. Y-up router space → Y-down NVS. */
function mirrorCommandsY(
  commands: ReadonlyArray<import('../../types').DiagramEdgePathCommand>,
): ReadonlyArray<import('../../types').DiagramEdgePathCommand> {
  return commands.map((cmd) => {
    if (cmd.kind === 'line') {
      return {
        kind: 'line' as const,
        from: [cmd.from[0], -cmd.from[1], cmd.from[2]] as const,
        to: [cmd.to[0], -cmd.to[1], cmd.to[2]] as const,
      };
    }
    return {
      kind: 'cubic' as const,
      p0: [cmd.p0[0], -cmd.p0[1], cmd.p0[2]] as const,
      p1: [cmd.p1[0], -cmd.p1[1], cmd.p1[2]] as const,
      p2: [cmd.p2[0], -cmd.p2[1], cmd.p2[2]] as const,
      p3: [cmd.p3[0], -cmd.p3[1], cmd.p3[2]] as const,
    };
  });
}

/** Negate Y on a Vec3. */
function mirrorVec3Y(v: Vec3): Vec3 {
  return [v[0], -v[1], v[2]];
}

/** Negate Y in an EdgeRouteResult. Y-up router space → Y-down NVS. */
function mirrorRouteY(result: EdgeRouteResult): EdgeRouteResult {
  const commands = mirrorCommandsY(result.path.commands);
  const startTangent = mirrorVec3Y(result.path.startTangent as Vec3);
  const endTangent = mirrorVec3Y(result.path.endTangent as Vec3);
  return {
    path: {
      ...result.path,
      commands,
      startTangent,
      endTangent,
    },
    controlPoints: result.controlPoints.map(mirrorVec3Y),
    pathDebug: result.pathDebug,
  };
}

// ─── Tangent extraction ─────────────────────────────────────────────────────

/** Extract start tangent from the first path command. */
function extractStartTangent(
  commands: ReadonlyArray<import('../../types').DiagramEdgePathCommand>,
): readonly [number, number, number] {
  if (commands.length === 0) return [0, 0, 0];
  const cmd = commands[0]!;
  if (cmd.kind === 'line') {
    const dx = cmd.to[0] - cmd.from[0];
    const dy = cmd.to[1] - cmd.from[1];
    const dz = cmd.to[2] - cmd.from[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-9) return [0, 0, 0];
    return [dx / len, dy / len, dz / len];
  }
  // cubic: tangent from p0 → p1
  const dx = cmd.p1[0] - cmd.p0[0];
  const dy = cmd.p1[1] - cmd.p0[1];
  const dz = cmd.p1[2] - cmd.p0[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-9) return [0, 0, 0];
  return [dx / len, dy / len, dz / len];
}

/** Extract end tangent from the last path command. */
function extractEndTangent(
  commands: ReadonlyArray<import('../../types').DiagramEdgePathCommand>,
): readonly [number, number, number] {
  if (commands.length === 0) return [0, 0, 0];
  const cmd = commands[commands.length - 1]!;
  if (cmd.kind === 'line') {
    const dx = cmd.to[0] - cmd.from[0];
    const dy = cmd.to[1] - cmd.from[1];
    const dz = cmd.to[2] - cmd.from[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-9) return [0, 0, 0];
    return [dx / len, dy / len, dz / len];
  }
  // cubic: tangent from p2 → p3
  const dx = cmd.p3[0] - cmd.p2[0];
  const dy = cmd.p3[1] - cmd.p2[1];
  const dz = cmd.p3[2] - cmd.p2[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-9) return [0, 0, 0];
  return [dx / len, dy / len, dz / len];
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Route all edges in a diagram. Pure 2D routing with post-hoc Z assignment.
 *
 * Positions are Y-down NVS. Results are Y-down NVS with Z at mid-depth.
 */
export function routeEdges(
  edges: ReadonlyArray<EdgeRoutingInput>,
  nodeRects: ReadonlyMap<string, NodeRect>,
  groupIds: ReadonlySet<string>,
  obstacleGroupIds: ReadonlySet<string>,
  config: FlowConfig = DEFAULT_FLOW_CONFIG,
  onWarn?: DiagramWarnFn,
): Map<string, EdgeRouteResult> {
  const results = new Map<string, EdgeRouteResult>();

  // 1. Mirror Y-down NVS to Y-up router space
  const routerRects = mirrorNodeRectsY(nodeRects);

  // 2. Build EdgeRoutingRequests for inferBundleHints
  const bundleHints = inferBundleHints(edges, routerRects);

  // 3. Route each edge
  for (const edge of edges) {
    // Self-loop: emit an empty route. sideSelect is NOT called for self-loops.
    if (edge.fromId === edge.toId) {
      results.set(edge.id, EMPTY_ROUTE);
      continue;
    }

    const fromRect = routerRects.get(edge.fromId);
    const toRect = routerRects.get(edge.toId);

    // Missing endpoint: warn + empty route.
    if (!fromRect || !toRect) {
      if (onWarn) {
        const missing = !fromRect ? edge.fromId : edge.toId;
        onWarn('MISSING_EDGE_ENDPOINT', `Edge "${edge.id}": endpoint node "${missing}" not found.`);
      }
      results.set(edge.id, EMPTY_ROUTE);
      continue;
    }

    // a. Select sides + anchors (2D)
    const sides = selectSides(edge, fromRect, toRect, bundleHints.get(edge.id), config);

    // b. Build per-edge obstacle model with containment corridors
    const obstacles = buildObstacles(
      routerRects, groupIds, obstacleGroupIds,
      edge.fromId, edge.toId,
      sides.sourceAnchor, sides.destinationAnchor,
      sides.sourceSide, sides.destinationSide,
      config.obstaclePadding,
    );

    // c. Route in 2D — ALL profiles go through A* for collision avoidance
    const route = routeOrthogonal(
      sides.sourceStub, sides.destinationStub,
      obstacles.obstacles,
      sideToApproach(sides.destinationSide),
      { turnPenalty: config.turnPenalty, punchthroughPenalty: config.punchthroughPenalty },
    );

    // d. Build path commands — profile controls smoothing, not routing
    // For flow and straight profiles, prepend source anchor and append dest anchor
    // so the path starts/ends at the node face, not at the stubs.
    const fullWaypoints: ReadonlyArray<Vec2> = [
      sides.sourceAnchor,
      ...route.waypoints,
      sides.destinationAnchor,
    ];

    let commands2D: ReadonlyArray<PathCommand2D>;
    if (edge.profile === 'flow') {
      commands2D = buildFlowPath(fullWaypoints, config.turnRadius);
    } else if (edge.profile === 'curved') {
      commands2D = buildCurvedPath(
        sides.sourceAnchor, sides.destinationAnchor,
        sideNormal(sides.sourceSide), sideNormal(sides.destinationSide),
        route.waypoints,
      );
    } else if (edge.profile === 'organic') {
      commands2D = buildOrganicPath(
        sides.sourceAnchor, sides.destinationAnchor,
        sideNormal(sides.sourceSide), sideNormal(sides.destinationSide),
        route.waypoints, edge.id, config.organicVariation,
      );
    } else {
      // straight (or any unrecognized profile)
      commands2D = buildStraightPath(
        sides.sourceAnchor, sides.destinationAnchor,
        fullWaypoints, config.turnRadius,
      );
    }

    // e. Assign Z (smoothstep from source mid-depth to dest mid-depth)
    const commands3D = assignDepth(commands2D, fromRect.z, toRect.z, fromRect.depth, toRect.depth);

    // f. Extract tangents
    const startTangent = extractStartTangent(commands3D);
    const endTangent = extractEndTangent(commands3D);

    // h. Build route result and mirror Y back to NVS
    const routeResult: EdgeRouteResult = {
      path: {
        commands: commands3D,
        startTangent,
        endTangent,
        punctures: route.punctures.map((p) => ({
          obstacleId: p.obstacleId,
          obstacleKind: 'node' as const,
        })),
      },
      controlPoints: commandsToControlPoints(commands3D),
      pathDebug: {
        routeKind: route.bendCount === 0 ? 'direct' : 'visibility',
        obstacleIds: route.punctures.map((p) => p.obstacleId),
      },
    };

    results.set(edge.id, mirrorRouteY(routeResult));
  }

  return results;
}
