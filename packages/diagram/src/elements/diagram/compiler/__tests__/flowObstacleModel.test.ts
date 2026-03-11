import { describe, expect, it } from 'vitest';
import { buildFlowObstacleModel } from '../flowObstacleModel';

describe('buildFlowObstacleModel', () => {
  it('builds node and group obstacles and excludes source and destination nodes', () => {
    const positions = new Map<string, readonly [number, number, number]>([
      ['src', [0, 0, 0]],
      ['dst', [8, 0, 0]],
      ['node-obstacle', [4, 0, 0]],
      ['group-obstacle', [4, 4, 0]],
    ]);
    const sizes = new Map<string, readonly [number, number, number]>([
      ['src', [2, 2, 1]],
      ['dst', [2, 2, 1]],
      ['node-obstacle', [2, 2, 1]],
      ['group-obstacle', [6, 4, 0.01]],
    ]);

    const model = buildFlowObstacleModel({
      positions,
      sizes,
      sourceId: 'src',
      destinationId: 'dst',
      sourceAnchor: [1, 0, 0],
      destinationAnchor: [7, 0, 0],
      obstaclePadding: 0.025,
    });

    expect(model.obstacles.map((obstacle) => obstacle.id)).toEqual(['node-obstacle', 'group-obstacle']);
    expect(model.obstacles.find((obstacle) => obstacle.id === 'node-obstacle')?.hard).toBe(true);
    expect(model.obstacles.find((obstacle) => obstacle.id === 'group-obstacle')?.kind).toBe('group');
  });

  it('tracks source and destination owning groups separately', () => {
    const positions = new Map<string, readonly [number, number, number]>([
      ['shared-group', [0, 0, 0]],
      ['source-group', [-4, 0, 0]],
      ['destination-group', [4, 0, 0]],
    ]);
    const sizes = new Map<string, readonly [number, number, number]>([
      ['shared-group', [20, 8, 0.01]],
      ['source-group', [6, 6, 0.01]],
      ['destination-group', [6, 6, 0.01]],
    ]);

    const model = buildFlowObstacleModel({
      positions,
      sizes,
      sourceId: 'src',
      destinationId: 'dst',
      sourceAnchor: [-4, 0, 0],
      destinationAnchor: [4, 0, 0],
      obstaclePadding: 0,
    });

    expect([...model.sourceOwningGroupIds].sort()).toEqual(['shared-group', 'source-group']);
    expect([...model.destinationOwningGroupIds].sort()).toEqual(['destination-group', 'shared-group']);
  });

  it('allows both source and destination ancestry corridors on a shared parent group', () => {
    const positions = new Map<string, readonly [number, number, number]>([
      ['shared-parent', [0, 0, 0]],
    ]);
    const sizes = new Map<string, readonly [number, number, number]>([
      ['shared-parent', [20, 10, 0.01]],
    ]);

    const model = buildFlowObstacleModel({
      positions,
      sizes,
      sourceId: 'src',
      destinationId: 'dst',
      sourceAnchor: [-4, 0, 0],
      destinationAnchor: [4, 0, 0],
      sourceFace: 'left',
      destinationFace: 'right',
      routeStart: [-6, 0, 0],
      routeEnd: [6, 0, 0],
      obstaclePadding: 0.25,
    });

    expect(model.sourceOwningGroupIds.has('shared-parent')).toBe(true);
    expect(model.destinationOwningGroupIds.has('shared-parent')).toBe(true);
    expect(model.obstacles.find((obstacle) => obstacle.id === 'shared-parent')?.allowedCorridors).toHaveLength(2);
  });

  it('treats explicit group IDs as groups even when their depth exceeds the legacy threshold', () => {
    const positions = new Map<string, readonly [number, number, number]>([
      ['thick-group', [0, 0, 0]],
      ['node-obstacle', [8, 0, 0]],
    ]);
    const sizes = new Map<string, readonly [number, number, number]>([
      ['thick-group', [12, 8, 0.7]],
      ['node-obstacle', [2, 2, 1]],
    ]);

    const model = buildFlowObstacleModel({
      positions,
      sizes,
      groupIds: new Set(['thick-group']),
      sourceId: 'src',
      destinationId: 'dst',
      sourceAnchor: [0, 0, 0],
      destinationAnchor: [10, 0, 0],
      obstaclePadding: 0,
    });

    expect(model.obstacles.find((obstacle) => obstacle.id === 'thick-group')).toMatchObject({
      kind: 'group',
      hard: false,
    });
  });

  it('keeps a non-container destination group as an obstacle and only opens its ingress corridor', () => {
    const positions = new Map<string, readonly [number, number, number]>([
      ['src', [0, 0, 0]],
      ['target-group', [8, 0, 0]],
    ]);
    const sizes = new Map<string, readonly [number, number, number]>([
      ['src', [2, 2, 1]],
      ['target-group', [6, 6, 0.01]],
    ]);

    const model = buildFlowObstacleModel({
      positions,
      sizes,
      groupIds: new Set(['target-group']),
      obstacleGroupIds: new Set(['target-group']),
      sourceId: 'src',
      destinationId: 'target-group',
      sourceAnchor: [1, 0, 0],
      destinationAnchor: [5, 0, 0],
      sourceFace: 'right',
      destinationFace: 'left',
      routeStart: [2, 0, 0],
      routeEnd: [4, 0, 0],
      obstaclePadding: 0.25,
    });

    expect(model.destinationOwningGroupIds.has('target-group')).toBe(true);
    expect(model.obstacles.find((obstacle) => obstacle.id === 'target-group')).toMatchObject({
      kind: 'group',
      hard: false,
      softOwnerKind: 'destination-group',
    });
    expect(model.obstacles.find((obstacle) => obstacle.id === 'target-group')?.allowedCorridors).toHaveLength(1);
  });
});
