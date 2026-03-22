type Vec3 = readonly [number, number, number];
type NodeDimensions = readonly [number, number, number];
type FaceId = 'left' | 'right' | 'top' | 'bottom';

export type Rect2D = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

export type FlowObstacle = {
  readonly id: string;
  readonly kind: 'node' | 'group';
  readonly rect: Rect2D;
  readonly rawRect: Rect2D;
  readonly expandedRect: Rect2D;
  readonly hard: boolean;
  readonly softOwnerKind?: 'source-group' | 'destination-group';
  readonly allowedCorridors: ReadonlyArray<Rect2D>;
};

export type FlowObstacleModel = {
  readonly obstacles: ReadonlyArray<FlowObstacle>;
  readonly sourceOwningGroupIds: ReadonlySet<string>;
  readonly destinationOwningGroupIds: ReadonlySet<string>;
};

type BuildFlowObstacleModelInput = {
  readonly positions: ReadonlyMap<string, Vec3>;
  readonly sizes: ReadonlyMap<string, NodeDimensions>;
  readonly groupIds?: ReadonlySet<string>;
  readonly obstacleGroupIds?: ReadonlySet<string>;
  readonly sourceId: string;
  readonly destinationId: string;
  readonly sourceAnchor: Vec3;
  readonly destinationAnchor: Vec3;
  readonly sourceFace?: FaceId;
  readonly destinationFace?: FaceId;
  readonly routeStart?: Vec3;
  readonly routeEnd?: Vec3;
  readonly obstaclePadding: number;
};

const GROUP_DEPTH_THRESHOLD = 0.02;
const GROUP_BOUNDARY_CLEARANCE_MULTIPLIER = 1.35;
const CORRIDOR_HALF_WIDTH_MIN = 0.1;

const pointInsideRect = (point: Vec3, rect: Rect2D): boolean =>
  point[0] >= rect.left &&
  point[0] <= rect.right &&
  point[1] >= rect.bottom &&
  point[1] <= rect.top;

const expandRect = (rect: Rect2D, padding: number): Rect2D => ({
  left: rect.left - padding,
  right: rect.right + padding,
  top: rect.top + padding,
  bottom: rect.bottom - padding,
});

const corridorForFace = (
  rect: Rect2D,
  anchor: Vec3,
  routePoint: Vec3 | undefined,
  face: FaceId | undefined,
  padding: number,
): Rect2D | undefined => {
  if (!face || !routePoint) return undefined;
  const halfWidth = Math.max(CORRIDOR_HALF_WIDTH_MIN, padding * 1.5);
  switch (face) {
    case 'left':
    case 'right':
      return {
        left: Math.min(anchor[0], routePoint[0]) - padding,
        right: Math.max(anchor[0], routePoint[0]) + padding,
        bottom: Math.max(rect.bottom, anchor[1] - halfWidth),
        top: Math.min(rect.top, anchor[1] + halfWidth),
      };
    case 'top':
    case 'bottom':
      return {
        left: Math.max(rect.left, anchor[0] - halfWidth),
        right: Math.min(rect.right, anchor[0] + halfWidth),
        bottom: Math.min(anchor[1], routePoint[1]) - padding,
        top: Math.max(anchor[1], routePoint[1]) + padding,
      };
  }
};

export function buildFlowObstacleModel(input: BuildFlowObstacleModelInput): FlowObstacleModel {
  const obstacles: FlowObstacle[] = [];
  const sourceOwningGroupIds = new Set<string>();
  const destinationOwningGroupIds = new Set<string>();

  for (const [id, pos] of input.positions) {
    const size = input.sizes.get(id);
    if (!size) continue;

    const isGroup = input.groupIds?.has(id) ?? size[2] <= GROUP_DEPTH_THRESHOLD;
    const isObstacleGroup = isGroup && (!input.obstacleGroupIds || input.obstacleGroupIds.has(id));
    const isEndpointGroupObstacle =
      isObstacleGroup &&
      (id === input.sourceId || id === input.destinationId);
    if ((id === input.sourceId || id === input.destinationId) && !isEndpointGroupObstacle) continue;

    const rawRect = {
      left: pos[0] - size[0] / 2,
      right: pos[0] + size[0] / 2,
      bottom: pos[1] - size[1] / 2,
      top: pos[1] + size[1] / 2,
    } satisfies Rect2D;

    if (isGroup && input.obstacleGroupIds && !input.obstacleGroupIds.has(id)) {
      continue;
    }
    const padding = isGroup
      ? input.obstaclePadding * GROUP_BOUNDARY_CLEARANCE_MULTIPLIER
      : input.obstaclePadding;
    const expandedRect = expandRect(rawRect, padding);
    let softOwnerKind: FlowObstacle['softOwnerKind'];

    if (isGroup && pointInsideRect(input.sourceAnchor, rawRect)) {
      sourceOwningGroupIds.add(id);
      softOwnerKind = 'source-group';
    }
    if (isGroup && pointInsideRect(input.destinationAnchor, rawRect)) {
      destinationOwningGroupIds.add(id);
      softOwnerKind = softOwnerKind ?? 'destination-group';
    }

    const allowedCorridors = [
      pointInsideRect(input.sourceAnchor, rawRect)
        ? corridorForFace(rawRect, input.sourceAnchor, input.routeStart, input.sourceFace, padding)
        : undefined,
      pointInsideRect(input.destinationAnchor, rawRect)
        ? corridorForFace(rawRect, input.destinationAnchor, input.routeEnd, input.destinationFace, padding)
        : undefined,
    ].filter((corridor): corridor is Rect2D => corridor !== undefined);

    obstacles.push({
      id,
      kind: isGroup ? 'group' : 'node',
      rect: expandedRect,
      rawRect,
      expandedRect,
      hard: !isGroup,
      softOwnerKind,
      allowedCorridors,
    });
  }

  return {
    obstacles,
    sourceOwningGroupIds,
    destinationOwningGroupIds,
  };
}
