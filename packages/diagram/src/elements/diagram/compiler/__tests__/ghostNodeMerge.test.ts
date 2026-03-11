// ghostNodeMerge.test.ts — unit tests for the pure ghost node merge function.

import { describe, it, expect } from 'vitest';
import { mergeGhostNodeSnapshot } from '../ghostNodeMerge';
import type { DiagramNodeState, DiagramState } from '../../types';

function makeNode(overrides: Partial<DiagramNodeState> & { id: string }): DiagramNodeState {
  return {
    label: 'Default Label',
    sublabel: undefined,
    shape: 'rectangle',
    position: [0.5, 0.5, 0],
    size: [0.2, 0.1],
    thickness: 0.4,
    color: '#112233',
    sideColor: '#001122',
    borderColor: '#334455',
    metalness: 0.35,
    roughness: 0.35,
    emissiveIntensity: 0.1,
    emissive: false,
    emissiveColor: '#112233',
    cornerRadius: 0.06,
    labelColor: '#ffffff',
    sublabelColor: '#aaaaaa',
    opacity: 1,
    clickable: false,
    enabled: true,
    positionInherited: undefined,
    iconUrl: undefined,
    iconScale: 0.6,
    iconStyle: 'flat',
    iconDepthFactor: 0.3,
    groupId: undefined,
    onMouseEnter: undefined,
    onMouseLeave: undefined,
    ...overrides,
  } as unknown as DiagramNodeState;
}

function makeState(nodes: DiagramNodeState[]): DiagramState {
  return {
    id: 'test-diagram',
    nodes,
    edges: [],
    groups: [],
    viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: [0, 0, 0],
    scale: 1,
    z: 0,
    themeConfig: {} as DiagramState['themeConfig'],
    visible: true,
  } as unknown as DiagramState;
}

// ─── Edge cases ────────────────────────────────────────────────────────────────

describe('mergeGhostNodeSnapshot edge cases', () => {
  it('returns undefined when next is undefined', () => {
    expect(mergeGhostNodeSnapshot(undefined, undefined)).toBeUndefined();
  });

  it('returns undefined when prev is defined but next is undefined', () => {
    const prev = makeState([makeNode({ id: 'n1' })]);
    expect(mergeGhostNodeSnapshot(prev, undefined)).toBeUndefined();
  });

  it('returns next unchanged when prev is undefined', () => {
    const next = makeState([makeNode({ id: 'n1' })]);
    const result = mergeGhostNodeSnapshot(undefined, next);
    expect(result).toBe(next); // same reference
  });
});

// ─── Ghost nodes (label === undefined) ────────────────────────────────────────

describe('mergeGhostNodeSnapshot — ghost nodes', () => {
  it('inherits label from prev when node has undefined label', () => {
    const prevNode = makeNode({ id: 'n1', label: 'Prev Label' });
    const nextNode = makeNode({ id: 'n1', label: undefined });
    const result = mergeGhostNodeSnapshot(makeState([prevNode]), makeState([nextNode]));
    expect(result?.nodes[0]?.label).toBe('Prev Label');
  });

  it('inherits sublabel from prev for ghost node', () => {
    const prevNode = makeNode({ id: 'n1', sublabel: 'Sub' });
    const nextNode = makeNode({ id: 'n1', label: undefined, sublabel: undefined });
    const result = mergeGhostNodeSnapshot(makeState([prevNode]), makeState([nextNode]));
    expect(result?.nodes[0]?.sublabel).toBe('Sub');
  });

  it('inherits shape from prev for ghost node', () => {
    const prevNode = makeNode({ id: 'n1', shape: 'circle' });
    const nextNode = makeNode({ id: 'n1', label: undefined, shape: 'rectangle' });
    const result = mergeGhostNodeSnapshot(makeState([prevNode]), makeState([nextNode]));
    expect(result?.nodes[0]?.shape).toBe('circle');
  });

  it('inherits iconUrl from prev for ghost node', () => {
    const prevNode = makeNode({ id: 'n1', iconUrl: 'icon.svg' });
    const nextNode = makeNode({ id: 'n1', label: undefined, iconUrl: undefined });
    const result = mergeGhostNodeSnapshot(makeState([prevNode]), makeState([nextNode]));
    expect(result?.nodes[0]?.iconUrl).toBe('icon.svg');
  });

  it('inherits iconScale from prev for ghost node', () => {
    const prevNode = makeNode({ id: 'n1', iconScale: 0.8 });
    const nextNode = makeNode({ id: 'n1', label: undefined, iconScale: 0.6 });
    const result = mergeGhostNodeSnapshot(makeState([prevNode]), makeState([nextNode]));
    expect(result?.nodes[0]?.iconScale).toBe(0.8);
  });

  it('inherits sublabelColor from prev for ghost node', () => {
    const prevNode = makeNode({ id: 'n1', sublabelColor: '#ff0000' });
    const nextNode = makeNode({ id: 'n1', label: undefined, sublabelColor: '#aaaaaa' });
    const result = mergeGhostNodeSnapshot(makeState([prevNode]), makeState([nextNode]));
    expect(result?.nodes[0]?.sublabelColor).toBe('#ff0000');
  });
});

