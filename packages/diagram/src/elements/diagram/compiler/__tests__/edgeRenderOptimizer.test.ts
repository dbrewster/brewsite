import { describe, expect, it } from 'vitest';
import { optimizeSharedFlowTrunks } from '../edgeRenderOptimizer';
import type { DiagramEdgeState } from '../../types';

const makeEdge = (
  id: string,
  overrides: Partial<DiagramEdgeState> = {},
): DiagramEdgeState => ({
  id,
  fromId: 'src',
  toId: 'dst',
  label: undefined,
  style: 'solid',
  arrowStart: 'none',
  arrowEnd: 'none',
  color: '#00ff00',
  thickness: 0.1,
  path: {
    commands: [
      { kind: 'line', from: [0, 0, 0], to: [0, 1, 0] },
      { kind: 'line', from: [0, 1, 0], to: [0, 2, 0] },
      { kind: 'line', from: [0, 2, 0], to: [-1, 2, 0] },
    ],
    startTangent: [0, 1, 0],
    endTangent: [-1, 0, 0],
    usedUnderpass: false,
    punctures: [],
  },
  controlPoints: [[0, 0, 0], [0, 1, 0], [0, 2, 0], [-1, 2, 0]],
  opacity: 1,
  routing: 'flow',
  flowTurnRadius: 0.2,
  flowFaceStub: 0.1,
  flowBundleStrength: 1,
  flowTargetApproachBias: 1,
  allowUnderpass: true,
  fromPort: undefined,
  toPort: undefined,
  flow: 'forward',
  flowColor: '#00ff00',
  pathDebug: undefined,
  ...overrides,
});

