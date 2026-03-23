// Tests for sideSelect.ts — 2D side selection and port placement.

import { describe, it, expect } from 'vitest';
import {
  nearestSide,
  sideNormal,
  sideCenter,
  portAnchor,
  selectSides,
  inferBundleHints,
} from '../sideSelect';
import type { SideSelection } from '../sideSelect';
import type {
  NodeRect,
  EdgeRoutingRequest,
  Vec2,
  SideId,
  FlowConfig,
} from '../routingTypes';
import { DEFAULT_FLOW_CONFIG } from '../routingTypes';

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

const makeRequest = (
  id: string,
  fromId: string,
  toId: string,
  overrides?: Partial<EdgeRoutingRequest>,
): EdgeRoutingRequest => ({
  id,
  fromId,
  toId,
  profile: 'flow',
  thickness: 0.06,
  ...overrides,
});

// ─── nearestSide ─────────────────────────────────────────────────────────────

describe('nearestSide', () => {
  it('returns right when target is to the right of a square node', () => {
    expect(nearestSide([0, 0], [2, 0], 0.5, 0.5)).toBe('right');
  });

  it('returns left when target is to the left of a square node', () => {
    expect(nearestSide([0, 0], [-2, 0], 0.5, 0.5)).toBe('left');
  });

  it('returns top when target is above a square node', () => {
    expect(nearestSide([0, 0], [0, 2], 0.5, 0.5)).toBe('top');
  });

  it('returns bottom when target is below a square node', () => {
    expect(nearestSide([0, 0], [0, -2], 0.5, 0.5)).toBe('bottom');
  });

  it('returns top for co-located nodes', () => {
    expect(nearestSide([1, 1], [1, 1], 0.5, 0.5)).toBe('top');
  });

  it('prefers vertical when dx/halfW equals dy/halfH', () => {
    // dx=1, dy=1, halfW=0.5, halfH=0.5 → nx=2, ny=2 → equal → prefer vertical
    expect(nearestSide([0, 0], [1, 1], 0.5, 0.5)).toBe('top');
  });

  it('considers aspect ratio for wide nodes', () => {
    // Wide node: halfW=2, halfH=0.5
    // Target at (1, 0.6): dx=1, dy=0.6, nx=1/2=0.5, ny=0.6/0.5=1.2
    // nx < ny → vertical dominates → top
    expect(nearestSide([0, 0], [1, 0.6], 2, 0.5)).toBe('top');
  });

  it('considers aspect ratio for tall nodes', () => {
    // Tall node: halfW=0.5, halfH=2
    // Target at (0.6, 1): dx=0.6, dy=1, nx=0.6/0.5=1.2, ny=1/2=0.5
    // nx > ny → horizontal dominates → right
    expect(nearestSide([0, 0], [0.6, 1], 0.5, 2)).toBe('right');
  });

  it('handles zero halfW (infinite nx forces left/right)', () => {
    // halfW=0 → nx=Infinity → horizontal dominates → right
    expect(nearestSide([0, 0], [1, 1], 0, 0.5)).toBe('right');
  });

  it('handles zero halfH (infinite ny forces top/bottom)', () => {
    // halfH=0 → ny=Infinity → vertical dominates ... wait, ny=Infinity means vertical
    // BUT nx > ny check: nx=2 > ny=Infinity is FALSE → so we go to vertical
    // Actually when halfH is 0, ny is Infinity. nx > ny? No. So top.
    expect(nearestSide([0, 0], [1, 1], 0.5, 0)).toBe('top');
  });
});

// ─── sideNormal ──────────────────────────────────────────────────────────────

describe('sideNormal', () => {
  it('returns [-1, 0] for left', () => {
    expect(sideNormal('left')).toEqual([-1, 0]);
  });

  it('returns [1, 0] for right', () => {
    expect(sideNormal('right')).toEqual([1, 0]);
  });

  it('returns [0, 1] for top', () => {
    expect(sideNormal('top')).toEqual([0, 1]);
  });

  it('returns [0, -1] for bottom', () => {
    expect(sideNormal('bottom')).toEqual([0, -1]);
  });
});

// ─── sideCenter ──────────────────────────────────────────────────────────────

describe('sideCenter', () => {
  const rect = makeRect('n1', 1, 2, 0.5, 0.3);

  it('returns left center', () => {
    expect(sideCenter(rect, 'left')).toEqual([0.5, 2]);
  });

  it('returns right center', () => {
    expect(sideCenter(rect, 'right')).toEqual([1.5, 2]);
  });

  it('returns top center', () => {
    expect(sideCenter(rect, 'top')).toEqual([1, 2.3]);
  });

  it('returns bottom center', () => {
    expect(sideCenter(rect, 'bottom')).toEqual([1, 1.7]);
  });
});

// ─── portAnchor ──────────────────────────────────────────────────────────────

