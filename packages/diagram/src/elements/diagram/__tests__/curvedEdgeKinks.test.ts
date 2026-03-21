// E2E test for curved edge kinks in manual-layout diagrams.
// Reproduces the core-showcase overview diagram where edges between
// nodes at different Y levels produce S-curve inflection kinks.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compileDiagram } from '../compile';
import type { DiagramDSL, DiagramNodeDSL, DiagramEdgeDSL, DiagramEdgePathCommand } from '../types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

type Vec3 = readonly [number, number, number];

const makeNode = (id: string, overrides: Partial<DiagramNodeDSL> = {}): DiagramNodeDSL => ({
  id,
  label: id,
  ...overrides,
});

const makeEdge = (from: string, to: string, overrides: Partial<DiagramEdgeDSL> = {}): DiagramEdgeDSL => ({
  from,
  to,
  ...overrides,
});

/** Get the tangent direction at the end of a command (normalized). */
function cmdEndDirection(cmd: DiagramEdgePathCommand): Vec3 {
  let dx: number, dy: number, dz: number;
  if (cmd.kind === 'line') { dx = cmd.to[0] - cmd.from[0]; dy = cmd.to[1] - cmd.from[1]; dz = cmd.to[2] - cmd.from[2]; }
  else { dx = cmd.p3[0] - cmd.p2[0]; dy = cmd.p3[1] - cmd.p2[1]; dz = cmd.p3[2] - cmd.p2[2]; }
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return len < 1e-9 ? [0, 0, 0] : [dx / len, dy / len, dz / len];
}

/** Get the tangent direction at the start of a command (normalized). */
function cmdStartDirection(cmd: DiagramEdgePathCommand): Vec3 {
  let dx: number, dy: number, dz: number;
  if (cmd.kind === 'line') { dx = cmd.to[0] - cmd.from[0]; dy = cmd.to[1] - cmd.from[1]; dz = cmd.to[2] - cmd.from[2]; }
  else { dx = cmd.p1[0] - cmd.p0[0]; dy = cmd.p1[1] - cmd.p0[1]; dz = cmd.p1[2] - cmd.p0[2]; }
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return len < 1e-9 ? [0, 0, 0] : [dx / len, dy / len, dz / len];
}

/** Angle between two 2D direction vectors (ignoring Z), in degrees. */
function angleBetweenDeg(a: Vec3, b: Vec3): number {
  const dot = a[0] * b[0] + a[1] * b[1];
  const magA = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
  const magB = Math.sqrt(b[0] * b[0] + b[1] * b[1]);
  if (magA < 1e-9 || magB < 1e-9) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (magA * magB)))) * (180 / Math.PI);
}

// ─── Core-showcase overview diagram (ManualLayout) ───────────────────────────

