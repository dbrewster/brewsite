// hoverStateMachine.test.ts — unit tests for the pure hover transition event computation.

import { describe, it, expect } from 'vitest';
import {
  computeHoverTransitionEvents,
  buildGroupPath,
  collectGroupIds,
  type HoverTarget,
} from '../hoverStateMachine';
import type { DiagramState } from '../../types';

// Minimal DiagramState shape with only groups populated (sufficient for these pure functions).
function makeState(groups: Array<{ id: string; parentId?: string }>): Pick<DiagramState, 'groups'> {
  return {
    groups: groups.map((g) => ({
      id: g.id,
      label: g.id,
      variant: 'boundary' as const,
      orientation: 'horizontal' as const,
      parentId: g.parentId,
      bounds: { x: 0, y: 0, w: 0.5, h: 0.5 },
      padding: [0, 0, 0, 0] as [number, number, number, number],
      opacity: 1,
      visible: true,
      color: '#000000',
      labelColor: '#ffffff',
      borderColor: '#333333',
      borderWidth: 1,
      borderRadius: 4,
      borderOpacity: 1,
    })),
  } as unknown as Pick<DiagramState, 'groups'>;
}

function makeTarget(
  diagramId: string,
  groupPath: string[],
  point: [number, number, number] = [0, 0, 0],
  nodeId?: string,
): HoverTarget {
  return { diagramId, groupPath, point, nodeId };
}

// ─── buildGroupPath ────────────────────────────────────────────────────────────

describe('buildGroupPath', () => {
  it('returns empty array for unknown groupId', () => {
    const state = makeState([{ id: 'a' }]);
    expect(buildGroupPath(state, 'nonexistent')).toEqual([]);
  });

  it('returns single-element path for root group', () => {
    const state = makeState([{ id: 'root' }]);
    expect(buildGroupPath(state, 'root')).toEqual(['root']);
  });

  it('returns root→child order for nested groups', () => {
    const state = makeState([
      { id: 'root' },
      { id: 'child', parentId: 'root' },
      { id: 'leaf', parentId: 'child' },
    ]);
    expect(buildGroupPath(state, 'leaf')).toEqual(['root', 'child', 'leaf']);
  });

  it('returns path for middle group (not leaf)', () => {
    const state = makeState([
      { id: 'root' },
      { id: 'mid', parentId: 'root' },
      { id: 'leaf', parentId: 'mid' },
    ]);
    expect(buildGroupPath(state, 'mid')).toEqual(['root', 'mid']);
  });
});

// ─── collectGroupIds ───────────────────────────────────────────────────────────

describe('collectGroupIds', () => {
  it('returns only the specified group when includeDescendants is false', () => {
    const state = makeState([
      { id: 'parent' },
      { id: 'child', parentId: 'parent' },
    ]);
    const result = collectGroupIds(state, 'parent', false);
    expect(result.size).toBe(1);
    expect(result.has('parent')).toBe(true);
    expect(result.has('child')).toBe(false);
  });

  it('includes descendants when includeDescendants is true', () => {
    const state = makeState([
      { id: 'root' },
      { id: 'child1', parentId: 'root' },
      { id: 'child2', parentId: 'root' },
      { id: 'grandchild', parentId: 'child1' },
    ]);
    const result = collectGroupIds(state, 'root', true);
    expect(result.has('root')).toBe(true);
    expect(result.has('child1')).toBe(true);
    expect(result.has('child2')).toBe(true);
    expect(result.has('grandchild')).toBe(true);
    expect(result.size).toBe(4);
  });

  it('returns only specified subtree, not siblings', () => {
    const state = makeState([
      { id: 'root' },
      { id: 'childA', parentId: 'root' },
      { id: 'childB', parentId: 'root' },
    ]);
    const result = collectGroupIds(state, 'childA', true);
    expect(result.has('childA')).toBe(true);
    expect(result.has('childB')).toBe(false);
    expect(result.has('root')).toBe(false);
  });

  it('returns single-element set for leaf group with includeDescendants', () => {
    const state = makeState([
      { id: 'parent' },
      { id: 'leaf', parentId: 'parent' },
    ]);
    const result = collectGroupIds(state, 'leaf', true);
    expect(result.size).toBe(1);
    expect(result.has('leaf')).toBe(true);
  });
});

// ─── computeHoverTransitionEvents ─────────────────────────────────────────────

