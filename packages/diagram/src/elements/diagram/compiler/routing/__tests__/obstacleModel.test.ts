// Tests for obstacleModel.ts — 2D obstacle construction with containment tiers.

import { describe, it, expect } from 'vitest';
import { buildObstacles } from '../obstacleModel';
import type { ObstacleModel, Obstacle } from '../obstacleModel';
import type { NodeRect, Vec2, SideId } from '../routingTypes';

// ─── Test helpers ────────────────────────────────────────────────────────────

const makeRect = (
  id: string,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  z = 0,
  depth = 0.1,
): NodeRect => ({ id, cx, cy, hw, hh, z, depth });

function findObstacle(model: ObstacleModel, id: string): Obstacle | undefined {
  return model.obstacles.find((o) => o.id === id);
}

// ─── Source/destination exclusion ────────────────────────────────────────────

describe('buildObstacles — endpoint exclusion', () => {
  it('excludes source and destination nodes', () => {
    const rects = new Map<string, NodeRect>([
      ['src', makeRect('src', 0, 0, 0.5, 0.5)],
      ['dst', makeRect('dst', 3, 0, 0.5, 0.5)],
      ['mid', makeRect('mid', 1.5, 0, 0.5, 0.5)],
    ]);
    const model = buildObstacles(
      rects, new Set(), new Set(),
      'src', 'dst',
      [0.5, 0] as Vec2, [2.5, 0] as Vec2,
      'right', 'left',
      0.025,
    );
    expect(findObstacle(model, 'src')).toBeUndefined();
    expect(findObstacle(model, 'dst')).toBeUndefined();
    expect(findObstacle(model, 'mid')).toBeDefined();
  });
});

// ─── Node obstacle classification ────────────────────────────────────────────

describe('buildObstacles — node obstacles', () => {
  it('classifies regular nodes as hard obstacles', () => {
    const rects = new Map<string, NodeRect>([
      ['src', makeRect('src', 0, 0, 0.5, 0.5)],
      ['dst', makeRect('dst', 4, 0, 0.5, 0.5)],
      ['mid', makeRect('mid', 2, 0, 0.5, 0.5)],
    ]);
    const model = buildObstacles(
      rects, new Set(), new Set(),
      'src', 'dst',
      [0.5, 0], [3.5, 0],
      'right', 'left',
      0.025,
    );
    const mid = findObstacle(model, 'mid')!;
    expect(mid.hard).toBe(true);
    expect(mid.kind).toBe('node');
    expect(mid.ownsEndpoint).toBe(false);
    expect(mid.allowedCorridors).toHaveLength(0);
  });

  it('expands node rects by padding', () => {
    const rects = new Map<string, NodeRect>([
      ['src', makeRect('src', 0, 0, 0.5, 0.5)],
      ['dst', makeRect('dst', 4, 0, 0.5, 0.5)],
      ['mid', makeRect('mid', 2, 0, 0.5, 0.5)],
    ]);
    const padding = 0.1;
    const model = buildObstacles(
      rects, new Set(), new Set(),
      'src', 'dst',
      [0.5, 0], [3.5, 0],
      'right', 'left',
      padding,
    );
    const mid = findObstacle(model, 'mid')!;
    // Tight rect: left=1.5, right=2.5, bottom=-0.5, top=0.5
    // Expanded: left=1.4, right=2.6, bottom=-0.6, top=0.6
    expect(mid.rect.left).toBeCloseTo(1.5);
    expect(mid.rect.right).toBeCloseTo(2.5);
    expect(mid.expandedRect.left).toBeCloseTo(1.5 - padding);
    expect(mid.expandedRect.right).toBeCloseTo(2.5 + padding);
  });
});

// ─── Group obstacle classification ───────────────────────────────────────────

