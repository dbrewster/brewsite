// Group compiler extracted from compile.ts.
// Pure functions only — no Three.js, no React.

import type { DiagramGroupDSL, DiagramGroupState, DiagramTheme } from '../types';
import { buildGroupDefaults } from './nodeCompiler';
import { computeBounds } from './layoutAlgorithms';
import { GROUP_PADDING } from './groupConstants';

export type GroupBounds = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly padding: number;
};

const isEmptyBounds = (bounds: { w: number; h: number }): boolean =>
  bounds.w === 0 && bounds.h === 0;

const unionBounds = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } => {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.w, b.x + b.w);
  const maxY = Math.max(a.y + a.h, b.y + b.h);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

export function resolveGroupBoundsMap(
  groups: ReadonlyArray<DiagramGroupDSL>,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number] | readonly [number, number, number]>,
): Map<string, GroupBounds> {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const memo = new Map<string, GroupBounds>();
  const visiting = new Set<string>();

  const computeGroupBounds = (groupId: string): GroupBounds => {
    const cached = memo.get(groupId);
    if (cached) return cached;
    if (visiting.has(groupId)) {
      return { x: 0, y: 0, w: 0, h: 0, padding: GROUP_PADDING };
    }
    visiting.add(groupId);
    const group = groupById.get(groupId);
    if (!group) {
      const empty = { x: 0, y: 0, w: 0, h: 0, padding: GROUP_PADDING };
      memo.set(groupId, empty);
      visiting.delete(groupId);
      return empty;
    }

    const nodeBounds = computeBounds(group.nodeIds, positions, sizes);
    let combined: { x: number; y: number; w: number; h: number } | null =
      group.nodeIds.length > 0 && !isEmptyBounds(nodeBounds)
        ? { x: nodeBounds.x, y: nodeBounds.y, w: nodeBounds.w, h: nodeBounds.h }
        : null;

    const childIds = group.childGroupIds ?? [];
    for (const childId of childIds) {
      const childBounds = computeGroupBounds(childId);
      if (isEmptyBounds(childBounds)) continue;
      if (!combined) {
        combined = { x: childBounds.x, y: childBounds.y, w: childBounds.w, h: childBounds.h };
      } else {
        combined = unionBounds(combined, childBounds);
      }
    }

    const base = combined ?? { x: 0, y: 0, w: 0, h: 0 };
    const padding = GROUP_PADDING;
    const padded = {
      x: base.x - padding,
      y: base.y - padding,
      w: base.w + padding * 2,
      h: base.h + padding * 2,
      padding,
    };

    memo.set(groupId, padded);
    visiting.delete(groupId);
    return padded;
  };

  groups.forEach((group) => {
    computeGroupBounds(group.id);
  });

  return memo;
}

export function compileGroup(
  dsl: DiagramGroupDSL,
  bounds: GroupBounds,
  theme: DiagramTheme,
): DiagramGroupState {
  const gd = buildGroupDefaults(theme);
  const variant = dsl.variant ?? gd.variant;
  const isContainer = variant === 'container';

  return {
    id: dsl.id,
    label: dsl.label ?? '',
    variant,
    orientation: dsl.orientation ?? gd.orientation,
    parentId: dsl.parentId,
    bounds,
    color: dsl.color ?? gd.color,
    borderColor: dsl.borderColor ?? gd.borderColor,
    borderStyle: isContainer ? 'none' : (dsl.borderStyle ?? gd.borderStyle),
    fillOpacity: isContainer ? 0 : (dsl.fillOpacity ?? gd.fillOpacity),
    borderOpacity: isContainer ? 0 : (dsl.borderOpacity ?? gd.borderOpacity),
  };
}
