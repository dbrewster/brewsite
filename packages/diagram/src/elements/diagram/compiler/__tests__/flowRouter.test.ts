import { describe, expect, it } from 'vitest';
import { routeFlowEdge } from '../flowRouter';

const basePositions = new Map<string, readonly [number, number, number]>();
const baseSizes = new Map<string, readonly [number, number, number]>();

const route = (overrides: Partial<Parameters<typeof routeFlowEdge>[0]> = {}) => routeFlowEdge({
  edgeId: 'edge',
  fromId: 'src',
  toId: 'dst',
  fromPos: [0, 0, 0],
  fromSize: [2, 2, 1],
  toPos: [8, 0, 0],
  toSize: [2, 2, 1],
  srcFace: 'right',
  dstFace: 'left',
  positions: new Map(basePositions),
  sizes: new Map(baseSizes),
  flowTurnRadius: 0.35,
  flowFaceStub: 0.5,
  flowObstaclePadding: 0.25,
  flowUnderpassDepth: 0.6,
  flowUnderpassClearance: 0.3,
  flowTurnPenalty: 0.45,
  flowPunchthroughPenalty: 500,
  flowUnderpassPenalty: 60,
  allowUnderpass: true,
  ...overrides,
});

describe('routeFlowEdge', () => {
  it('keeps direct line-of-sight routes clean and face-normal', () => {
    const result = route();
    expect(result.path.punctures).toEqual([]);
    expect(result.path.usedUnderpass).toBe(false);
    expect(result.path.startTangent[0]).toBeCloseTo(1);
    expect(result.path.startTangent[1]).toBeCloseTo(0);
    expect(result.path.endTangent[0]).toBeCloseTo(1);
    expect(result.path.endTangent[1]).toBeCloseTo(0);
  });

  it('uses an underpass when it produces a cleaner obstacle escape than puncturing', () => {
    const positions = new Map<string, readonly [number, number, number]>([
      ['blocker', [4, 0, 0]],
    ]);
    const sizes = new Map<string, readonly [number, number, number]>([
      ['blocker', [2, 2, 1]],
    ]);

    const result = route({ positions, sizes });
    expect(result.path.punctures).toEqual([]);
    expect(result.path.usedUnderpass).toBe(true);
    expect(result.controlPoints.some((point) => point[2] < 0)).toBe(true);
  });

  it('avoids puncture fallback in a boxed route when a cleaner alternative exists', () => {
    const positions = new Map<string, readonly [number, number, number]>([
      ['top-blocker', [4, 2.4, 0]],
      ['bottom-blocker', [4, -2.4, 0]],
      ['mid-blocker', [4, 0, 0]],
    ]);
    const sizes = new Map<string, readonly [number, number, number]>([
      ['top-blocker', [6, 1.5, 1]],
      ['bottom-blocker', [6, 1.5, 1]],
      ['mid-blocker', [2, 2, 1]],
    ]);

    const result = route({ positions, sizes, flowUnderpassPenalty: 1 });
    expect(result.path.punctures).toEqual([]);
    expect(result.pathDebug?.routeKind).not.toBe('puncture-fallback');
  });

  it('attaches to exact face centers for top and bottom faces', () => {
    const result = route({
      srcFace: 'top',
      dstFace: 'bottom',
      toPos: [0, 8, 0],
    });

    expect(result.controlPoints[0]).toEqual([0, 1, 0]);
    expect(result.controlPoints.at(-1)).toEqual([0, 7, 0]);
  });

  it('applies flowTurnRadius to simple flow routes with only stub elbows', () => {
    const sharp = route({
      dstFace: 'top',
      toPos: [6, 4, 0],
      flowTurnRadius: 0,
    });
    const rounded = route({
      dstFace: 'top',
      toPos: [6, 4, 0],
      flowTurnRadius: 0.45,
    });

    expect(sharp.path.commands.every((command) => command.kind === 'line')).toBe(true);
    expect(rounded.path.commands.some((command) => command.kind === 'cubic')).toBe(true);
  });
});