// ─── Non-ghost nodes ──────────────────────────────────────────────────────────

describe('mergeGhostNodeSnapshot — non-ghost nodes', () => {
  it('does not merge fields for a fully-declared node (label defined)', () => {
    const prevNode = makeNode({ id: 'n1', label: 'Old', shape: 'circle' });
    const nextNode = makeNode({ id: 'n1', label: 'New', shape: 'rectangle' });
    const result = mergeGhostNodeSnapshot(makeState([prevNode]), makeState([nextNode]));
    // When nothing changed (no ghost, no positionInherited), same reference returned.
    expect(result?.nodes[0]?.label).toBe('New');
    expect(result?.nodes[0]?.shape).toBe('rectangle');
  });

  it('returns the same next reference when no merging was needed', () => {
    const nextNode = makeNode({ id: 'n1', label: 'Label' });
    const next = makeState([nextNode]);
    const prev = makeState([makeNode({ id: 'n1', label: 'Other' })]);
    const result = mergeGhostNodeSnapshot(prev, next);
    expect(result).toBe(next); // no allocation — same reference
  });
});

// ─── positionInherited ────────────────────────────────────────────────────────

describe('mergeGhostNodeSnapshot — positionInherited', () => {
  it('inherits position, size, and thickness when positionInherited is true', () => {
    const prevNode = makeNode({ id: 'n1', position: [0.1, 0.2, 0.3], size: [0.4, 0.5], thickness: 0.8 });
    const nextNode = makeNode({
      id: 'n1',
      label: 'Label',
      positionInherited: true,
      position: [0, 0, 0],
      size: [0.1, 0.1],
      thickness: 0.1,
    });
    const result = mergeGhostNodeSnapshot(makeState([prevNode]), makeState([nextNode]));
    expect(result?.nodes[0]?.position).toEqual([0.1, 0.2, 0.3]);
    expect(result?.nodes[0]?.size).toEqual([0.4, 0.5]);
    expect(result?.nodes[0]?.thickness).toBe(0.8);
  });

  it('clears positionInherited flag after merge', () => {
    const prevNode = makeNode({ id: 'n1', position: [0.1, 0.2, 0.3] });
    const nextNode = makeNode({ id: 'n1', label: 'Label', positionInherited: true });
    const result = mergeGhostNodeSnapshot(makeState([prevNode]), makeState([nextNode]));
    expect(result?.nodes[0]?.positionInherited).toBeUndefined();
  });

  it('does not inherit position when positionInherited is false/undefined', () => {
    const prevNode = makeNode({ id: 'n1', position: [0.9, 0.9, 0] });
    const nextNode = makeNode({ id: 'n1', label: 'Label', position: [0.5, 0.5, 0] });
    const result = mergeGhostNodeSnapshot(makeState([prevNode]), makeState([nextNode]));
    expect(result?.nodes[0]?.position).toEqual([0.5, 0.5, 0]);
  });
});

// ─── No-allocation optimization ──────────────────────────────────────────────

describe('mergeGhostNodeSnapshot — no-allocation optimization', () => {
  it('returns same next reference when no nodes were ghost or positionInherited', () => {
    const nodes = [
      makeNode({ id: 'a', label: 'A' }),
      makeNode({ id: 'b', label: 'B' }),
    ];
    const next = makeState(nodes);
    const prev = makeState([makeNode({ id: 'a', label: 'Old A' })]);
    const result = mergeGhostNodeSnapshot(prev, next);
    expect(result).toBe(next);
  });
});
