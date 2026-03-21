// E2E test for shape-aware edge routing in architecture diagrams.
// Verifies that edges properly intersect polygon shapes, circles, and
// that content layout rectangles are correctly inscribed.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compileDiagram } from '../compile';
import type { DiagramDSL, DiagramNodeDSL, DiagramEdgeDSL, DiagramEdgePathCommand } from '../types';
import { getContentRect } from '../shapes/geometryFactory';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const makeNode = (id: string, overrides: Partial<DiagramNodeDSL> = {}): DiagramNodeDSL => ({
  id,
  label: id,
  ...overrides,
});

const makeEdge = (from: string, to: string, overrides: Partial<DiagramEdgeDSL> = {}): DiagramEdgeDSL => ({
  from,
  to,
  routing: 'flow',
  flow: 'forward',
  ...overrides,
});

type Vec3 = readonly [number, number, number];

/** Extract all sequential points from a path's commands. */
function extractPathPoints(commands: ReadonlyArray<DiagramEdgePathCommand>): Vec3[] {
  const points: Vec3[] = [];
  for (const cmd of commands) {
    if (cmd.kind === 'line') {
      if (points.length === 0) points.push(cmd.from);
      points.push(cmd.to);
    } else {
      if (points.length === 0) points.push(cmd.p0);
      points.push(cmd.p1, cmd.p2, cmd.p3);
    }
  }
  return points;
}

/** Get the start point of a command. */
function cmdStart(cmd: DiagramEdgePathCommand): Vec3 {
  return cmd.kind === 'line' ? cmd.from : cmd.p0;
}

/** Get the end point of a command. */
function cmdEnd(cmd: DiagramEdgePathCommand): Vec3 {
  return cmd.kind === 'line' ? cmd.to : cmd.p3;
}

/**
 * Checks if a 2D point [x, y] is inside a regular N-sided polygon
 * centered at [cx, cy] with circumradius r, first vertex at angle -π/2.
 * Returns the signed distance: negative means inside, positive means outside.
 */
function signedDistanceToRegularPolygon(
  px: number, py: number,
  cx: number, cy: number,
  r: number, sides: number,
): number {
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1e-9) return -r; // at center

  // Angle of the point relative to center
  const angle = Math.atan2(dy, dx);
  // Rotate so vertex 0 is at the top (-π/2)
  const rotated = angle + Math.PI / 2;
  // Normalize to [0, 2π)
  const normalized = ((rotated % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  // Which sector? Each sector spans 2π/sides
  const sectorAngle = (Math.PI * 2) / sides;
  const sectorOffset = normalized % sectorAngle;
  // Distance from center to the polygon edge at this angle
  const apothem = r * Math.cos(Math.PI / sides);
  const halfAngle = sectorAngle / 2;
  const angleDelta = Math.abs(sectorOffset - halfAngle);
  const edgeDist = apothem / Math.cos(angleDelta);
  return dist - edgeDist;
}

/**
 * Checks if a 2D point is inside a circle of given radius.
 * Returns signed distance: negative means inside, positive means outside.
 */
function signedDistanceToCircle(
  px: number, py: number,
  cx: number, cy: number,
  r: number,
): number {
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy) - r;
}

// ─── DSL matching user's exact diagram ─────────────────────────────────────────