describe('portAnchor', () => {
  const rect = makeRect('n1', 0, 0, 1, 1); // 2x2 node centered at origin

  it('returns side center for single port', () => {
    expect(portAnchor(rect, 'right', 0, 1)).toEqual([1, 0]);
  });

  it('distributes two ports along the right side', () => {
    const p0 = portAnchor(rect, 'right', 0, 2);
    const p1 = portAnchor(rect, 'right', 1, 2);
    // t0 = 1/3, t1 = 2/3 of the side span [-1, 1]
    expect(p0[0]).toBe(1);
    expect(p0[1]).toBeCloseTo(-1 + 2 * (1 / 3));
    expect(p1[0]).toBe(1);
    expect(p1[1]).toBeCloseTo(-1 + 2 * (2 / 3));
  });

  it('distributes ports along the top side', () => {
    const p0 = portAnchor(rect, 'top', 0, 3);
    const p1 = portAnchor(rect, 'top', 1, 3);
    const p2 = portAnchor(rect, 'top', 2, 3);
    // y = 1 (top), x distributed: t = 1/4, 2/4, 3/4 along [-1, 1]
    expect(p0[1]).toBe(1);
    expect(p1[1]).toBe(1);
    expect(p2[1]).toBe(1);
    expect(p0[0]).toBeCloseTo(-1 + 2 * (1 / 4));
    expect(p1[0]).toBeCloseTo(-1 + 2 * (2 / 4));
    expect(p2[0]).toBeCloseTo(-1 + 2 * (3 / 4));
  });

  it('returns side center when portCount is zero', () => {
    expect(portAnchor(rect, 'left', 0, 0)).toEqual([-1, 0]);
  });
});

// ─── selectSides ─────────────────────────────────────────────────────────────

describe('selectSides', () => {
  const leftRect = makeRect('left', -2, 0, 0.5, 0.5);
  const rightRect = makeRect('right', 2, 0, 0.5, 0.5);
  const topRect = makeRect('top', 0, 2, 0.5, 0.5);
  const bottomRect = makeRect('bottom', 0, -2, 0.5, 0.5);

  it('selects right/left for a horizontal pair', () => {
    const request = makeRequest('e1', 'left', 'right');
    const sel = selectSides(request, leftRect, rightRect);
    expect(sel.sourceSide).toBe('right');
    expect(sel.destinationSide).toBe('left');
  });

  it('selects top/bottom for a vertical pair', () => {
    const request = makeRequest('e1', 'bottom', 'top');
    const sel = selectSides(request, bottomRect, topRect);
    expect(sel.sourceSide).toBe('top');
    expect(sel.destinationSide).toBe('bottom');
  });

  it('uses locked fromPort when specified', () => {
    const request = makeRequest('e1', 'left', 'right', { fromPort: 'top' });
    const sel = selectSides(request, leftRect, rightRect);
    expect(sel.sourceSide).toBe('top');
  });

  it('uses locked toPort when specified', () => {
    const request = makeRequest('e1', 'left', 'right', { toPort: 'bottom' });
    const sel = selectSides(request, leftRect, rightRect);
    expect(sel.destinationSide).toBe('bottom');
  });

  it('uses locked fromPort AND toPort together', () => {
    const request = makeRequest('e1', 'left', 'right', { fromPort: 'bottom', toPort: 'top' });
    const sel = selectSides(request, leftRect, rightRect);
    expect(sel.sourceSide).toBe('bottom');
    expect(sel.destinationSide).toBe('top');
  });

  it('computes stub points offset from anchors', () => {
    const request = makeRequest('e1', 'left', 'right');
    const sel = selectSides(request, leftRect, rightRect);
    // Source stub should be anchor + normal * faceStub to the right
    const stubOffset = DEFAULT_FLOW_CONFIG.faceStub;
    expect(sel.sourceStub[0]).toBeCloseTo(sel.sourceAnchor[0] + stubOffset);
    expect(sel.sourceStub[1]).toBeCloseTo(sel.sourceAnchor[1]);
    // Dest stub should be anchor + normal * faceStub to the left
    expect(sel.destinationStub[0]).toBeCloseTo(sel.destinationAnchor[0] - stubOffset);
    expect(sel.destinationStub[1]).toBeCloseTo(sel.destinationAnchor[1]);
  });

  it('applies bundle hint to override source side', () => {
    const request = makeRequest('e1', 'left', 'right');
    const hint = { sourceSide: 'top' as SideId, lateralOffset: 0 };
    const sel = selectSides(request, leftRect, rightRect, hint);
    expect(sel.sourceSide).toBe('top');
  });

  it('applies bundle hint lateral offset', () => {
    const request = makeRequest('e1', 'left', 'right');
    const hint = { sourceSide: 'top' as SideId, lateralOffset: 0.2 };
    const sel = selectSides(request, leftRect, rightRect, hint);
    expect(sel.sourceSide).toBe('top');
    // Anchor should be offset laterally from center of top side
    const topCenter = sideCenter(leftRect, 'top');
    expect(sel.sourceAnchor[0]).toBeCloseTo(topCenter[0] + 0.2);
    expect(sel.sourceAnchor[1]).toBeCloseTo(topCenter[1]);
  });

  it('fromPort takes priority over bundle hint', () => {
    const request = makeRequest('e1', 'left', 'right', { fromPort: 'bottom' });
    const hint = { sourceSide: 'top' as SideId, lateralOffset: 0 };
    const sel = selectSides(request, leftRect, rightRect, hint);
    expect(sel.sourceSide).toBe('bottom');
  });
});