describe('computeHoverTransitionEvents', () => {
  it('returns empty array when both prev and next are null', () => {
    expect(computeHoverTransitionEvents(null, null)).toEqual([]);
  });

  it('emits node-mouse-enter when transitioning from null to a node', () => {
    const next = makeTarget('d1', [], [1, 2, 3], 'nodeA');
    const events = computeHoverTransitionEvents(null, next);
    expect(events).toEqual([
      { type: 'node-mouse-enter', diagramId: 'd1', nodeId: 'nodeA', point: [1, 2, 3] },
    ]);
  });

  it('emits node-mouse-leave when transitioning from a node to null', () => {
    const prev = makeTarget('d1', [], [1, 2, 3], 'nodeA');
    const events = computeHoverTransitionEvents(prev, null);
    expect(events).toEqual([
      { type: 'node-mouse-leave', diagramId: 'd1', nodeId: 'nodeA', point: [1, 2, 3] },
    ]);
  });

  it('emits leave then enter when transitioning between two nodes in the same group', () => {
    const prev = makeTarget('d1', ['g1'], [0, 0, 0], 'nodeA');
    const next = makeTarget('d1', ['g1'], [1, 0, 0], 'nodeB');
    const events = computeHoverTransitionEvents(prev, next);
    expect(events).toEqual([
      { type: 'node-mouse-leave', diagramId: 'd1', nodeId: 'nodeA', point: [0, 0, 0] },
      { type: 'node-mouse-enter', diagramId: 'd1', nodeId: 'nodeB', point: [1, 0, 0] },
    ]);
  });

  it('emits full sequence when transitioning between nodes in different groups', () => {
    const prev = makeTarget('d1', ['root', 'groupA'], [0, 0, 0], 'nodeA');
    const next = makeTarget('d1', ['root', 'groupB'], [1, 0, 0], 'nodeB');
    const events = computeHoverTransitionEvents(prev, next);
    expect(events).toEqual([
      { type: 'node-mouse-leave', diagramId: 'd1', nodeId: 'nodeA', point: [0, 0, 0] },
      { type: 'group-mouse-leave', diagramId: 'd1', groupId: 'groupA', point: [0, 0, 0] },
      { type: 'group-mouse-enter', diagramId: 'd1', groupId: 'groupB', point: [1, 0, 0] },
      { type: 'node-mouse-enter', diagramId: 'd1', nodeId: 'nodeB', point: [1, 0, 0] },
    ]);
  });

  it('emits group-mouse-enter events in root-to-leaf order', () => {
    const next = makeTarget('d1', ['root', 'child', 'leaf'], [0, 0, 0]);
    const events = computeHoverTransitionEvents(null, next);
    const types = events.map((e) => e.type);
    expect(types).toEqual(['group-mouse-enter', 'group-mouse-enter', 'group-mouse-enter']);
    const groupIds = events.map((e) => ('groupId' in e ? e.groupId : ''));
    expect(groupIds).toEqual(['root', 'child', 'leaf']);
  });

  it('emits group-mouse-leave events in leaf-to-root order', () => {
    const prev = makeTarget('d1', ['root', 'child', 'leaf'], [0, 0, 0]);
    const events = computeHoverTransitionEvents(prev, null);
    const types = events.map((e) => e.type);
    expect(types).toEqual(['group-mouse-leave', 'group-mouse-leave', 'group-mouse-leave']);
    const groupIds = events.map((e) => ('groupId' in e ? e.groupId : ''));
    expect(groupIds).toEqual(['leaf', 'child', 'root']);
  });

  it('does not emit node events when node is unchanged', () => {
    const prev = makeTarget('d1', ['g1'], [0, 0, 0], 'nodeA');
    const next = makeTarget('d1', ['g1'], [1, 0, 0], 'nodeA');
    const events = computeHoverTransitionEvents(prev, next);
    expect(events.filter((e) => e.type.startsWith('node'))).toHaveLength(0);
  });

  it('emits all events when crossing diagram boundaries', () => {
    const prev = makeTarget('diagramA', ['g1'], [0, 0, 0], 'node1');
    const next = makeTarget('diagramB', ['g2'], [1, 0, 0], 'node2');
    const events = computeHoverTransitionEvents(prev, next);
    expect(events.find((e) => e.type === 'node-mouse-leave')).toBeDefined();
    expect(events.find((e) => e.type === 'node-mouse-enter')).toBeDefined();
  });
});
