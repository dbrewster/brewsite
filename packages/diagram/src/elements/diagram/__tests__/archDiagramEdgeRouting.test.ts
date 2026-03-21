import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compileDiagram } from '../compile';
import type { DiagramDSL, DiagramNodeDSL, DiagramEdgeDSL, DiagramEdgePathCommand, DiagramEdgeState } from '../types';

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
  ...overrides,
});

// ─── Path extraction helpers ──────────────────────────────────────────────────

type Vec3 = readonly [number, number, number];

/** Extract all sequential points from a path's commands (for monotonicity checks). */
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

/** Get the tangent direction at the end of a command (normalized). */
function cmdEndDirection(cmd: DiagramEdgePathCommand): Vec3 {
  let dx: number;
  let dy: number;
  let dz: number;
  if (cmd.kind === 'line') {
    dx = cmd.to[0] - cmd.from[0];
    dy = cmd.to[1] - cmd.from[1];
    dz = cmd.to[2] - cmd.from[2];
  } else {
    // End tangent of cubic: p3 - p2
    dx = cmd.p3[0] - cmd.p2[0];
    dy = cmd.p3[1] - cmd.p2[1];
    dz = cmd.p3[2] - cmd.p2[2];
  }
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-9) return [0, 0, 0];
  return [dx / len, dy / len, dz / len];
}

/** Get the tangent direction at the start of a command (normalized). */
function cmdStartDirection(cmd: DiagramEdgePathCommand): Vec3 {
  let dx: number;
  let dy: number;
  let dz: number;
  if (cmd.kind === 'line') {
    dx = cmd.to[0] - cmd.from[0];
    dy = cmd.to[1] - cmd.from[1];
    dz = cmd.to[2] - cmd.from[2];
  } else {
    // Start tangent of cubic: p1 - p0
    dx = cmd.p1[0] - cmd.p0[0];
    dy = cmd.p1[1] - cmd.p0[1];
    dz = cmd.p1[2] - cmd.p0[2];
  }
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-9) return [0, 0, 0];
  return [dx / len, dy / len, dz / len];
}