describe('buildObstacles — group obstacles', () => {
  it('classifies obstacle groups as soft', () => {
    const rects = new Map<string, NodeRect>([
      ['src', makeRect('src', 0, 0, 0.5, 0.5)],
      ['dst', makeRect('dst', 6, 0, 0.5, 0.5)],
      ['grp', makeRect('grp', 3, 0, 2, 2)],
    ]);
    const model = buildObstacles(
      rects,
      new Set(['grp']),
      new Set(['grp']),
      'src', 'dst',
      [0.5, 0], [5.5, 0],
      'right', 'left',
      0.025,
    );
    const grp = findObstacle(model, 'grp')!;
    expect(grp.hard).toBe(false);
    expect(grp.kind).toBe('group');
  });

  it('applies higher padding multiplier to groups', () => {
    const rects = new Map<string, NodeRect>([
      ['src', makeRect('src', 0, 0, 0.5, 0.5)],
      ['dst', makeRect('dst', 6, 0, 0.5, 0.5)],
      ['grp', makeRect('grp', 3, 0, 2, 2)],
    ]);
    const padding = 0.1;
    const model = buildObstacles(
      rects,
      new Set(['grp']),
      new Set(['grp']),
      'src', 'dst',
      [0.5, 0], [5.5, 0],
      'right', 'left',
      padding,
    );
    const grp = findObstacle(model, 'grp')!;
    const groupPadding = padding * 1.35;
    expect(grp.expandedRect.left).toBeCloseTo(grp.rect.left - groupPadding);
  });

  it('excludes groups not in obstacleGroupIds (container groups)', () => {
    const rects = new Map<string, NodeRect>([
      ['src', makeRect('src', 0, 0, 0.5, 0.5)],
      ['dst', makeRect('dst', 6, 0, 0.5, 0.5)],
      ['container', makeRect('container', 3, 0, 4, 4)],
    ]);
    const model = buildObstacles(
      rects,
      new Set(['container']),
      new Set(), // container not in obstacleGroupIds
      'src', 'dst',
      [0.5, 0], [5.5, 0],
      'right', 'left',
      0.025,
    );
    expect(findObstacle(model, 'container')).toBeUndefined();
  });
});

// ─── Owning groups and corridors ─────────────────────────────────────────────

describe('buildObstacles — owning groups', () => {
  it('adds source to sourceOwningGroupIds when source anchor is inside group', () => {
    // Source at (0, 0), group covers (-3, -3) to (3, 3) → source is inside
    const rects = new Map<string, NodeRect>([
      ['src', makeRect('src', 0, 0, 0.5, 0.5)],
      ['dst', makeRect('dst', 6, 0, 0.5, 0.5)],
      ['grp', makeRect('grp', 0, 0, 3, 3)],
    ]);
    const model = buildObstacles(
      rects,
      new Set(['grp']),
      new Set(['grp']),
      'src', 'dst',
      [0.5, 0], [5.5, 0],
      'right', 'left',
      0.025,
    );
    expect(model.sourceOwningGroupIds.has('grp')).toBe(true);
    expect(model.destOwningGroupIds.has('grp')).toBe(false);
  });

  it('creates corridor for owning source group', () => {
    const rects = new Map<string, NodeRect>([
      ['src', makeRect('src', 0, 0, 0.5, 0.5)],
      ['dst', makeRect('dst', 6, 0, 0.5, 0.5)],
      ['grp', makeRect('grp', 0, 0, 3, 3)],
    ]);
    const model = buildObstacles(
      rects,
      new Set(['grp']),
      new Set(['grp']),
      'src', 'dst',
      [0.5, 0], [5.5, 0],
      'right', 'left',
      0.025,
    );
    const grp = findObstacle(model, 'grp')!;
    expect(grp.ownsEndpoint).toBe(true);
    expect(grp.allowedCorridors.length).toBeGreaterThanOrEqual(1);
  });

  it('creates two corridors when source and dest are in the same group', () => {
    // Both source and dest inside the group.
    const rects = new Map<string, NodeRect>([
      ['src', makeRect('src', -1, 0, 0.3, 0.3)],
      ['dst', makeRect('dst', 1, 0, 0.3, 0.3)],
      ['grp', makeRect('grp', 0, 0, 3, 3)],
    ]);
    const model = buildObstacles(
      rects,
      new Set(['grp']),
      new Set(['grp']),
      'src', 'dst',
      [-0.7, 0], [0.7, 0],
      'right', 'left',
      0.025,
    );
    const grp = findObstacle(model, 'grp')!;
    expect(grp.ownsEndpoint).toBe(true);
    expect(grp.allowedCorridors).toHaveLength(2);
    expect(model.sourceOwningGroupIds.has('grp')).toBe(true);
    expect(model.destOwningGroupIds.has('grp')).toBe(true);
  });

  it('does not create corridors for unrelated groups', () => {
    // Group is far from source and dest.
    const rects = new Map<string, NodeRect>([
      ['src', makeRect('src', 0, 0, 0.5, 0.5)],
      ['dst', makeRect('dst', 10, 0, 0.5, 0.5)],
      ['grp', makeRect('grp', 5, 5, 1, 1)],
    ]);
    const model = buildObstacles(
      rects,
      new Set(['grp']),
      new Set(['grp']),
      'src', 'dst',
      [0.5, 0], [9.5, 0],
      'right', 'left',
      0.025,
    );
    const grp = findObstacle(model, 'grp')!;
    expect(grp.ownsEndpoint).toBe(false);
    expect(grp.allowedCorridors).toHaveLength(0);
  });
});

