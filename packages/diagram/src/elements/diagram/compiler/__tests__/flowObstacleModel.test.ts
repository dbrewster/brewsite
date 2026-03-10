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
});