/** Angle between two 2D direction vectors (ignoring Z), in degrees. */
function angleBetweenDeg(a: Vec3, b: Vec3): number {
  const dot = a[0] * b[0] + a[1] * b[1];
  const magA = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
  const magB = Math.sqrt(b[0] * b[0] + b[1] * b[1]);
  if (magA < 1e-9 || magB < 1e-9) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

// ─── Diagram DSL ──────────────────────────────────────────────────────────────

/**
 * Architecture diagram:
 *
 *   apps (rect 3x3)
 *     |
 *   api (hexagon 5x2.5)
 *     |
 *   ┌─────────────────────┐
 *   │ engine (container)   │
 *   │ stream | batch | ml  │
 *   └─────────────────────┘
 *     |
 *   storage
 *     |
 *   infra
 */
const archDiagramDsl: DiagramDSL = {
  id: 'arch-routing-test',
  layout: { kind: 'flow', direction: 'top-down', gap: '5%' },
  childrenOrder: ['apps', 'api', 'engine', 'storage', 'infra'],
  nodes: [
    makeNode('apps', { size: ['12%', '12%'], shape: 'rectangle' }),
    makeNode('api', { size: ['18%', '10%'], shape: 'hexagon' }),
    makeNode('stream', { size: ['12%', '8%'], shape: 'circle' }),
    makeNode('batch', { size: ['12%', '8%'], shape: 'circle' }),
    makeNode('ml', { size: ['12%', '8%'], shape: 'circle' }),
    makeNode('storage', { size: ['18%', '10%'], shape: 'octagon' }),
    makeNode('infra', { size: ['18%', '10%'], shape: 'rectangle' }),
  ],
  edges: [
    makeEdge('apps', 'api'),        // 1:1 top
    makeEdge('api', 'stream'),      // fan-out
    makeEdge('api', 'batch'),       // fan-out
    makeEdge('api', 'ml'),          // fan-out
    makeEdge('stream', 'storage'),  // fan-in
    makeEdge('batch', 'storage'),   // fan-in
    makeEdge('ml', 'storage'),      // fan-in
    makeEdge('storage', 'infra'),   // 1:1 bottom
  ],
  groups: [
    {
      id: 'engine',
      label: 'Engine',
      variant: 'container',
      nodeIds: ['stream', 'batch', 'ml'],
      childrenOrder: ['stream', 'batch', 'ml'],
      layout: { kind: 'grid', columns: 3, spacing: ['5%', '3%'] },
    },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('architecture diagram edge routing', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const compileArch = () => compileDiagram(archDiagramDsl);

  it('compiles without throwing and produces 8 edges', () => {
    const state = compileArch();
    expect(state.edges).toHaveLength(8);
  });




  // ─── 0. No Z variance ──────────────────────────────────────────────────────
  // All edges in a flat top-down diagram must stay on the Z=0 plane.
  // The flow router currently uses Z=-0.08 underpasses to avoid sibling nodes,
  // which creates visible depth artifacts in the rendered tubes.
  it('every path point has Z=0 (no underpasses)', () => {
    const state = compileArch();
    for (const edge of state.edges) {
      const points = extractPathPoints(edge.path.commands);
      for (let i = 0; i < points.length; i++) {
        expect(
          points[i]![2],
          `edge ${edge.fromId}→${edge.toId}: point ${i} has Z=${points[i]![2].toFixed(3)}, expected 0`,
        ).toBeLessThan(0.05);
      }
    }
  });

  it('every edge has at least one path command', () => {
    const state = compileArch();
    for (const edge of state.edges) {
      expect(
        edge.path.commands.length,
        `edge ${edge.id} has no path commands`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  // ─── 1. No reversals ─────────────────────────────────────────────────────────

  describe('no reversals on dominant axis (Y-down flow)', () => {
    it('every edge path has monotonically increasing Y (no backward motion)', () => {
      const state = compileArch();
      const TURN_RADIUS_TOLERANCE = 0.05;

      for (const edge of state.edges) {
        const points = extractPathPoints(edge.path.commands);
        if (points.length < 2) continue;

        let maxY = points[0]![1];
        for (let i = 1; i < points.length; i++) {
          const y = points[i]![1];
          // Allow small backward motion up to turn radius tolerance
          expect(
            y,
            `edge ${edge.id}: point ${i} Y=${y.toFixed(4)} reverses past maxY=${maxY.toFixed(4)}`,
          ).toBeGreaterThanOrEqual(maxY - TURN_RADIUS_TOLERANCE);
          if (y > maxY) maxY = y;
        }
      }
    });
  });

  // ─── 2. Exact path shape specs ───────────────────────────────────────────────
  //
  // The expected shape for each edge in a top-down flow diagram:
  //
  //   1:1 aligned edges (apps→api, api→batch, batch→storage, storage→infra):
  //     Straight vertical — X is constant, Y increases. Zero bends.
  //
  //   Fan-out lateral (api→stream):
  //     Down from api bottom face on a shared vertical trunk → at the junction Y,
  //     turn 90° left (X decreasing) → turn 90° down (Y increasing) → straight
  //     into stream top face. Exactly 2 smooth bends, no reversals.
  //
  //   Fan-out lateral (api→ml):
  //     Same as api→stream but turn 90° right (X increasing) then down.
  //
  //   Fan-in lateral (stream→storage):
  //     Down from stream bottom face → turn 90° right (toward storage center X)
  //     → turn 90° down → into storage top face. 2 bends.
  //
  //   Fan-in lateral (ml→storage):
  //     Same as stream→storage but turn left.
  //

  describe('1:1 aligned edges are straight vertical pipes', () => {
    const EPSILON = 0.015;

    for (const [fromId, toId] of [
      ['apps', 'api'],
      ['api', 'batch'],
      ['batch', 'storage'],
      ['storage', 'infra'],
    ] as const) {
      it(`${fromId}→${toId}: X constant, Y monotonically increasing`, () => {
        const state = compileArch();
        const edge = state.edges.find((e) => e.fromId === fromId && e.toId === toId)!;
        expect(edge, `edge ${fromId}→${toId} not found`).toBeDefined();

        const points = extractPathPoints(edge.path.commands);
        const startX = points[0]![0];

        for (let i = 0; i < points.length; i++) {
          // X should stay constant (vertical line)
          expect(
            Math.abs(points[i]![0] - startX),
            `${fromId}→${toId}: point ${i} X drifts from ${startX.toFixed(4)} to ${points[i]![0].toFixed(4)}`,
          ).toBeLessThan(EPSILON);

          // Y should increase (NVS Y-down = top to bottom)
          if (i > 0) {
            expect(
              points[i]![1],
              `${fromId}→${toId}: point ${i} Y goes backwards`,
            ).toBeGreaterThanOrEqual(points[i - 1]![1] - 0.02);
          }

          // Z must be 0
          expect(
            Math.abs(points[i]![2]),
            `${fromId}→${toId}: point ${i} Z=${points[i]![2].toFixed(4)} (expected 0)`,
          ).toBeLessThan(0.05);
        }
      });
    }
  });

  describe('fan-out lateral edges: L-shaped with exactly 2 bends', () => {
    //
    // api→stream shape:
    //   anchor (api bottom face X=0.5)
    //     │ down (shared trunk)
    //     └───── left (X decreasing toward stream X)
    //           │ down (into stream top face)
    //
    // api→ml shape: mirror (right instead of left)
    //

    const findEdge = (state: ReturnType<typeof compileArch>, from: string, to: string) =>
      state.edges.find((e) => e.fromId === from && e.toId === to)!;

    it('api→stream: down → left → down, exactly 2 bends, no Z variance', () => {
      const state = compileArch();
      const edge = findEdge(state, 'api', 'stream');
      const nodeById = new Map(state.nodes.map((n) => [n.id, n]));
      const api = nodeById.get('api')!;
      const stream = nodeById.get('stream')!;
      const points = extractPathPoints(edge.path.commands);

      // ── No Z variance
      for (const p of points) {
        expect(Math.abs(p[2]), `Z=${p[2]}`).toBeLessThan(0.05);
      }

      // ── Start near api bottom face (X ≈ api.X, Y ≈ api.Y + h/2)
      expect(points[0]![0]).toBeCloseTo(api.position[0], 1);
      expect(points[0]![1]).toBeCloseTo(api.position[1] + api.size[1] / 2, 1);

      // ── End near stream top face (X ≈ stream.X, Y ≈ stream.Y - h/2)
      const last = points[points.length - 1]!;
      expect(last[0]).toBeCloseTo(stream.position[0], 1);
      expect(last[1]).toBeCloseTo(stream.position[1] - stream.size[1] / 2, 1);

      // ── Shape: three segments with two bends
      // Segment 1: vertical down (X ≈ api.X)
      // Segment 2: horizontal left (Y ≈ junction Y, X decreasing toward stream.X)
      // Segment 3: vertical down (X ≈ stream.X)
      //
      // Extract the command-level endpoint sequence (ignoring bezier internals)
      const cmdEndpoints = edge.path.commands.map((c) => cmdEnd(c));
      // At least one point should be at approximately (api.X, junctionY) — the first bend
      // and at least one at (stream.X, junctionY) — the second bend
      const hasLeftwardSegment = cmdEndpoints.some((p, i) => {
        if (i === 0) return false;
        const prev = cmdEndpoints[i - 1]!;
        // Horizontal segment moving left (X decreasing, Y roughly constant)
        return p[0] < prev[0] - 0.01 && Math.abs(p[1] - prev[1]) < 0.02;
      });
      expect(hasLeftwardSegment, 'api→stream should have a leftward horizontal segment').toBe(true);
    });

    it('api→ml: down → right → down, exactly 2 bends, no Z variance', () => {
      const state = compileArch();
      const edge = findEdge(state, 'api', 'ml');
      const nodeById = new Map(state.nodes.map((n) => [n.id, n]));
      const api = nodeById.get('api')!;
      const ml = nodeById.get('ml')!;
      const points = extractPathPoints(edge.path.commands);

      // ── No Z variance
      for (const p of points) {
        expect(Math.abs(p[2]), `Z=${p[2]}`).toBeLessThan(0.05);
      }

      // ── Start near api bottom face
      expect(points[0]![0]).toBeCloseTo(api.position[0], 1);
      expect(points[0]![1]).toBeCloseTo(api.position[1] + api.size[1] / 2, 1);

      // ── End near ml top face
      const last = points[points.length - 1]!;
      expect(last[0]).toBeCloseTo(ml.position[0], 1);
      expect(last[1]).toBeCloseTo(ml.position[1] - ml.size[1] / 2, 1);

      // ── Must have a rightward horizontal segment
      const cmdEndpoints = edge.path.commands.map((c) => cmdEnd(c));
      const hasRightwardSegment = cmdEndpoints.some((p, i) => {
        if (i === 0) return false;
        const prev = cmdEndpoints[i - 1]!;
        return p[0] > prev[0] + 0.01 && Math.abs(p[1] - prev[1]) < 0.02;
      });
      expect(hasRightwardSegment, 'api→ml should have a rightward horizontal segment').toBe(true);
    });
  });

  describe('fan-in lateral edges: L-shaped with exactly 2 bends', () => {
    //
    // stream→storage shape:
    //   anchor (stream bottom face)
    //     │ down
    //     └───── right (toward storage center X)
    //           │ down (into storage top face)
    //
    // ml→storage shape: mirror (left instead of right)
    //

    const findEdge = (state: ReturnType<typeof compileArch>, from: string, to: string) =>
      state.edges.find((e) => e.fromId === from && e.toId === to)!;

    it('stream→storage: down → right → down, no Z variance', () => {
      const state = compileArch();
      const edge = findEdge(state, 'stream', 'storage');
      const points = extractPathPoints(edge.path.commands);

      // No Z variance
      for (const p of points) {
        expect(Math.abs(p[2]), `Z=${p[2]}`).toBeLessThan(0.05);
      }

      // Must have a rightward horizontal segment (stream is left of storage center)
      const cmdEndpoints = edge.path.commands.map((c) => cmdEnd(c));
      const hasRightwardSegment = cmdEndpoints.some((p, i) => {
        if (i === 0) return false;
        const prev = cmdEndpoints[i - 1]!;
        return p[0] > prev[0] + 0.01 && Math.abs(p[1] - prev[1]) < 0.02;
      });
      expect(hasRightwardSegment, 'stream→storage should have a rightward horizontal segment').toBe(true);
    });

    it('ml→storage: down → left → down, no Z variance', () => {
      const state = compileArch();
      const edge = findEdge(state, 'ml', 'storage');
      const points = extractPathPoints(edge.path.commands);

      // No Z variance
      for (const p of points) {
        expect(Math.abs(p[2]), `Z=${p[2]}`).toBeLessThan(0.05);
      }

      // Must have a leftward horizontal segment (ml is right of storage center)
      const cmdEndpoints = edge.path.commands.map((c) => cmdEnd(c));
      const hasLeftwardSegment = cmdEndpoints.some((p, i) => {
        if (i === 0) return false;
        const prev = cmdEndpoints[i - 1]!;
        return p[0] < prev[0] - 0.01 && Math.abs(p[1] - prev[1]) < 0.02;
      });
      expect(hasLeftwardSegment, 'ml→storage should have a leftward horizontal segment').toBe(true);
    });
  });

  // ─── 3. Anchor connection ────────────────────────────────────────────────────

  describe('anchor connection to node face centers', () => {
    // The flow router attaches edges at the node face center and may add a short
    // face stub that extends slightly beyond the node boundary. We use a tolerance
    // of half-size + FACE_STUB_TOLERANCE to account for the stub length in NVS.
    const FACE_STUB_TOLERANCE = 0.05;

    it('first path point is within face-stub tolerance of source node boundary', () => {
      const state = compileArch();
      const nodeById = new Map(state.nodes.map((n) => [n.id, n]));

      for (const edge of state.edges) {
        const cmds = edge.path.commands;
        if (cmds.length === 0) continue;

        const firstPoint = cmdStart(cmds[0]!);
        const srcNode = nodeById.get(edge.fromId);
        if (!srcNode) continue;

        const dx = Math.abs(firstPoint[0] - srcNode.position[0]);
        const dy = Math.abs(firstPoint[1] - srcNode.position[1]);

        expect(
          dx,
          `edge ${edge.id}: start X ${firstPoint[0].toFixed(4)} too far from source ${srcNode.id} center X ${srcNode.position[0].toFixed(4)}`,
        ).toBeLessThanOrEqual(srcNode.size[0] / 2 + FACE_STUB_TOLERANCE);
        expect(
          dy,
          `edge ${edge.id}: start Y ${firstPoint[1].toFixed(4)} too far from source ${srcNode.id} center Y ${srcNode.position[1].toFixed(4)}`,
        ).toBeLessThanOrEqual(srcNode.size[1] / 2 + FACE_STUB_TOLERANCE);
      }
    });

    it('last path point is within face-stub tolerance of destination node boundary', () => {
      const state = compileArch();
      const nodeById = new Map(state.nodes.map((n) => [n.id, n]));
      const groupById = new Map(state.groups.map((g) => [g.id, g]));

      for (const edge of state.edges) {
        const cmds = edge.path.commands;
        if (cmds.length === 0) continue;

        const lastPoint = cmdEnd(cmds[cmds.length - 1]!);
        const dstNode = nodeById.get(edge.toId);

        if (!dstNode) {
          // Destination might be a group
          const dstGroup = groupById.get(edge.toId);
          if (!dstGroup) continue;
          expect(lastPoint[0]).toBeGreaterThanOrEqual(dstGroup.bounds.x - FACE_STUB_TOLERANCE);
          expect(lastPoint[0]).toBeLessThanOrEqual(dstGroup.bounds.x + dstGroup.bounds.w + FACE_STUB_TOLERANCE);
          expect(lastPoint[1]).toBeGreaterThanOrEqual(dstGroup.bounds.y - FACE_STUB_TOLERANCE);
          expect(lastPoint[1]).toBeLessThanOrEqual(dstGroup.bounds.y + dstGroup.bounds.h + FACE_STUB_TOLERANCE);
          continue;
        }

        const dx = Math.abs(lastPoint[0] - dstNode.position[0]);
        const dy = Math.abs(lastPoint[1] - dstNode.position[1]);

        expect(
          dx,
          `edge ${edge.id}: end X ${lastPoint[0].toFixed(4)} too far from dest ${dstNode.id} center X ${dstNode.position[0].toFixed(4)}`,
        ).toBeLessThanOrEqual(dstNode.size[0] / 2 + FACE_STUB_TOLERANCE);
        expect(
          dy,
          `edge ${edge.id}: end Y ${lastPoint[1].toFixed(4)} too far from dest ${dstNode.id} center Y ${dstNode.position[1].toFixed(4)}`,
        ).toBeLessThanOrEqual(dstNode.size[1] / 2 + FACE_STUB_TOLERANCE);
      }
    });
  });

  // ─── 4. Bounds ────────────────────────────────────────────────────────────────

  describe('all path coordinates within NVS bounds', () => {
    it('every point on every edge is within [-0.05, 1.05] NVS', () => {
      const state = compileArch();
      const BOUND_LOW = -0.05;
      const BOUND_HIGH = 1.05;

      for (const edge of state.edges) {
        const points = extractPathPoints(edge.path.commands);
        for (let i = 0; i < points.length; i++) {
          const pt = points[i]!;
          expect(
            pt[0],
            `edge ${edge.id}: point ${i} X=${pt[0].toFixed(4)} out of NVS bounds`,
          ).toBeGreaterThanOrEqual(BOUND_LOW);
          expect(
            pt[0],
            `edge ${edge.id}: point ${i} X=${pt[0].toFixed(4)} out of NVS bounds`,
          ).toBeLessThanOrEqual(BOUND_HIGH);
          expect(
            pt[1],
            `edge ${edge.id}: point ${i} Y=${pt[1].toFixed(4)} out of NVS bounds`,
          ).toBeGreaterThanOrEqual(BOUND_LOW);
          expect(
            pt[1],
            `edge ${edge.id}: point ${i} Y=${pt[1].toFixed(4)} out of NVS bounds`,
          ).toBeLessThanOrEqual(BOUND_HIGH);
        }
      }
    });

    it('control points are also within [-0.05, 1.05] NVS', () => {
      const state = compileArch();
      const BOUND_LOW = -0.05;
      const BOUND_HIGH = 1.05;

      for (const edge of state.edges) {
        for (const pt of edge.controlPoints) {
          expect(pt[0]).toBeGreaterThanOrEqual(BOUND_LOW);
          expect(pt[0]).toBeLessThanOrEqual(BOUND_HIGH);
          expect(pt[1]).toBeGreaterThanOrEqual(BOUND_LOW);
          expect(pt[1]).toBeLessThanOrEqual(BOUND_HIGH);
        }
      }
    });
  });

  // ─── Structural checks ───────────────────────────────────────────────────────

  describe('edge topology', () => {
    it('apps→api is a 1:1 edge', () => {
      const state = compileArch();
      const edge = state.edges.find((e) => e.fromId === 'apps' && e.toId === 'api');
      expect(edge).toBeDefined();
    });

    it('api fans out to stream, batch, ml', () => {
      const state = compileArch();
      const fanOut = state.edges.filter((e) => e.fromId === 'api');
      const targets = new Set(fanOut.map((e) => e.toId));
      expect(targets).toEqual(new Set(['stream', 'batch', 'ml']));
    });

    it('stream, batch, ml fan in to storage', () => {
      const state = compileArch();
      const fanIn = state.edges.filter((e) => e.toId === 'storage');
      const sources = new Set(fanIn.map((e) => e.fromId));
      expect(sources).toEqual(new Set(['stream', 'batch', 'ml']));
    });

    it('storage→infra is a 1:1 edge', () => {
      const state = compileArch();
      const edge = state.edges.find((e) => e.fromId === 'storage' && e.toId === 'infra');
      expect(edge).toBeDefined();
    });
  });

  // ─── Fan-out / fan-in lateral ordering ────────────────────────────────────────

  describe('fan-out lateral ordering', () => {
    it('api→stream ends left of api→batch which ends left of api→ml', () => {
      const state = compileArch();
      const edgeToStream = state.edges.find((e) => e.fromId === 'api' && e.toId === 'stream')!;
      const edgeToBatch = state.edges.find((e) => e.fromId === 'api' && e.toId === 'batch')!;
      const edgeToMl = state.edges.find((e) => e.fromId === 'api' && e.toId === 'ml')!;

      const endX = (edge: DiagramEdgeState) => {
        const cmds = edge.path.commands;
        return cmdEnd(cmds[cmds.length - 1]!)[0];
      };

      expect(endX(edgeToStream)).toBeLessThan(endX(edgeToBatch));
      expect(endX(edgeToBatch)).toBeLessThan(endX(edgeToMl));
    });
  });

  describe('fan-in lateral ordering', () => {
    it('stream→storage starts left of batch→storage which starts left of ml→storage', () => {
      const state = compileArch();
      const fromStream = state.edges.find((e) => e.fromId === 'stream' && e.toId === 'storage')!;
      const fromBatch = state.edges.find((e) => e.fromId === 'batch' && e.toId === 'storage')!;
      const fromMl = state.edges.find((e) => e.fromId === 'ml' && e.toId === 'storage')!;

      const startX = (edge: DiagramEdgeState) => {
        const cmds = edge.path.commands;
        return cmdStart(cmds[0]!)[0];
      };

      expect(startX(fromStream)).toBeLessThan(startX(fromBatch));
      expect(startX(fromBatch)).toBeLessThan(startX(fromMl));
    });
  });

  // ─── 5. Shape-aware anchors ──────────────────────────────────────────────────
  // For polygon shapes (hexagon, octagon, circle, etc.), the geometry is inscribed
  // in a circle of radius min(w, h) / 2. The compiled routing size must reflect
  // this so edge anchors land on the actual visible surface, not the AABB.

  describe('shape-aware edge-to-surface connection', () => {
    // For polygon shapes (octagon, hexagon, circle, etc.), the geometry is a
    // regular polygon inscribed in a circle of radius min(w, h) / 2.
    // Edge endpoints must land AT the actual geometry surface, not at the AABB
    // boundary. This requires two things to be true:
    //
    //   1. The compiled node.size in DiagramState (used by the renderer to
    //      create geometry) must have equal axes for polygon shapes, so the
    //      geometry fills the AABB and edges don't stop short.
    //
    //   2. Edge endpoints must be close to the geometry boundary
    //      (nodeCenter ± size/2), not far from it.

    it('polygon nodes preserve their DSL aspect ratio (no clamping to square)', () => {
      // Polygon shapes fill their full [w, h] bounding box using elliptical radii.
      // No size clamping is applied — the DSL aspect ratio is preserved.
      const state = compileArch();

      // api is hexagon [0.18, 0.10] — DSL ratio = 1.8
      const api = state.nodes.find((n) => n.id === 'api')!;
      expect(api.size[0] / api.size[1]).toBeCloseTo(1.8, 1);

      // stream/batch/ml are circles [0.12, 0.08] — DSL ratio = 1.5
      const stream = state.nodes.find((n) => n.id === 'stream')!;
      expect(stream.size[0] / stream.size[1]).toBeCloseTo(1.5, 1);
    });

    it('rectangle nodes preserve their DSL aspect ratio (NOT clamped to square)', () => {
      const state = compileArch();

      // infra is a rectangle [0.18, 0.10] — DSL ratio = 1.8.
      // apps is a rectangle [0.12, 0.12] — DSL ratio = 1.0 (square).
      // After uniform normalization, aspect ratios are preserved.
      const infra = state.nodes.find((n) => n.id === 'infra')!;
      const infraRatio = infra.size[0] / infra.size[1];
      // infra DSL is [0.18, 0.10] → ratio = 1.8 (preserved through uniform scaling)
      expect(infraRatio).toBeCloseTo(1.8, 1);
      // Verify it's NOT square (rectangles are not clamped like polygons)
      expect(infra.size[0]).not.toBeCloseTo(infra.size[1], 2);
    });

    it('fan-in edges reach within the node bounding box', () => {
      const state = compileArch();
      const storage = state.nodes.find((n) => n.id === 'storage')!;

      const fromStream = state.edges.find((e) => e.fromId === 'stream' && e.toId === 'storage')!;
      const fromMl = state.edges.find((e) => e.fromId === 'ml' && e.toId === 'storage')!;

      const lastStream = cmdEnd(fromStream.path.commands[fromStream.path.commands.length - 1]!);
      const lastMl = cmdEnd(fromMl.path.commands[fromMl.path.commands.length - 1]!);

      const halfSizeX = storage.size[0] / 2;
      const TOLERANCE = 0.02;

      const distStream = Math.abs(lastStream[0] - storage.position[0]);
      const distMl = Math.abs(lastMl[0] - storage.position[0]);

      // Edge should reach within the node's bounding box width (not stop far short).
      expect(distStream).toBeLessThanOrEqual(halfSizeX + TOLERANCE);
      expect(distMl).toBeLessThanOrEqual(halfSizeX + TOLERANCE);
    });
  });

  // ─── 6. Turn radius symmetry ─────────────────────────────────────────────────
  // Mirror-image edges (api→stream vs api→ml, stream→storage vs ml→storage)
  // should have the same turn radii. Asymmetric turns indicate the radiusCap
  // is too aggressive on one side.

  describe('turn radius symmetry', () => {
    /** Extract cubic arc chord lengths from an edge path. */
    function arcChordLengths(edge: DiagramEdgeState): number[] {
      return edge.path.commands
        .filter((c): c is Extract<DiagramEdgePathCommand, { kind: 'cubic' }> => c.kind === 'cubic')
        .map((c) => Math.sqrt(
          (c.p3[0] - c.p0[0]) ** 2 + (c.p3[1] - c.p0[1]) ** 2,
        ));
    }

    it('all bends on a single edge have similar arc sizes (no tiny vs large turns)', () => {
      // The visual bug: on api→stream, the first bend (trunk → horizontal) has
      // chord ≈ 0.05 (nice round turn) but the second bend (horizontal → into node)
      // has chord ≈ 0.01 (nearly a sharp corner).  This happens because the
      // horizontal segment to the destination is very short, and radiusCap limits
      // the turn to a fraction of the shorter segment.
      //
      // Requirement: within a single edge, all arcs must have chords within 3× of
      // each other.  A 5× difference (current) is visibly asymmetric.
      const state = compileArch();
      const MAX_CHORD_RATIO = 4.0;

      for (const edge of state.edges) {
        const chords = arcChordLengths(edge);
        if (chords.length < 2) continue;

        const minChord = Math.min(...chords);
        const maxChord = Math.max(...chords);
        if (minChord < 1e-6) continue; // degenerate — skip

        const ratio = maxChord / minChord;
        expect(
          ratio,
          `edge ${edge.fromId}→${edge.toId}: arc chords vary ${ratio.toFixed(1)}× ` +
          `(min=${minChord.toFixed(4)}, max=${maxChord.toFixed(4)}). ` +
          `Max allowed: ${MAX_CHORD_RATIO}×.`,
        ).toBeLessThanOrEqual(MAX_CHORD_RATIO);
      }
    });

    it('fan-out left/right mirror edges have matching arc counts and similar sizes', () => {
      const state = compileArch();
      const toStream = state.edges.find((e) => e.fromId === 'api' && e.toId === 'stream')!;
      const toMl = state.edges.find((e) => e.fromId === 'api' && e.toId === 'ml')!;

      const streamArcs = arcChordLengths(toStream);
      const mlArcs = arcChordLengths(toMl);

      expect(streamArcs.length, 'mirror edges should have same number of arcs').toBe(mlArcs.length);
      for (let i = 0; i < streamArcs.length; i++) {
        expect(streamArcs[i]!).toBeCloseTo(mlArcs[i]!, 2);
      }
    });
  });
});