// ─── Nested groups ───────────────────────────────────────────────────────────

describe('buildObstacles — nested groups', () => {
  it('evaluates each group independently for containment', () => {
    // Inner group inside outer group, source inside inner.
    const rects = new Map<string, NodeRect>([
      ['src', makeRect('src', 0, 0, 0.3, 0.3)],
      ['dst', makeRect('dst', 8, 0, 0.3, 0.3)],
      ['inner', makeRect('inner', 0, 0, 1, 1)],
      ['outer', makeRect('outer', 0, 0, 4, 4)],
    ]);
    const model = buildObstacles(
      rects,
      new Set(['inner', 'outer']),
      new Set(['inner', 'outer']),
      'src', 'dst',
      [0.3, 0], [7.7, 0],
      'right', 'left',
      0.025,
    );
    // Source anchor (0.3, 0) is inside both inner and outer.
    expect(model.sourceOwningGroupIds.has('inner')).toBe(true);
    expect(model.sourceOwningGroupIds.has('outer')).toBe(true);
    // Both should have corridors.
    const inner = findObstacle(model, 'inner')!;
    const outer = findObstacle(model, 'outer')!;
    expect(inner.allowedCorridors.length).toBeGreaterThanOrEqual(1);
    expect(outer.allowedCorridors.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe('buildObstacles — edge cases', () => {
  it('returns empty obstacles when only source and dest exist', () => {
    const rects = new Map<string, NodeRect>([
      ['src', makeRect('src', 0, 0, 0.5, 0.5)],
      ['dst', makeRect('dst', 3, 0, 0.5, 0.5)],
    ]);
    const model = buildObstacles(
      rects, new Set(), new Set(),
      'src', 'dst',
      [0.5, 0], [2.5, 0],
      'right', 'left',
      0.025,
    );
    expect(model.obstacles).toHaveLength(0);
  });

  it('handles empty nodeRects', () => {
    const model = buildObstacles(
      new Map(), new Set(), new Set(),
      'src', 'dst',
      [0, 0], [1, 0],
      'right', 'left',
      0.025,
    );
    expect(model.obstacles).toHaveLength(0);
    expect(model.sourceOwningGroupIds.size).toBe(0);
    expect(model.destOwningGroupIds.size).toBe(0);
  });

  it('includes source/dest as obstacle when they are obstacle groups', () => {
    // A group that is also the source/dest is included as an obstacle.
    const rects = new Map<string, NodeRect>([
      ['srcGrp', makeRect('srcGrp', 0, 0, 2, 2)],
      ['dst', makeRect('dst', 6, 0, 0.5, 0.5)],
    ]);
    const model = buildObstacles(
      rects,
      new Set(['srcGrp']),
      new Set(['srcGrp']),
      'srcGrp', 'dst',
      [0, 0], [5.5, 0],
      'right', 'left',
      0.025,
    );
    // srcGrp is an obstacle group, so it IS included (even though it's the source).
    expect(findObstacle(model, 'srcGrp')).toBeDefined();
  });
});
