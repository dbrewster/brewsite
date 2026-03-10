// Coordinate-system normalization between Y-down NVS space and Y-up router space.

import type { Vec3, NodeDimensions, RoutingNodeMap, EdgeRouteState } from './routingTypes';

/** Negate the Y component of a Vec3. Y-down NVS ↔ Y-up router space (symmetric). */
export function mirrorVecY(v: Vec3): Vec3 {
  return [v[0], -v[1], v[2]];
}

/**
 * Build a unified RoutingNodeMap in router Y-up space from separate NVS position
 * and size maps. Applies mirrorVecY to every position; sizes are unchanged.
 */
export function buildRoutingNodeMap(
  positions: ReadonlyMap<string, Vec3>,
  sizes: ReadonlyMap<string, NodeDimensions>,
): RoutingNodeMap {
  const map = new Map<string, { readonly position: Vec3; readonly size: NodeDimensions }>();
  positions.forEach((pos, id) => {
    const size = sizes.get(id);
    if (size) {
      map.set(id, { position: mirrorVecY(pos), size });
    }
  });
  return map;
}

const mirrorPathCommandY = (
  command: EdgeRouteState['path']['commands'][number],
): EdgeRouteState['path']['commands'][number] => {
  if (command.kind === 'line') {
    return {
      kind: 'line',
      from: mirrorVecY(command.from),
      to: mirrorVecY(command.to),
    };
  }
  return {
    kind: 'cubic',
    p0: mirrorVecY(command.p0),
    p1: mirrorVecY(command.p1),
    p2: mirrorVecY(command.p2),
    p3: mirrorVecY(command.p3),
  };
};

/**
 * Mirror all Vec3 coordinates in a single EdgeRouteState back from router Y-up
 * space to caller Y-down NVS space. Called per-route by routeEdgesYDown().
 */
export function denormalizeEdgeRoute(route: EdgeRouteState): EdgeRouteState {
  return {
    path: {
      ...route.path,
      commands: route.path.commands.map(mirrorPathCommandY),
      startTangent: mirrorVecY(route.path.startTangent),
      endTangent: mirrorVecY(route.path.endTangent),
    },
    controlPoints: route.controlPoints.map(mirrorVecY),
    pathDebug: route.pathDebug,
  };
}