// ─── inferBundleHints ────────────────────────────────────────────────────────

describe('inferBundleHints', () => {
  it('returns empty map when no edges', () => {
    const result = inferBundleHints([], new Map());
    expect(result.size).toBe(0);
  });

  it('returns empty map for a single flow edge', () => {
    const rects = new Map<string, NodeRect>([
      ['a', makeRect('a', 0, 0, 0.5, 0.5)],
      ['b', makeRect('b', 2, 2, 0.5, 0.5)],
    ]);
    const edges = [makeRequest('e1', 'a', 'b')];
    const result = inferBundleHints(edges, rects);
    expect(result.size).toBe(0);
  });

  it('returns empty map for non-flow edges', () => {
    const rects = new Map<string, NodeRect>([
      ['a', makeRect('a', 0, 0, 0.5, 0.5)],
      ['b', makeRect('b', -2, 2, 0.5, 0.5)],
      ['c', makeRect('c', 2, 2, 0.5, 0.5)],
    ]);
    const edges = [
      makeRequest('e1', 'a', 'b', { profile: 'curved' }),
      makeRequest('e2', 'a', 'c', { profile: 'curved' }),
    ];
    const result = inferBundleHints(edges, rects);
    expect(result.size).toBe(0);
  });

  it('generates bundle hints for sibling flow edges fanning upward', () => {
    const rects = new Map<string, NodeRect>([
      ['a', makeRect('a', 0, 0, 0.5, 0.5)],
      ['b', makeRect('b', -2, 2, 0.5, 0.5)],
      ['c', makeRect('c', 2, 2, 0.5, 0.5)],
    ]);
    const edges = [
      makeRequest('e1', 'a', 'b'),
      makeRequest('e2', 'a', 'c'),
    ];
    const result = inferBundleHints(edges, rects);
    expect(result.size).toBe(2);

    const h1 = result.get('e1');
    const h2 = result.get('e2');
    expect(h1).toBeDefined();
    expect(h2).toBeDefined();
    expect(h1!.sourceSide).toBe('top');
    expect(h2!.sourceSide).toBe('top');
    expect(h1!.sharedTrunkKey).toBe('a:top');
    expect(h2!.sharedTrunkKey).toBe('a:top');
  });

  it('generates bottom-side hints for targets fanning downward', () => {
    const rects = new Map<string, NodeRect>([
      ['a', makeRect('a', 0, 0, 0.5, 0.5)],
      ['b', makeRect('b', -2, -2, 0.5, 0.5)],
      ['c', makeRect('c', 2, -2, 0.5, 0.5)],
    ]);
    const edges = [
      makeRequest('e1', 'a', 'b'),
      makeRequest('e2', 'a', 'c'),
    ];
    const result = inferBundleHints(edges, rects);
    expect(result.size).toBe(2);
    expect(result.get('e1')!.sourceSide).toBe('bottom');
    expect(result.get('e2')!.sourceSide).toBe('bottom');
  });

  it('assigns zero lateral offset to bundled edges (shared anchor for trunk sharing)', () => {
    const rects = new Map<string, NodeRect>([
      ['a', makeRect('a', 0, 0, 0.5, 0.5)],
      ['b', makeRect('b', -2, 2, 0.5, 0.5)],
      ['c', makeRect('c', 2, 2, 0.5, 0.5)],
    ]);
    const edges = [
      makeRequest('e1', 'a', 'b'),
      makeRequest('e2', 'a', 'c'),
    ];
    const result = inferBundleHints(edges, rects);
    // All bundled edges share the same source anchor (zero offset)
    // so the trunk optimizer can detect and trim shared leading segments.
    expect(result.get('e1')!.lateralOffset).toBe(0);
    expect(result.get('e2')!.lateralOffset).toBe(0);
  });

  it('skips edges with explicit fromPort', () => {
    const rects = new Map<string, NodeRect>([
      ['a', makeRect('a', 0, 0, 0.5, 0.5)],
      ['b', makeRect('b', -2, 2, 0.5, 0.5)],
      ['c', makeRect('c', 2, 2, 0.5, 0.5)],
    ]);
    const edges = [
      makeRequest('e1', 'a', 'b', { fromPort: 'left' }),
      makeRequest('e2', 'a', 'c'),
    ];
    const result = inferBundleHints(edges, rects);
    // Only e2 is in the group, which is only 1 edge → no bundle.
    expect(result.size).toBe(0);
  });

  it('does not bundle when targets are all on one side', () => {
    const rects = new Map<string, NodeRect>([
      ['a', makeRect('a', 0, 0, 0.5, 0.5)],
      ['b', makeRect('b', 2, 2, 0.5, 0.5)],
      ['c', makeRect('c', 3, 2, 0.5, 0.5)],
    ]);
    const edges = [
      makeRequest('e1', 'a', 'b'),
      makeRequest('e2', 'a', 'c'),
    ];
    const result = inferBundleHints(edges, rects);
    expect(result.size).toBe(0);
  });
});
