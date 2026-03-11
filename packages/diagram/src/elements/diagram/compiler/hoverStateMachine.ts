// hoverStateMachine.ts — pure hover transition event computation extracted from widget.ts.

import type { DiagramState } from '../types';

/**
 * A hover target representing the current pointer position over the diagram.
 * Carries the diagram ID, the resolved group ancestry path (root→leaf order),
 * an optional node ID, and the 3D intersect point.
 */
export type HoverTarget = {
  readonly diagramId: string;
  readonly groupPath: ReadonlyArray<string>;
  readonly nodeId?: string;
  readonly point: readonly [number, number, number];
};

/** Events emitted by computeHoverTransitionEvents. Dispatched by the caller (DiagramWidget). */
export type HoverEvent =
  | { type: 'node-mouse-enter'; diagramId: string; nodeId: string; point: readonly [number, number, number] }
  | { type: 'node-mouse-leave'; diagramId: string; nodeId: string; point: readonly [number, number, number] }
  | { type: 'group-mouse-enter'; diagramId: string; groupId: string; point: readonly [number, number, number] }
  | { type: 'group-mouse-leave'; diagramId: string; groupId: string; point: readonly [number, number, number] };

/**
 * Computes the hover events that should be dispatched when the hover target
 * transitions from `prev` to `next`.
 *
 * Returns events in dispatch order:
 * 1. node-mouse-leave for the previous node (if changed)
 * 2. group-mouse-leave for groups that are leaving the path
 * 3. group-mouse-enter for groups that are entering the path
 * 4. node-mouse-enter for the new node (if changed)
 *
 * The caller is responsible for actually dispatching events (calling handlers).
 * stopPropagation semantics are implemented in the caller when a handler returns true.
 */
export function computeHoverTransitionEvents(
  prev: HoverTarget | null,
  next: HoverTarget | null,
): ReadonlyArray<HoverEvent> {
  const events: HoverEvent[] = [];

  const prevPath = prev?.groupPath ?? [];
  const nextPath = next?.groupPath ?? [];

  // Compute the shared prefix length between prev and next group paths.
  let shared = 0;
  while (
    shared < prevPath.length &&
    shared < nextPath.length &&
    prevPath[shared] === nextPath[shared] &&
    prev?.diagramId === next?.diagramId
  ) {
    shared += 1;
  }

  const prevNodeChanged = prev?.diagramId !== next?.diagramId || prev?.nodeId !== next?.nodeId;

  // 1. node-mouse-leave for the previous node (if changed).
  if (prev?.nodeId && prevNodeChanged) {
    events.push({ type: 'node-mouse-leave', diagramId: prev.diagramId, nodeId: prev.nodeId, point: prev.point });
  }

  // 2. group-mouse-leave for groups exiting the path (leaf→root order).
  for (let i = prevPath.length - 1; i >= shared; i -= 1) {
    const groupId = prevPath[i];
    if (groupId !== undefined) {
      events.push({ type: 'group-mouse-leave', diagramId: prev!.diagramId, groupId, point: prev!.point });
    }
  }

  // 3. group-mouse-enter for groups entering the path (root→leaf order).
  for (let i = shared; i < nextPath.length; i += 1) {
    const groupId = nextPath[i];
    if (groupId !== undefined) {
      events.push({ type: 'group-mouse-enter', diagramId: next!.diagramId, groupId, point: next!.point });
    }
  }

  // 4. node-mouse-enter for the new node (if changed).
  if (next?.nodeId && prevNodeChanged) {
    events.push({ type: 'node-mouse-enter', diagramId: next.diagramId, nodeId: next.nodeId, point: next.point });
  }

  return events;
}

/**
 * Builds the group ancestry path from a leaf groupId to the root group.
 * Returns groups in root→leaf order (root is index 0).
 * Pure function — no Three.js, no DOM.
 */
export function buildGroupPath(
  state: Pick<DiagramState, 'groups'>,
  leafGroupId: string,
): ReadonlyArray<string> {
  const byId = new Map(state.groups.map((g) => [g.id, g]));
  const path: string[] = [];
  let cursor = byId.get(leafGroupId);
  while (cursor) {
    path.unshift(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return path;
}

/**
 * Collects all group IDs in a subtree rooted at `groupId`.
 * When includeDescendants is false, returns a set containing only `groupId`.
 */
export function collectGroupIds(
  state: Pick<DiagramState, 'groups'>,
  groupId: string,
  includeDescendants: boolean,
): ReadonlySet<string> {
  const result = new Set<string>([groupId]);
  if (!includeDescendants) return result;

  const childMap = new Map<string, string[]>();
  for (const group of state.groups) {
    if (!group.parentId) continue;
    const list = childMap.get(group.parentId) ?? [];
    list.push(group.id);
    childMap.set(group.parentId, list);
  }

  const queue = [groupId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const children = childMap.get(current) ?? [];
    for (const child of children) {
      if (result.has(child)) continue;
      result.add(child);
      queue.push(child);
    }
  }
  return result;
}