describe('optimizeSharedFlowTrunks', () => {
  it('trims duplicate shared prefixes from follower edges', () => {
    const leader = makeEdge('leader');
    const follower = makeEdge('follower', {
      toId: 'other',
      path: {
        commands: [
          { kind: 'line', from: [0, 0, 0], to: [0, 1, 0] },
          { kind: 'line', from: [0, 1, 0], to: [0, 2, 0] },
          { kind: 'line', from: [0, 2, 0], to: [1, 2, 0] },
        ],
        startTangent: [0, 1, 0],
        endTangent: [1, 0, 0],
        usedUnderpass: false,
        punctures: [],
      },
      controlPoints: [[0, 0, 0], [0, 1, 0], [0, 2, 0], [1, 2, 0]],
    });

    const optimized = optimizeSharedFlowTrunks([leader, follower]);
    const optimizedLeader = optimized.find((edge) => edge.id === 'leader')!;
    const optimizedFollower = optimized.find((edge) => edge.id === 'follower')!;

    expect(optimizedLeader.path.commands).toHaveLength(3);
    expect(optimizedFollower.path.commands).toHaveLength(1);
    expect(optimizedFollower.controlPoints).toEqual([[0, 2, 0], [1, 2, 0]]);
    expect(optimizedFollower.path.startTangent).toEqual([1, 0, 0]);
  });

  it('does not merge trunks when visual signatures differ', () => {
    const leader = makeEdge('leader');
    const follower = makeEdge('follower', { color: '#ff00ff' });

    const optimized = optimizeSharedFlowTrunks([leader, follower]);
    expect(optimized.find((edge) => edge.id === 'leader')?.path.commands).toHaveLength(3);
    expect(optimized.find((edge) => edge.id === 'follower')?.path.commands).toHaveLength(3);
  });

  it('trims a follower whose leading run starts partway along the leader trunk', () => {
    const leader = makeEdge('leader', {
      path: {
        commands: [
          { kind: 'line', from: [0, 0, 0], to: [0, 4, 0] },
          { kind: 'line', from: [0, 4, 0], to: [-1, 4, 0] },
        ],
        startTangent: [0, 1, 0],
        endTangent: [-1, 0, 0],
        usedUnderpass: false,
        punctures: [],
      },
      controlPoints: [[0, 0, 0], [0, 4, 0], [-1, 4, 0]],
    });
    const follower = makeEdge('follower', {
      toId: 'other',
      path: {
        commands: [
          { kind: 'line', from: [0, 1, 0], to: [0, 5, 0] },
          { kind: 'line', from: [0, 5, 0], to: [1, 5, 0] },
        ],
        startTangent: [0, 1, 0],
        endTangent: [1, 0, 0],
        usedUnderpass: false,
        punctures: [],
      },
      controlPoints: [[0, 1, 0], [0, 5, 0], [1, 5, 0]],
    });

    const optimized = optimizeSharedFlowTrunks([leader, follower]);
    const optimizedFollower = optimized.find((edge) => edge.id === 'follower')!;

    expect(optimizedFollower.controlPoints).toEqual([[0, 4, 0], [0, 5, 0], [1, 5, 0]]);
    expect(optimizedFollower.path.startTangent).toEqual([0, 1, 0]);
  });

  it('does not trim an overlap that starts after a unique follower prefix', () => {
    const leader = makeEdge('leader', {
      path: {
        commands: [
          { kind: 'line', from: [0, 0, 0], to: [0, 4, 0] },
          { kind: 'line', from: [0, 4, 0], to: [-1, 4, 0] },
        ],
        startTangent: [0, 1, 0],
        endTangent: [-1, 0, 0],
        usedUnderpass: false,
        punctures: [],
      },
      controlPoints: [[0, 0, 0], [0, 4, 0], [-1, 4, 0]],
    });
    const follower = makeEdge('follower', {
      toId: 'other',
      path: {
        commands: [
          { kind: 'line', from: [1, 0, 0], to: [1, 2, 0] },
          { kind: 'line', from: [1, 2, 0], to: [0, 2, 0] },
          { kind: 'line', from: [0, 2, 0], to: [0, 4, 0] },
          { kind: 'line', from: [0, 4, 0], to: [1, 4, 0] },
        ],
        startTangent: [0, 1, 0],
        endTangent: [1, 0, 0],
        usedUnderpass: false,
        punctures: [],
      },
      controlPoints: [[1, 0, 0], [1, 2, 0], [0, 2, 0], [0, 4, 0], [1, 4, 0]],
    });

    const optimized = optimizeSharedFlowTrunks([leader, follower]);
    const optimizedFollower = optimized.find((edge) => edge.id === 'follower')!;

    expect(optimizedFollower.controlPoints).toEqual([[1, 0, 0], [1, 2, 0], [0, 2, 0], [0, 4, 0], [1, 4, 0]]);
  });

  it('drops a trimmed depth-only stub before branching laterally', () => {
    const leader = makeEdge('leader', {
      path: {
        commands: [
          { kind: 'line', from: [0, 0, 0], to: [0, 2, 0] },
          { kind: 'line', from: [0, 2, 0], to: [0, 2, -0.04] },
          { kind: 'line', from: [0, 2, -0.04], to: [0, 2, -0.08] },
          { kind: 'line', from: [0, 2, -0.08], to: [1, 2, -0.08] },
        ],
        startTangent: [0, 1, 0],
        endTangent: [1, 0, 0],
        usedUnderpass: false,
        punctures: [],
      },
      controlPoints: [[0, 0, 0], [0, 2, 0], [0, 2, -0.04], [0, 2, -0.08], [1, 2, -0.08]],
    });
    const follower = makeEdge('follower', {
      toId: 'other',
      path: {
        commands: [
          { kind: 'line', from: [0, 0, 0], to: [0, 2, 0] },
          { kind: 'line', from: [0, 2, 0], to: [0, 2, -0.04] },
          { kind: 'line', from: [0, 2, -0.04], to: [0, 2, -0.08] },
          { kind: 'cubic', p0: [0, 2, -0.08], p1: [0, 2, -0.09], p2: [0.04, 2, -0.12], p3: [0.08, 2, -0.12] },
          { kind: 'line', from: [0.08, 2, -0.12], to: [1, 2, -0.12] },
        ],
        startTangent: [0, 1, 0],
        endTangent: [1, 0, 0],
        usedUnderpass: false,
        punctures: [],
      },
      controlPoints: [[0, 0, 0], [0, 2, 0], [0, 2, -0.04], [0, 2, -0.08], [0.08, 2, -0.12], [1, 2, -0.12]],
    });

    const optimized = optimizeSharedFlowTrunks([leader, follower]);
    const optimizedFollower = optimized.find((edge) => edge.id === 'follower')!;

    expect(optimizedFollower.path.commands[0]).toEqual({
      kind: 'line',
      from: [0, 2, -0.12],
      to: [0.08, 2, -0.12],
    });
    expect(optimizedFollower.controlPoints).toEqual([[0, 2, -0.12], [0.08, 2, -0.12], [1, 2, -0.12]]);
  });

  it('trims a follower across a shared leading dogleg in the x-y plane', () => {
    const leader = makeEdge('leader', {
      path: {
        commands: [
          { kind: 'line', from: [0, 0, 0], to: [0, 2, 0] },
          { kind: 'line', from: [0, 2, 0], to: [0, 2, -0.08] },
          { kind: 'line', from: [0, 2, -0.08], to: [1, 2, -0.08] },
          { kind: 'line', from: [1, 2, -0.08], to: [1, 5, -0.08] },
          { kind: 'line', from: [1, 5, -0.08], to: [2, 5, -0.08] },
        ],
        startTangent: [0, 1, 0],
        endTangent: [1, 0, 0],
        usedUnderpass: false,
        punctures: [],
      },
      controlPoints: [[0, 0, 0], [0, 2, 0], [0, 2, -0.08], [1, 2, -0.08], [1, 5, -0.08], [2, 5, -0.08]],
    });
    const follower = makeEdge('follower', {
      toId: 'other',
      path: {
        commands: [
          { kind: 'line', from: [0, 0, 0], to: [0, 2, 0] },
          { kind: 'line', from: [0, 2, 0], to: [0, 2, -0.08] },
          { kind: 'line', from: [0, 2, -0.08], to: [1, 2, -0.08] },
          { kind: 'line', from: [1, 2, -0.08], to: [1, 3, -0.08] },
          { kind: 'line', from: [1, 3, -0.08], to: [0, 3, -0.08] },
        ],
        startTangent: [0, 1, 0],
        endTangent: [-1, 0, 0],
        usedUnderpass: false,
        punctures: [],
      },
      controlPoints: [[0, 0, 0], [0, 2, 0], [0, 2, -0.08], [1, 2, -0.08], [1, 3, -0.08], [0, 3, -0.08]],
    });

    const optimized = optimizeSharedFlowTrunks([leader, follower]);
    const optimizedFollower = optimized.find((edge) => edge.id === 'follower')!;

    expect(optimizedFollower.controlPoints).toEqual([[1, 3, -0.08], [0, 3, -0.08]]);
    expect(optimizedFollower.path.startTangent).toEqual([-1, 0, 0]);
  });
});
