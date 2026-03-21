// Sequential single-axis flow layout algorithm for diagram nodes.

import type { DiagramNodeDSL } from '../../types';
import type { ResolvedFlowLayout } from '../layoutResolver';
import { resolveToNVS } from '@brewsite/core';
import type { SceneLength, ScenePosition3, SceneSize2 } from '@brewsite/core';

/** Resolve a SceneLength to a number, passing through values that are already numeric. */
const toNum = (v: SceneLength | number): number => typeof v === 'number' ? v : resolveToNVS(v);

function resolvePosition(pos: ScenePosition3 | readonly [number, number, number]): readonly [number, number, number] {
  return [toNum(pos[0]), toNum(pos[1]), toNum(pos[2])];
}

function resolveSize(size: SceneSize2 | readonly [number, number]): readonly [number, number] {
  return [toNum(size[0]), toNum(size[1])];
}

/**
 * Assigns [x, y, z] positions for a flow layout (single-axis sequential placement).
 * Items are placed edge-to-edge with `layout.gap` empty space between adjacent footprints.
 * Items with explicit positions are preserved. The cursor advances past their footprint
 * so subsequent auto-placed items maintain correct edge-to-edge spacing.
 * Returns a Map from node ID to Cartesian [x, y, z] position in diagram units (Y-up).
 */
export function resolveFlowLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  layout: ResolvedFlowLayout,
  childrenOrder: ReadonlyArray<string>,
  defaultNodeSize: readonly [number, number],
): Map<string, readonly [number, number, number]> {
  const positions = new Map<string, readonly [number, number, number]>();
  const isTopDown = layout.direction !== 'left-right';
  const gap = layout.gap;

  const nodeById = new Map<string, DiagramNodeDSL>(nodes.map((n) => [n.id, n]));

  // Seed explicit positions.
  for (const n of nodes) {
    if (n.position) positions.set(n.id, resolvePosition(n.position));
  }

  // Build ordered list: childrenOrder filtered to ids present in this level, then append any missing.
  const nodeIdSet = new Set<string>(nodes.map((n) => n.id));
  const orderedIds: string[] = childrenOrder.filter((id) => nodeIdSet.has(id));
  // Defensive: append any ids present in nodes but absent from childrenOrder (O(n), not O(n²)).
  const orderedIdSet = new Set<string>(orderedIds);
  for (const n of nodes) {
    if (!orderedIdSet.has(n.id)) {
      orderedIds.push(n.id);
      orderedIdSet.add(n.id);
    }
  }

  // Place items sequentially.
  // trailingEdge = the primary-axis coordinate of the TRAILING edge of the last auto-placed item.
  // top-down: trailing edge is the bottom edge (most negative Y value reached).
  // left-right: trailing edge is the right edge (most positive X value reached).
  let trailingEdge = 0;
  let firstAutoItem = true;

  for (const id of orderedIds) {
    const node = nodeById.get(id);
    if (!node) continue;

    const [w, h] = node.size ? resolveSize(node.size) : defaultNodeSize;
    const primarySize = isTopDown ? h : w;
    const halfPrimary = primarySize / 2;

    if (node.position) {
      // Explicit position: preserve it and skip auto-placement.
      // Do not update trailingEdge; explicit items are assumed placed by the author.
      continue;
    }

    let center: number;
    if (firstAutoItem) {
      // First auto-placed item is centered at the primary-axis origin.
      center = 0;
      firstAutoItem = false;
    } else {
      // Subsequent items: leading edge = trailingEdge ± gap, center = leading ± half.
      if (isTopDown) {
        center = trailingEdge - gap - halfPrimary;
      } else {
        center = trailingEdge + gap + halfPrimary;
      }
    }

    // Update trailing edge for the next item.
    trailingEdge = isTopDown
      ? center - halfPrimary   // bottom edge (most negative Y)
      : center + halfPrimary;  // right edge (most positive X)

    const x = isTopDown ? 0 : center;
    const y = isTopDown ? center : 0;
    positions.set(id, [x, y, 0]);
  }

  return positions;
}
