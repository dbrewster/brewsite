type Vec3 = readonly [number, number, number];
type NodeDimensions = readonly [number, number, number];

export type FlowObstacle = {
  readonly id: string;
  readonly kind: 'node' | 'group';
  readonly rect: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  };
  readonly hard: boolean;
};

export type FlowObstacleModel = {
  readonly obstacles: ReadonlyArray<FlowObstacle>;
  readonly sourceOwningGroupIds: ReadonlySet<string>;
  readonly destinationOwningGroupIds: ReadonlySet<string>;
};

type BuildFlowObstacleModelInput = {
  readonly positions: ReadonlyMap<string, Vec3>;
  readonly sizes: ReadonlyMap<string, NodeDimensions>;
  readonly sourceId: string;
  readonly destinationId: string;
  readonly sourceAnchor: Vec3;
  readonly destinationAnchor: Vec3;
  readonly obstaclePadding: number;
};

const GROUP_DEPTH_THRESHOLD = 0.02;

const pointInsideRect = (
  point: Vec3,
  rect: FlowObstacle['rect'],
): boolean =>
  point[0] >= rect.left &&
  point[0] <= rect.right &&
  point[1] >= rect.bottom &&
  point[1] <= rect.top;

export function buildFlowObstacleModel(input: BuildFlowObstacleModelInput): FlowObstacleModel {
  const obstacles: FlowObstacle[] = [];
  const sourceOwningGroupIds = new Set<string>();
  const destinationOwningGroupIds = new Set<string>();

  for (const [id, pos] of input.positions) {
    if (id === input.sourceId || id === input.destinationId) continue;
    const size = input.sizes.get(id);
    if (!size) continue;

    const halfW = size[0] / 2 + input.obstaclePadding;
    const halfH = size[1] / 2 + input.obstaclePadding;
    const rect = {
      left: pos[0] - halfW,
      right: pos[0] + halfW,
      bottom: pos[1] - halfH,
      top: pos[1] + halfH,
    } as const;

    const kind = size[2] <= GROUP_DEPTH_THRESHOLD ? 'group' as const : 'node' as const;
    if (kind === 'group') {
      if (pointInsideRect(input.sourceAnchor, rect)) sourceOwningGroupIds.add(id);
      if (pointInsideRect(input.destinationAnchor, rect)) destinationOwningGroupIds.add(id);
    }

    obstacles.push({
      id,
      kind,
      rect,
      hard: kind === 'node',
    });
  }

  return {
    obstacles,
    sourceOwningGroupIds,
    destinationOwningGroupIds,
  };
}
