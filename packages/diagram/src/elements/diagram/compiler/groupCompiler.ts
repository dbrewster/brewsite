// Group compiler extracted from compile.ts.
// Pure functions only — no Three.js, no React.

import type { DiagramGroupDSL, DiagramGroupState, DiagramTheme } from '../types';
import { buildGroupDefaults } from './nodeCompiler';
import { computeBounds } from './layoutAlgorithms';
import type { ResolvedLayout } from './layoutResolver';

export type GroupBounds = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Resolved padding [top, right, bottom, left] in diagram units. */
  readonly padding: readonly [number, number, number, number];
  /** Gap between group title label and content, in diagram units. */
  readonly titleGap: number;
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
  groupLayouts: Map<string, ResolvedLayout>,
): Map<string, GroupBounds> {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const memo = new Map<string, GroupBounds>();
  const visiting = new Set<string>();

  const computeGroupBounds = (groupId: string): GroupBounds => {
    const cached = memo.get(groupId);
    if (cached) return cached;
    if (visiting.has(groupId)) {
      return { x: 0, y: 0, w: 0, h: 0, padding: [1.5, 1.5, 1.5, 1.5] as const, titleGap: 0.75 };
    }
    visiting.add(groupId);
    const group = groupById.get(groupId);
    if (!group) {
      const empty: GroupBounds = { x: 0, y: 0, w: 0, h: 0, padding: [1.5, 1.5, 1.5, 1.5], titleGap: 0.75 };
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
    const gl = groupLayouts.get(groupId);
    const [pt, pr, pb, pl] = gl?.groupPadding ?? [1.5, 1.5, 1.5, 1.5];
    const titleGap = gl?.titleGap ?? 0.75;
    const padded: GroupBounds = {
      x: base.x - pl,
      y: base.y - pb,
      w: base.w + pl + pr,
      h: base.h + pb + pt,
      padding: [pt, pr, pb, pl],
      titleGap,
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
    borderWidth: gd.borderWidth,
    borderHeight: gd.borderHeight,
    borderStyle: isContainer ? 'none' : (dsl.borderStyle ?? gd.borderStyle),
    fillOpacity: isContainer ? 0 : (dsl.fillOpacity ?? gd.fillOpacity),
    borderOpacity: isContainer ? 0 : (dsl.borderOpacity ?? gd.borderOpacity),
  };
}