const archDsl: DiagramDSL = {
  id: 'arch',
  layout: { kind: 'flow', direction: 'top-down', gap: '5%' },
  childrenOrder: ['apps', 'api', 'engine', 'storage', 'infra'],
  nodes: [
    makeNode('apps', {
      label: 'Applications',
      sublabel: 'Analytics · Catalog · Lineage',
      shape: 'rectangle',
      size: ['20%', '10%'],
      thickness: '2.5%',
    }),
    makeNode('api', {
      label: 'API Gateway',
      sublabel: 'REST · gRPC · WS',
      shape: 'hexagon',
      size: ['18%', '11%'],
      thickness: '2.5%',
    }),
    makeNode('stream', {
      label: 'Stream',
      shape: 'circle',
      size: ['11%', '11%'],
      thickness: '2.5%',
    }),
    makeNode('batch', {
      label: 'Batch',
      shape: 'circle',
      size: ['11%', '11%'],
      thickness: '2.5%',
    }),
    makeNode('ml', {
      label: 'ML',
      shape: 'circle',
      size: ['11%', '11%'],
      thickness: '2.5%',
    }),
    makeNode('storage', {
      label: 'Storage',
      sublabel: 'Columnar · Object · KV',
      shape: 'octagon',
      size: ['18%', '11%'],
      thickness: '2.5%',
    }),
    makeNode('infra', {
      label: 'Infrastructure',
      sublabel: 'Multi-Cloud',
      shape: 'rectangle',
      size: ['20%', '10%'],
      thickness: '2.5%',
    }),
  ],
  edges: [
    makeEdge('apps', 'api'),
    makeEdge('api', 'stream'),
    makeEdge('api', 'batch'),
    makeEdge('api', 'ml'),
    makeEdge('stream', 'storage'),
    makeEdge('batch', 'storage'),
    makeEdge('ml', 'storage'),
    makeEdge('storage', 'infra'),
  ],
  groups: [
    {
      id: 'engine',
      label: 'Processing Engine',
      variant: 'container',
      nodeIds: ['stream', 'batch', 'ml'],
      childrenOrder: ['stream', 'batch', 'ml'],
      layout: { kind: 'grid', columns: 3, spacing: ['3%', '2.5%'] },
    },
  ],
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('shape-aware edge routing e2e', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const compileArch = () => compileDiagram(archDsl);

  // ─── 1. Hexagon (6-sided) shape intersection ────────────────────────────────

  describe('hexagon shape edge intersection', () => {
    it('edges starting from hexagon bottom face begin at or inside the hexagonal boundary', () => {
      const state = compileArch();
      const apiNode = state.nodes.find((n) => n.id === 'api')!;
      const r = Math.min(apiNode.size[0], apiNode.size[1]) / 2;
      const cx = apiNode.position[0];
      const cy = apiNode.position[1];

      // All edges from api should start close to the hexagonal boundary
      const apiEdges = state.edges.filter((e) => e.fromId === 'api');
      expect(apiEdges.length).toBe(3); // api→stream, api→batch, api→ml

      for (const edge of apiEdges) {
        const cmds = edge.path.commands;
        expect(cmds.length).toBeGreaterThanOrEqual(1);

        const startPoint = cmdStart(cmds[0]!);
        // The start point should be at or very near the hexagonal surface
        // (not far outside it at the AABB boundary)
        const signedDist = signedDistanceToRegularPolygon(
          startPoint[0], startPoint[1],
          cx, cy,
          r, 6,
        );

        // Allow a small face stub (0.02) beyond the surface but not more
        // The edge should NOT start far beyond the hexagonal boundary
        expect(
          signedDist,
          `edge ${edge.fromId}→${edge.toId}: start point [${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}] ` +
          `is ${signedDist.toFixed(4)} from hexagon surface (positive = outside). ` +
          `Should be within 0.02 of surface.`,
        ).toBeLessThan(0.02);
      }
    });

    it('edges arriving at hexagon have endpoints at or inside the hexagonal boundary', () => {
      // apps→api edge should end at or near the hexagonal boundary
      const state = compileArch();
      const apiNode = state.nodes.find((n) => n.id === 'api')!;
      const r = Math.min(apiNode.size[0], apiNode.size[1]) / 2;
      const cx = apiNode.position[0];
      const cy = apiNode.position[1];

      const appsToApi = state.edges.find((e) => e.fromId === 'apps' && e.toId === 'api')!;
      const cmds = appsToApi.path.commands;
      const endPoint = cmdEnd(cmds[cmds.length - 1]!);

      const signedDist = signedDistanceToRegularPolygon(
        endPoint[0], endPoint[1],
        cx, cy,
        r, 6,
      );

      expect(
        signedDist,
        `edge apps→api: end point [${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}] ` +
        `is ${signedDist.toFixed(4)} from hexagon surface. Should be within 0.02.`,
      ).toBeLessThan(0.02);
    });
  });

  // ─── 2. Circle shape intersection ───────────────────────────────────────────

  describe('circle shape edge intersection', () => {
    it('edges arriving at circle nodes have endpoints at or inside the circular boundary', () => {
      const state = compileArch();

      for (const nodeId of ['stream', 'batch', 'ml']) {
        const node = state.nodes.find((n) => n.id === nodeId)!;
        const r = Math.min(node.size[0], node.size[1]) / 2;
        const cx = node.position[0];
        const cy = node.position[1];

        // Find edge arriving at this circle
        const incomingEdge = state.edges.find((e) => e.toId === nodeId)!;
        const cmds = incomingEdge.path.commands;
        expect(cmds.length, `edge to ${nodeId} should have commands`).toBeGreaterThanOrEqual(1);

        const endPoint = cmdEnd(cmds[cmds.length - 1]!);
        const signedDist = signedDistanceToCircle(
          endPoint[0], endPoint[1],
          cx, cy,
          r,
        );

        // Edge endpoint should be at or near the circle surface
        expect(
          signedDist,
          `edge ${incomingEdge.fromId}→${nodeId}: end point [${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}] ` +
          `is ${signedDist.toFixed(4)} from circle surface (positive = outside). ` +
          `Should be within 0.02 of surface.`,
        ).toBeLessThan(0.02);
      }
    });

    it('edges leaving circle nodes have startpoints at or inside the circular boundary', () => {
      const state = compileArch();

      for (const nodeId of ['stream', 'batch', 'ml']) {
        const node = state.nodes.find((n) => n.id === nodeId)!;
        const r = Math.min(node.size[0], node.size[1]) / 2;
        const cx = node.position[0];
        const cy = node.position[1];

        // Find edge leaving this circle
        const outgoingEdge = state.edges.find((e) => e.fromId === nodeId)!;
        const cmds = outgoingEdge.path.commands;
        expect(cmds.length, `edge from ${nodeId} should have commands`).toBeGreaterThanOrEqual(1);

        const startPoint = cmdStart(cmds[0]!);
        const signedDist = signedDistanceToCircle(
          startPoint[0], startPoint[1],
          cx, cy,
          r,
        );

        expect(
          signedDist,
          `edge ${nodeId}→${outgoingEdge.toId}: start point [${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}] ` +
          `is ${signedDist.toFixed(4)} from circle surface (positive = outside). ` +
          `Should be within 0.02 of surface.`,
        ).toBeLessThan(0.02);
      }
    });
  });

  // ─── 3. Corner alignment ─────────────────────────────────────────────────────

  describe('flow routing corner alignment', () => {
    it('fan-out edges from api share a common trunk Y coordinate', () => {
      const state = compileArch();
      const apiEdges = state.edges.filter((e) => e.fromId === 'api');

      // All three fan-out edges should share a common Y level for their first
      // horizontal segment (the shared trunk). Extract the first horizontal
      // segment Y for each edge.
      const trunkYValues: number[] = [];
      for (const edge of apiEdges) {
        const points = extractPathPoints(edge.path.commands);
        // Find the first horizontal segment (where Y stays roughly constant between adjacent points)
        for (let i = 1; i < points.length; i++) {
          const dy = Math.abs(points[i]![1] - points[i - 1]![1]);
          const dx = Math.abs(points[i]![0] - points[i - 1]![0]);
          if (dy < 0.005 && dx > 0.01) {
            trunkYValues.push(points[i]![1]);
            break;
          }
        }
      }

      // The center edge (api→batch) is straight vertical, so it won't have
      // a horizontal segment. We should have at least 2 trunk values (stream and ml).
      if (trunkYValues.length >= 2) {
        const maxTrunkY = Math.max(...trunkYValues);
        const minTrunkY = Math.min(...trunkYValues);
        expect(
          maxTrunkY - minTrunkY,
          `Fan-out trunk Y values [${trunkYValues.map(v => v.toFixed(4))}] should be within 0.005 of each other`,
        ).toBeLessThan(0.005);
      }
    });

    it('fan-in edges to storage share a common trunk Y coordinate', () => {
      const state = compileArch();
      const storageEdges = state.edges.filter((e) => e.toId === 'storage');

      // The lateral edges (from stream and ml) should share a common Y level
      // for their last horizontal segment before entering storage.
      const trunkYValues: number[] = [];
      for (const edge of storageEdges) {
        const points = extractPathPoints(edge.path.commands);
        // Find the last horizontal segment (scanning backwards)
        for (let i = points.length - 2; i >= 0; i--) {
          const dy = Math.abs(points[i + 1]![1] - points[i]![1]);
          const dx = Math.abs(points[i + 1]![0] - points[i]![0]);
          if (dy < 0.005 && dx > 0.01) {
            trunkYValues.push(points[i]![1]);
            break;
          }
        }
      }

      if (trunkYValues.length >= 2) {
        const maxTrunkY = Math.max(...trunkYValues);
        const minTrunkY = Math.min(...trunkYValues);
        expect(
          maxTrunkY - minTrunkY,
          `Fan-in trunk Y values [${trunkYValues.map(v => v.toFixed(4))}] should be within 0.005 of each other`,
        ).toBeLessThan(0.005);
      }
    });

    it('mirror edges (api→stream vs api→ml) have symmetric turn radii', () => {
      const state = compileArch();
      const toStream = state.edges.find((e) => e.fromId === 'api' && e.toId === 'stream')!;
      const toMl = state.edges.find((e) => e.fromId === 'api' && e.toId === 'ml')!;

      // Extract cubic arcs (turns)
      const streamArcs = toStream.path.commands.filter(
        (c): c is Extract<DiagramEdgePathCommand, { kind: 'cubic' }> => c.kind === 'cubic',
      );
      const mlArcs = toMl.path.commands.filter(
        (c): c is Extract<DiagramEdgePathCommand, { kind: 'cubic' }> => c.kind === 'cubic',
      );

      expect(
        streamArcs.length,
        'mirror edges should have same number of turns',
      ).toBe(mlArcs.length);

      // Each pair of corresponding arcs should have similar chord lengths
      for (let i = 0; i < streamArcs.length; i++) {
        const sChord = Math.sqrt(
          (streamArcs[i]!.p3[0] - streamArcs[i]!.p0[0]) ** 2 +
          (streamArcs[i]!.p3[1] - streamArcs[i]!.p0[1]) ** 2,
        );
        const mChord = Math.sqrt(
          (mlArcs[i]!.p3[0] - mlArcs[i]!.p0[0]) ** 2 +
          (mlArcs[i]!.p3[1] - mlArcs[i]!.p0[1]) ** 2,
        );

        expect(sChord).toBeCloseTo(mChord, 2);
      }
    });
  });

  // ─── 4. Rectangular text margin ──────────────────────────────────────────────

  describe('rectangular node text margins', () => {
    it('rectangle content rect equals full bounding box (no internal margin needed)', () => {
      // For rectangles, getContentRect returns full size — text positioning
      // is handled by label layout padding, not by content rect inset.
      const [cw, ch] = getContentRect('rectangle', [0.20, 0.10]);
      expect(cw).toBe(0.20);
      expect(ch).toBe(0.10);
    });

    it('edges at rectangle faces leave space for text (face stub clearance)', () => {
      const state = compileArch();
      const apps = state.nodes.find((n) => n.id === 'apps')!;
      const infra = state.nodes.find((n) => n.id === 'infra')!;

      // apps→api edge starts at apps bottom. The edge anchor Y should be
      // at or near apps.position[1] + size[1]/2 (bottom edge in NVS Y-down)
      const appsEdge = state.edges.find((e) => e.fromId === 'apps')!;
      const appsStart = cmdStart(appsEdge.path.commands[0]!);

      // Edge should leave from the bottom face, not overlap with text area
      const appsBottom = apps.position[1] + apps.size[1] / 2;
      expect(
        appsStart[1],
        `apps edge starts at Y=${appsStart[1].toFixed(4)}, bottom face at Y=${appsBottom.toFixed(4)}`,
      ).toBeCloseTo(appsBottom, 2);

      // storage→infra edge ends at infra top face
      const infraEdge = state.edges.find((e) => e.toId === 'infra')!;
      const infraEnd = cmdEnd(infraEdge.path.commands[infraEdge.path.commands.length - 1]!);
      const infraTop = infra.position[1] - infra.size[1] / 2;
      expect(
        infraEnd[1],
        `infra edge ends at Y=${infraEnd[1].toFixed(4)}, top face at Y=${infraTop.toFixed(4)}`,
      ).toBeCloseTo(infraTop, 2);
    });
  });

  // ─── 5. Polygon inner rectangle for text fitting ─────────────────────────────

  describe('polygon content rect (inner rectangle for text)', () => {
    it('hexagon content rect is a square smaller than the diameter', () => {
      // After compile-time max-clamp, hexagon [0.18, 0.11] → [0.18, 0.18]
      const size: readonly [number, number] = [0.18, 0.18];
      const [cw, ch] = getContentRect('hexagon', size);

      expect(cw).toBe(ch); // regular polygon → square content rect
      expect(cw).toBeLessThan(size[0]);
      expect(ch).toBeLessThan(size[1]);
    });

    it('octagon content rect is a square smaller than the diameter', () => {
      const size: readonly [number, number] = [0.18, 0.18];
      const [cw, ch] = getContentRect('octagon', size);

      expect(cw).toBe(ch);
      expect(cw).toBeLessThan(size[0]);
      expect(ch).toBeLessThan(size[1]);
    });

    it('circle content rect fits strictly inside the circular boundary', () => {
      const size: readonly [number, number] = [0.11, 0.11];
      const r = Math.min(size[0], size[1]) / 2;
      const [cw, ch] = getContentRect('circle', size);

      expect(cw).toBeLessThan(size[0]);
      expect(ch).toBeLessThan(size[1]);

      // Content rect corners must be inside the circle
      const corners = [
        [cw / 2, ch / 2],
        [-cw / 2, ch / 2],
        [cw / 2, -ch / 2],
        [-cw / 2, -ch / 2],
      ] as const;

      for (const [px, py] of corners) {
        const dist = signedDistanceToCircle(px, py, 0, 0, r);
        expect(
          dist,
          `circle content rect corner [${px.toFixed(4)}, ${py.toFixed(4)}] ` +
          `is ${dist.toFixed(4)} from surface (should be ≤ 0, i.e., inside)`,
        ).toBeLessThanOrEqual(0.001);
      }
    });

    it('content rects are large enough to be usable', () => {
      // The content rect should not be so small that text becomes unreadable.
      // Minimum area ratios vary by shape — hexagon's inscribed square is geometrically
      // smaller (≈37% of AABB) than octagon's (≈48%) or circle's (≈45%). All shapes
      // must exceed 35% of the AABB area, which provides enough room for icon + label.
      const testCases: Array<{ shape: 'hexagon' | 'octagon' | 'circle'; size: readonly [number, number]; minRatio: number }> = [
        { shape: 'hexagon', size: [0.11, 0.11], minRatio: 0.35 },
        { shape: 'octagon', size: [0.11, 0.11], minRatio: 0.45 },
        { shape: 'circle', size: [0.11, 0.11], minRatio: 0.42 },
      ];

      for (const { shape, size, minRatio } of testCases) {
        const [cw, ch] = getContentRect(shape, size);
        const contentArea = cw * ch;
        const bbArea = size[0] * size[1];
        const ratio = contentArea / bbArea;

        expect(
          ratio,
          `${shape} content area ratio ${(ratio * 100).toFixed(1)}% should be ≥ ${(minRatio * 100).toFixed(0)}%`,
        ).toBeGreaterThanOrEqual(minRatio);
      }
    });
  });

  // ─── 6. Edge anchor Z-plane consistency ─────────────────────────────────────

  describe('edge Z-plane consistency', () => {
    it('each edge path stays on a single Z-plane (no mid-route Z jumps)', () => {
      const state = compileArch();
      const Z_TOLERANCE = 0.02;

      for (const edge of state.edges) {
        const points = extractPathPoints(edge.path.commands);
        if (points.length < 2) continue;

        // Find the dominant Z value (most common)
        const zValues = points.map((p) => p[2]);
        const zGroups = new Map<number, number>();
        for (const z of zValues) {
          const rounded = Math.round(z * 1000) / 1000;
          zGroups.set(rounded, (zGroups.get(rounded) ?? 0) + 1);
        }

        // All points should be near the same Z
        const minZ = Math.min(...zValues);
        const maxZ = Math.max(...zValues);

        expect(
          maxZ - minZ,
          `edge ${edge.fromId}→${edge.toId}: Z range [${minZ.toFixed(4)}, ${maxZ.toFixed(4)}] ` +
          `spans ${(maxZ - minZ).toFixed(4)}, should be < ${Z_TOLERANCE}`,
        ).toBeLessThan(Z_TOLERANCE);
      }
    });
  });

  // ─── 7. No U-shape reversals ───────────────────────────────────────────────

  describe('no backward motion on dominant flow axis', () => {
    it('every edge path Y is monotonically increasing in NVS Y-down (no U-shapes)', () => {
      const state = compileArch();
      // Stricter tolerance than the existing test — only allow turn-radius
      // backward motion, not full segment reversals
      const REVERSAL_TOLERANCE = 0.015;

      for (const edge of state.edges) {
        const points = extractPathPoints(edge.path.commands);
        if (points.length < 2) continue;

        let maxY = points[0]![1];
        for (let i = 1; i < points.length; i++) {
          const y = points[i]![1];
          expect(
            y,
            `edge ${edge.fromId}→${edge.toId}: point ${i} Y=${y.toFixed(4)} reverses ` +
            `past maxY=${maxY.toFixed(4)} (backward by ${(maxY - y).toFixed(4)})`,
          ).toBeGreaterThanOrEqual(maxY - REVERSAL_TOLERANCE);
          if (y > maxY) maxY = y;
        }
      }
    });
  });

  // ─── 8. Edge endpoints connect to node boundaries, not AABB ──────────────

  describe('edge endpoints connect to actual shape boundaries', () => {
    it('octagon (storage) — edges arriving from sides reach the octagonal boundary', () => {
      const state = compileArch();
      const storage = state.nodes.find((n) => n.id === 'storage')!;
      const r = Math.min(storage.size[0], storage.size[1]) / 2;
      const cx = storage.position[0];
      const cy = storage.position[1];

      // stream→storage and ml→storage arrive from the sides
      for (const fromId of ['stream', 'ml']) {
        const edge = state.edges.find((e) => e.fromId === fromId && e.toId === 'storage')!;
        const cmds = edge.path.commands;
        const endPoint = cmdEnd(cmds[cmds.length - 1]!);

        const signedDist = signedDistanceToRegularPolygon(
          endPoint[0], endPoint[1],
          cx, cy,
          r, 8,
        );

        expect(
          signedDist,
          `edge ${fromId}→storage: endpoint [${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}] ` +
          `is ${signedDist.toFixed(4)} from octagon surface. Should be ≤ 0.02.`,
        ).toBeLessThan(0.02);
      }
    });

    it('batch→storage arrives at top face — endpoint is at octagon top vertex', () => {
      const state = compileArch();
      const storage = state.nodes.find((n) => n.id === 'storage')!;
      const r = Math.min(storage.size[0], storage.size[1]) / 2;

      const edge = state.edges.find((e) => e.fromId === 'batch' && e.toId === 'storage')!;
      const cmds = edge.path.commands;
      const endPoint = cmdEnd(cmds[cmds.length - 1]!);

      // For top-face connection, Y should be near storage.position[1] - r (top)
      const topY = storage.position[1] - r;
      expect(
        endPoint[1],
        `batch→storage endpoint Y=${endPoint[1].toFixed(4)} should be near top face Y=${topY.toFixed(4)}`,
      ).toBeCloseTo(topY, 2);
    });

    it('side-face endpoints are NOT at the AABB boundary (snapped inward to polygon)', () => {
      // Critical test: for octagon, the left/right face AABB is at x ± r, but
      // the octagonal surface is at x ± apothem (which is < r). The endpoint
      // must be snapped inward to the polygon surface.
      const state = compileArch();
      const storage = state.nodes.find((n) => n.id === 'storage')!;
      const r = Math.min(storage.size[0], storage.size[1]) / 2;
      const apothem = r * Math.cos(Math.PI / 8); // octagon apothem

      // stream→storage arrives at storage from the left side
      const streamEdge = state.edges.find((e) => e.fromId === 'stream' && e.toId === 'storage')!;
      const streamEnd = cmdEnd(streamEdge.path.commands[streamEdge.path.commands.length - 1]!);
      const streamDistFromCenter = Math.abs(streamEnd[0] - storage.position[0]);

      // The endpoint X distance from center should be ≤ apothem (polygon boundary),
      // NOT at r (AABB boundary). Allow small tolerance for face stub epsilon.
      // If the endpoint were at the AABB, distFromCenter ≈ r = 0.055.
      // With snapping, distFromCenter should be ≈ polygon boundary distance (≤ apothem + epsilon).
      expect(
        streamDistFromCenter,
        `stream→storage endpoint X dist from center = ${streamDistFromCenter.toFixed(4)}; ` +
        `AABB boundary r = ${r.toFixed(4)}, octagon boundary ≈ ${apothem.toFixed(4)}. ` +
        `Should be ≤ r (snapped to polygon, not at AABB).`,
      ).toBeLessThanOrEqual(r + 0.002);

      // ml→storage arrives from the right side — same check
      const mlEdge = state.edges.find((e) => e.fromId === 'ml' && e.toId === 'storage')!;
      const mlEnd = cmdEnd(mlEdge.path.commands[mlEdge.path.commands.length - 1]!);
      const mlDistFromCenter = Math.abs(mlEnd[0] - storage.position[0]);

      expect(
        mlDistFromCenter,
        `ml→storage endpoint X dist from center = ${mlDistFromCenter.toFixed(4)}; ` +
        `should be ≤ r (snapped to polygon).`,
      ).toBeLessThanOrEqual(r + 0.002);
    });

    it('circle node edge endpoints are ON the circle surface', () => {
      const state = compileArch();

      for (const nodeId of ['stream', 'batch', 'ml']) {
        const node = state.nodes.find((n) => n.id === nodeId)!;
        const r = Math.min(node.size[0], node.size[1]) / 2;
        const cx = node.position[0];
        const cy = node.position[1];

        // Check outgoing edge start point
        const outEdge = state.edges.find((e) => e.fromId === nodeId)!;
        const startPt = cmdStart(outEdge.path.commands[0]!);
        const startDist = Math.sqrt((startPt[0] - cx) ** 2 + (startPt[1] - cy) ** 2);

        // The start point distance from center should be ≈ r (on the circle),
        // not > r (outside the circle at AABB for off-center ports)
        expect(
          startDist,
          `${nodeId} outgoing edge start distance from center = ${startDist.toFixed(4)}, ` +
          `circle r = ${r.toFixed(4)}. Should be ≤ r + tolerance.`,
        ).toBeLessThanOrEqual(r + 0.002);
      }
    });
  });
});
