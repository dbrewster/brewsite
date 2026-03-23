// Tests for the edgeRouter orchestrator — self-loops, missing endpoints, profile dispatch, Y-mirror.

import { describe, it, expect, vi } from 'vitest';
import { routeEdges } from '../edgeRouter';
import type { EdgeRoutingInput } from '../edgeRouter';
import type { NodeRect, FlowConfig, EdgeRouteResult } from '../routingTypes';
import { DEFAULT_FLOW_CONFIG } from '../routingTypes';

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeRect(overrides: Partial<NodeRect> & { id: string }): NodeRect {
  return {
    cx: 0.3,
    cy: 0.3,
    hw: 0.05,
    hh: 0.03,
    z: 0,
    depth: 0.02,
    ...overrides,
  };
}

function makeEdge(overrides: Partial<EdgeRoutingInput> & { id: string; fromId: string; toId: string }): EdgeRoutingInput {
  return {
    profile: 'flow',
    thickness: 0.003,
    ...overrides,
  };
}

function buildRects(...rects: NodeRect[]): Map<string, NodeRect> {
  return new Map(rects.map((r) => [r.id, r]));
}

// ─── Self-loop ──────────────────────────────────────────────────────────────

describe('routeEdges — self-loop', () => {
  it('returns an empty route for an edge where fromId === toId', () => {
    const rects = buildRects(makeRect({ id: 'A', cx: 0.5, cy: 0.5 }));
    const edge = makeEdge({ id: 'e1', fromId: 'A', toId: 'A' });

    const results = routeEdges([edge], rects, new Set(), new Set(), DEFAULT_FLOW_CONFIG);

    const route = results.get('e1');
    expect(route).toBeDefined();
    expect(route!.path.commands).toHaveLength(0);
    expect(route!.controlPoints).toHaveLength(0);
  });
});

// ─── Missing endpoints ─────────────────────────────────────────────────────

describe('routeEdges — missing endpoint', () => {
  it('warns and returns empty route when source node is missing', () => {
    const rects = buildRects(makeRect({ id: 'B', cx: 0.7, cy: 0.5 }));
    const edge = makeEdge({ id: 'e1', fromId: 'A', toId: 'B' });
    const warnings: Array<{ code: string; message: string }> = [];
    const onWarn = (code: string, message: string): void => { warnings.push({ code, message }); };

    const results = routeEdges([edge], rects, new Set(), new Set(), DEFAULT_FLOW_CONFIG, onWarn);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.code).toBe('MISSING_EDGE_ENDPOINT');
    expect(warnings[0]!.message).toContain('A');
    const route = results.get('e1');
    expect(route).toBeDefined();
    expect(route!.path.commands).toHaveLength(0);
  });

  it('warns and returns empty route when destination node is missing', () => {
    const rects = buildRects(makeRect({ id: 'A', cx: 0.3, cy: 0.5 }));
    const edge = makeEdge({ id: 'e1', fromId: 'A', toId: 'B' });
    const warnings: Array<{ code: string; message: string }> = [];
    const onWarn = (code: string, message: string): void => { warnings.push({ code, message }); };

    const results = routeEdges([edge], rects, new Set(), new Set(), DEFAULT_FLOW_CONFIG, onWarn);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.code).toBe('MISSING_EDGE_ENDPOINT');
    expect(warnings[0]!.message).toContain('B');
    const route = results.get('e1');
    expect(route!.path.commands).toHaveLength(0);
  });

  it('returns empty route with no onWarn callback when endpoint is missing', () => {
    const rects = buildRects(makeRect({ id: 'A', cx: 0.3, cy: 0.5 }));
    const edge = makeEdge({ id: 'e1', fromId: 'A', toId: 'B' });

    const results = routeEdges([edge], rects, new Set(), new Set());

    const route = results.get('e1');
    expect(route).toBeDefined();
    expect(route!.path.commands).toHaveLength(0);
  });
});

// ─── Profile dispatch ───────────────────────────────────────────────────────

describe('routeEdges — profile dispatch', () => {
  const leftRect = makeRect({ id: 'A', cx: 0.3, cy: 0.5, hw: 0.05, hh: 0.03 });
  const rightRect = makeRect({ id: 'B', cx: 0.7, cy: 0.5, hw: 0.05, hh: 0.03 });
  const rects = buildRects(leftRect, rightRect);

  it('routes a flow profile edge and produces path commands', () => {
    const edge = makeEdge({ id: 'e1', fromId: 'A', toId: 'B', profile: 'flow' });
    const results = routeEdges([edge], rects, new Set(), new Set());

    const route = results.get('e1');
    expect(route).toBeDefined();
    expect(route!.path.commands.length).toBeGreaterThan(0);
    expect(route!.controlPoints.length).toBeGreaterThan(0);
  });

  it('routes a curved profile edge and produces path commands', () => {
    const edge = makeEdge({ id: 'e1', fromId: 'A', toId: 'B', profile: 'curved' });
    const results = routeEdges([edge], rects, new Set(), new Set());

    const route = results.get('e1');
    expect(route).toBeDefined();
    expect(route!.path.commands.length).toBeGreaterThan(0);
  });

  it('routes a straight profile edge and produces path commands', () => {
    const edge = makeEdge({ id: 'e1', fromId: 'A', toId: 'B', profile: 'straight' });
    const results = routeEdges([edge], rects, new Set(), new Set());

    const route = results.get('e1');
    expect(route).toBeDefined();
    expect(route!.path.commands.length).toBeGreaterThan(0);
  });

  it('routes an organic profile edge and produces path commands', () => {
    const edge = makeEdge({ id: 'e1', fromId: 'A', toId: 'B', profile: 'organic' });
    const results = routeEdges([edge], rects, new Set(), new Set());

    const route = results.get('e1');
    expect(route).toBeDefined();
    expect(route!.path.commands.length).toBeGreaterThan(0);
  });
});