const overviewDsl: DiagramDSL = {
  id: 'curved-kink-test',
  layout: { kind: 'manual' },
  childrenOrder: [],
  nodes: [
    // Left column (Y=0.5)
    makeNode('scene', { position: ['12%', '50%', '0%'], size: ['16%', '14%'] }),
    // Second column (Y=0.35 and Y=0.65)
    makeNode('frames', { position: ['37%', '35%', '0%'], size: ['16%', '14%'] }),
    makeNode('track', { position: ['37%', '65%', '0%'], size: ['16%', '14%'] }),
    // Third column (Y=0.35 and Y=0.65)
    makeNode('driver', { position: ['62%', '35%', '0%'], size: ['16%', '14%'] }),
    makeNode('registry', { position: ['62%', '65%', '0%'], size: ['16%', '14%'] }),
    // Fourth column (Y=0.35 and Y=0.65)
    makeNode('canvas', { position: ['88%', '35%', '0%'], size: ['16%', '14%'] }),
    makeNode('overlay', { position: ['88%', '65%', '0%'], size: ['16%', '14%'] }),
  ],
  edges: [
    // Horizontal edges with vertical offset (the ones that kink)
    makeEdge('scene', 'frames'),       // Y=0.5 → Y=0.35 (diagonal up-right)
    makeEdge('frames', 'track'),       // Y=0.35 → Y=0.65 (vertical down)
    makeEdge('track', 'driver'),       // Y=0.65 → Y=0.35 (diagonal up-right)
    makeEdge('driver', 'registry'),    // Y=0.35 → Y=0.65 (vertical down)
    makeEdge('registry', 'canvas'),    // Y=0.65 → Y=0.35 (diagonal up-right)
    makeEdge('registry', 'overlay'),   // Y=0.65 → Y=0.65 (horizontal)
  ],
  groups: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('curved edge kink prevention (ManualLayout overview diagram)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const compile = () => compileDiagram(overviewDsl);

  it('compiles all 6 edges', () => {
    const state = compile();
    expect(state.edges).toHaveLength(6);
  });


  // ─── Inflection-point detection ──────────────────────────────────────────────
  // The Frenet-frame kink happens when a cubic bezier has an inflection point
  // (second derivative crosses zero). This causes TubeGeometry to flip the
  // tube cross-section, producing a visible pinch.
  //
  // For edges between horizontally-separated nodes at different Y levels
  // (e.g., scene at Y=0.5 → frames at Y=0.35), the pure-horizontal face normals
  // create control handles that make an S-curve with an inflection at t ≈ 0.5.

  // ─── Tangent continuity ────────────────────────────────────────────────────
  // The compiled path must have tangent-continuous junctions between commands.
  // The visual Frenet-frame kink is fixed in the render layer (CatmullRom
  // resampling in EdgeRenderer), but the compiled geometry must be correct
  // as a precondition.

  describe('compiled paths have tangent-continuous junctions', () => {
    const MAX_JUNCTION_ANGLE = 5; // degrees

    for (const [fromId, toId] of [
      ['scene', 'frames'],
      ['track', 'driver'],
      ['registry', 'canvas'],
      ['frames', 'track'],
      ['driver', 'registry'],
      ['registry', 'overlay'],
    ] as const) {
      it(`${fromId}→${toId}: all junctions ≤ ${MAX_JUNCTION_ANGLE}°`, () => {
        const state = compile();
        const edge = state.edges.find((e) => e.fromId === fromId && e.toId === toId)!;
        expect(edge).toBeDefined();
        const cmds = edge.path.commands;

        for (let i = 0; i < cmds.length - 1; i++) {
          const endDir = cmdEndDirection(cmds[i]!);
          const startDir = cmdStartDirection(cmds[i + 1]!);
          const endMag = Math.sqrt(endDir[0] ** 2 + endDir[1] ** 2);
          const startMag = Math.sqrt(startDir[0] ** 2 + startDir[1] ** 2);
          if (endMag < 1e-6 || startMag < 1e-6) continue;

          const angle = angleBetweenDeg(endDir, startDir);
          expect(
            angle,
            `${fromId}→${toId}: junction ${i}→${i + 1} has ${angle.toFixed(1)}° angle`,
          ).toBeLessThanOrEqual(MAX_JUNCTION_ANGLE);
        }
      });
    }
  });

  // ─── Control handle Y-bias ──────────────────────────────────────────────────
  // The fix: for diagonal edges with horizontal face normals, the control handles
  // should include a Y component that biases toward the destination Y level.
  // This prevents the S-curve inflection.

  // ─── Tangent continuity at command junctions ──────────────────────────────
  // The compiled path has line→cubic junctions. The tangent must be continuous
  // (≤ 5° angle) at every junction so the rendered tube has no geometric kinks.
  // (The Frenet-frame visual kink is fixed in the render layer by CatmullRom
  // resampling, but the compiled geometry must be correct as a precondition.)

  describe('tangent continuity at command junctions', () => {
    const MAX_JUNCTION_ANGLE = 5; // degrees

    for (const [fromId, toId] of [
      ['scene', 'frames'],
      ['track', 'driver'],
      ['registry', 'canvas'],
    ]) {
      it(`${fromId}→${toId}: all junctions ≤ ${MAX_JUNCTION_ANGLE}°`, () => {
        const state = compile();
        const edge = state.edges.find((e) => e.fromId === fromId && e.toId === toId)!;
        const cmds = edge.path.commands;

        for (let i = 0; i < cmds.length - 1; i++) {
          const endDir = cmdEndDirection(cmds[i]!);
          const startDir = cmdStartDirection(cmds[i + 1]!);
          const endMag = Math.sqrt(endDir[0] ** 2 + endDir[1] ** 2);
          const startMag = Math.sqrt(startDir[0] ** 2 + startDir[1] ** 2);
          if (endMag < 1e-6 || startMag < 1e-6) continue;

          const angle = angleBetweenDeg(endDir, startDir);
          expect(
            angle,
            `${fromId}→${toId}: junction ${i}→${i + 1} has ${angle.toFixed(1)}° angle (max ${MAX_JUNCTION_ANGLE}°)`,
          ).toBeLessThanOrEqual(MAX_JUNCTION_ANGLE);
        }
      });
    }
  });
});