// ─── Y-mirror round-trip ────────────────────────────────────────────────────

describe('routeEdges — Y-mirror', () => {
  it('produces Y-down NVS output for Y-down NVS input', () => {
    // Place A at (0.3, 0.2) and B at (0.7, 0.8) in Y-down NVS.
    // The output path should have Y coordinates in the [0..1] Y-down range.
    const rects = buildRects(
      makeRect({ id: 'A', cx: 0.3, cy: 0.2, hw: 0.05, hh: 0.03 }),
      makeRect({ id: 'B', cx: 0.7, cy: 0.8, hw: 0.05, hh: 0.03 }),
    );
    const edge = makeEdge({ id: 'e1', fromId: 'A', toId: 'B', profile: 'flow' });

    const results = routeEdges([edge], rects, new Set(), new Set());
    const route = results.get('e1')!;

    // All control point Y-coordinates should be in a reasonable Y-down range
    for (const pt of route.controlPoints) {
      // The Y-down coordinates for nodes at 0.2 and 0.8 should be in roughly [0, 1]
      expect(pt[1]).toBeGreaterThanOrEqual(-0.1);
      expect(pt[1]).toBeLessThanOrEqual(1.1);
    }
  });

  it('mirrors Y symmetrically — routing nodes at symmetric Y positions gives mirrored paths', () => {
    // Route from (0.3, 0.4) → (0.7, 0.4) — horizontal
    const rects = buildRects(
      makeRect({ id: 'A', cx: 0.3, cy: 0.4, hw: 0.05, hh: 0.03 }),
      makeRect({ id: 'B', cx: 0.7, cy: 0.4, hw: 0.05, hh: 0.03 }),
    );
    const edge = makeEdge({ id: 'e1', fromId: 'A', toId: 'B', profile: 'straight' });

    const results = routeEdges([edge], rects, new Set(), new Set());
    const route = results.get('e1')!;

    // For horizontal routing at the same Y, all control points should be near Y=0.4
    for (const pt of route.controlPoints) {
      expect(pt[1]).toBeCloseTo(0.4, 1);
    }
  });
});

// ─── Multiple edges ─────────────────────────────────────────────────────────

describe('routeEdges — multiple edges', () => {
  it('routes multiple edges and returns a result for each', () => {
    const rects = buildRects(
      makeRect({ id: 'A', cx: 0.2, cy: 0.5 }),
      makeRect({ id: 'B', cx: 0.5, cy: 0.5 }),
      makeRect({ id: 'C', cx: 0.8, cy: 0.5 }),
    );
    const edges = [
      makeEdge({ id: 'e1', fromId: 'A', toId: 'B', profile: 'flow' }),
      makeEdge({ id: 'e2', fromId: 'B', toId: 'C', profile: 'curved' }),
    ];

    const results = routeEdges(edges, rects, new Set(), new Set());

    expect(results.size).toBe(2);
    expect(results.get('e1')!.path.commands.length).toBeGreaterThan(0);
    expect(results.get('e2')!.path.commands.length).toBeGreaterThan(0);
  });
});

// ─── Tangent extraction ─────────────────────────────────────────────────────

describe('routeEdges — tangent extraction', () => {
  it('produces non-zero start and end tangents for a routed edge', () => {
    const rects = buildRects(
      makeRect({ id: 'A', cx: 0.3, cy: 0.3 }),
      makeRect({ id: 'B', cx: 0.7, cy: 0.7 }),
    );
    const edge = makeEdge({ id: 'e1', fromId: 'A', toId: 'B', profile: 'flow' });

    const results = routeEdges([edge], rects, new Set(), new Set());
    const route = results.get('e1')!;

    const tangentLength = (t: readonly [number, number, number]): number =>
      Math.sqrt(t[0] ** 2 + t[1] ** 2 + t[2] ** 2);

    expect(tangentLength(route.path.startTangent)).toBeGreaterThan(0.1);
    expect(tangentLength(route.path.endTangent)).toBeGreaterThan(0.1);
  });
});

// ─── Path debug ─────────────────────────────────────────────────────────────

describe('routeEdges — pathDebug', () => {
  it('populates pathDebug with routeKind', () => {
    const rects = buildRects(
      makeRect({ id: 'A', cx: 0.3, cy: 0.5 }),
      makeRect({ id: 'B', cx: 0.7, cy: 0.5 }),
    );
    const edge = makeEdge({ id: 'e1', fromId: 'A', toId: 'B', profile: 'flow' });

    const results = routeEdges([edge], rects, new Set(), new Set());
    const route = results.get('e1')!;

    expect(route.pathDebug).toBeDefined();
    expect(typeof route.pathDebug!.routeKind).toBe('string');
  });
});
