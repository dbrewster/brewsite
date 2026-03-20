import { describe, it, expect } from 'vitest';
import {
  blendDiagramNodes,
  buildLiveNodeMaps,
  rerouteLiveEdges,
  blendDiagramEdges,
} from '../transitionHelpers';
import { functionalDiagramTransitionSpec } from '../../compile';
import type { DiagramNodeState, DiagramEdgeState, DiagramGroupState } from '../../types';

const linePath = {
  commands: [{ kind: 'line' as const, from: [0, 0, 0] as const, to: [1, 0, 0] as const }],
  startTangent: [1, 0, 0] as const,
  endTangent: [-1, 0, 0] as const,
  usedUnderpass: false,
  punctures: [],
};

const makeNode = (id: string, overrides: Partial<DiagramNodeState> = {}): DiagramNodeState => ({
  id,
  label: id,
  sublabel: undefined,
  shape: 'flow:rect',
  position: [0, 0, 0],
  size: [4, 2],
  depth: 0.4,
  color: '#ffffff',
  sideColor: '#ffffff',
  borderColor: '#000000',
  metalness: 0.3,
  roughness: 0.6,
  emissiveIntensity: 0,
  cornerRadius: 0,
  labelColor: '#000000',
  sublabelColor: '#000000',
  labelPadding: 0,
  opacity: 1,
  clickable: false,
  enabled: true,
  iconUrl: '',
  iconScale: 0.6,
  iconStyle: 'flat',
  iconDepthFactor: 0.1,
  groupId: undefined,
  positionInherited: undefined,
  ...overrides,
});

const makeEdge = (id: string, fromId: string, toId: string, overrides: Partial<DiagramEdgeState> = {}): DiagramEdgeState => ({
  id,
  fromId,
  toId,
  label: undefined,
  style: 'solid',
  arrowStart: 'none',
  arrowEnd: 'open',
  color: '#00ff00',
  thickness: 0.1,
  path: linePath,
  controlPoints: [[0, 0, 0], [1, 0, 0]],
  opacity: 1,
  routing: 'curved',
  ...overrides,
});

const makeGroup = (id: string, overrides: Partial<DiagramGroupState> = {}): DiagramGroupState => ({
  id,
  label: id,
  variant: 'boundary',
  orientation: 'vertical',
  bounds: {
    x: 0,
    y: 0,
    w: 0.4,
    h: 0.3,
    padding: [0, 0, 0, 0],
    titleGap: 0,
  },
  color: '#112233',
  borderColor: '#445566',
  borderWidth: 1,
  borderHeight: 0.7,
  borderStyle: 'solid',
  fillOpacity: 0.1,
  borderOpacity: 0.8,
  borderEmissiveColor: '#445566',
  borderEmissiveIntensity: 0,
  labelColor: '#ffffff',
  ...overrides,
});

describe('blendDiagramNodes', () => {
  it('lerps position at t=0.5 for nodes present in both scenes', () => {
    const from = [makeNode('a', { position: [0, 0, 0] })];
    const to = [makeNode('a', { position: [10, 0, 0] })];
    const { blended } = blendDiagramNodes(from, to, 0.5);
    expect(blended[0].position[0]).toBeCloseTo(5);
  });

  it('fades in new nodes from opacity=0 at t=0', () => {
    const { blended } = blendDiagramNodes([], [makeNode('a', { opacity: 0.8 })], 0);
    expect(blended[0].opacity).toBeCloseTo(0);
  });

  it('fades out removed nodes toward opacity=0 at t=1', () => {
    const { fading } = blendDiagramNodes([makeNode('a', { opacity: 0.7 })], [], 1);
    expect(fading[0].opacity).toBeCloseTo(0);
  });
});

describe('rerouteLiveEdges', () => {
  it('returns empty array for self-loop edges', () => {
    const nodes = [makeNode('a')];
    const { positions, sizes, groupIds, obstacleGroupIds } = buildLiveNodeMaps(nodes);
    const live = rerouteLiveEdges(
      [makeEdge('e1', 'a', 'a')],
      [],
      new Set(['e1']),
      positions,
      sizes,
      groupIds,
      obstacleGroupIds,
    );
    expect(live.get('e1')?.controlPoints).toEqual([]);
  });

  it('returns empty control points for edges with missing nodes', () => {
    const { positions, sizes, groupIds, obstacleGroupIds } = buildLiveNodeMaps([]);
    const live = rerouteLiveEdges(
      [makeEdge('e1', 'a', 'b')],
      [],
      new Set(['e1']),
      positions,
      sizes,
      groupIds,
      obstacleGroupIds,
    );
    expect(live.get('e1')?.controlPoints).toEqual([]);
  });

  it('recomputes control points when node positions change', () => {
    const nodes = [makeNode('a', { position: [0, 0, 0] }), makeNode('b', { position: [5, 0, 0] })];
    const { positions, sizes, groupIds, obstacleGroupIds } = buildLiveNodeMaps(nodes);
    const live = rerouteLiveEdges(
      [makeEdge('e1', 'a', 'b')],
      [],
      new Set(['e1']),
      positions,
      sizes,
      groupIds,
      obstacleGroupIds,
    );
    expect(live.get('e1')?.controlPoints.length).toBeGreaterThan(1);
  });

  it('includes groups in the live routing geometry map', () => {
    const group = makeGroup('g1', {
      bounds: {
        x: 0.2,
        y: 0.1,
        w: 0.5,
        h: 0.4,
        padding: [0, 0, 0, 0],
        titleGap: 0,
      },
      borderWidth: 0.075,
      borderHeight: 0.150,
    });

    const { positions, sizes, groupIds, obstacleGroupIds } = buildLiveNodeMaps([], [group]);

    expect(groupIds.has('g1')).toBe(true);
    expect(obstacleGroupIds.has('g1')).toBe(true);
    expect(positions.get('g1')).toEqual([0.45, 0.30000000000000004, 0]);
    // borderCenterInset = 0.075 * 0.5 = 0.0375
    // size = [0.5 + 0.075, 0.4 + 0.075, 0.150]
    expect(sizes.get('g1')![0]).toBeCloseTo(0.575, 5);
    expect(sizes.get('g1')![1]).toBeCloseTo(0.475, 5);
    expect(sizes.get('g1')![2]).toBeCloseTo(0.150, 5);
  });

  it('excludes container groups from obstacle routing ids', () => {
    const containerGroup = makeGroup('container', { variant: 'container', borderStyle: 'none' });
    const boundaryGroup = makeGroup('boundary', { variant: 'boundary' });

    const { groupIds, obstacleGroupIds } = buildLiveNodeMaps([], [containerGroup, boundaryGroup]);

    expect(groupIds.has('container')).toBe(true);
    expect(groupIds.has('boundary')).toBe(true);
    expect(obstacleGroupIds.has('container')).toBe(false);
    expect(obstacleGroupIds.has('boundary')).toBe(true);
  });
});

describe('blendDiagramEdges', () => {
  it('blends opacity for edges in both scenes', () => {
    const from = [makeEdge('e1', 'a', 'b', { opacity: 0 })];
    const to = [makeEdge('e1', 'a', 'b', { opacity: 1 })];
    const { blended } = blendDiagramEdges(from, to, new Map(), 0.5);
    expect(blended[0].opacity).toBeCloseTo(0.5);
  });

  it('attaches live control points from rerouteLiveEdges result', () => {
    const liveRoutes = new Map([['e1', {
      path: {
        commands: [{ kind: 'line' as const, from: [1, 1, 1] as const, to: [2, 2, 2] as const }],
        startTangent: [1, 0, 0] as const,
        endTangent: [-1, 0, 0] as const,
        usedUnderpass: false,
        punctures: [],
      },
      controlPoints: [[1, 1, 1], [2, 2, 2]] as const,
    }]]);
    const { blended } = blendDiagramEdges([], [makeEdge('e1', 'a', 'b')], liveRoutes, 0.5);
    expect(blended[0].controlPoints).toEqual([[1, 1, 1], [2, 2, 2]]);
  });
});

// ─── interpolateFn base-object spread ────────────────────────────────────────
// The interpolateFn must use `from` as the base at t=0 and `to` at t=1.
// Previously it always spread `...to`, meaning non-interpolated fields like
// `groups` came from the DESTINATION scene even at t=0, making the outgoing
// scene's content invisible (the incoming scene's groups/metadata appeared
// for the entire transition block).

describe('functionalDiagramTransitionSpec.interpolateFn base object', () => {

  const fromGroups: DiagramGroupState[] = [{
    id: 'g1',
    label: 'FROM group label',
    bounds: { x: 0, y: 0, w: 1, h: 1, padding: [0, 0, 0, 0] as readonly [number, number, number, number], titleGap: 0 },
    color: '#111111',
    fillColor: '#222222',
    borderColor: '#333333',
    fillOpacity: 0.5,
    borderOpacity: 1,
    borderWidth: 0.01,
    borderHeight: 0.01,
    borderStyle: 'solid',
    borderEmissiveColor: '#000000',
    borderEmissiveIntensity: 0,
  }];

  const toGroups: DiagramGroupState[] = [{
    id: 'g1',
    label: 'TO group label',
    bounds: { x: 0.1, y: 0.1, w: 0.8, h: 0.8, padding: [0, 0, 0, 0] as readonly [number, number, number, number], titleGap: 0 },
    color: '#aaaaaa',
    fillColor: '#bbbbbb',
    borderColor: '#cccccc',
    fillOpacity: 0.5,
    borderOpacity: 1,
    borderWidth: 0.01,
    borderHeight: 0.01,
    borderStyle: 'solid',
    borderEmissiveColor: '#000000',
    borderEmissiveIntensity: 0,
  }];

  const makeDiagramState = (id: string, groups: DiagramGroupState[]) => ({
    id,
    nodes: [makeNode('n1')],
    edges: [],
    groups,
    viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: [0, 0, 0] as readonly [number, number, number],
    z: 0,
    scale: 1,
    contentAspect: 1,
    exit: undefined,
    enter: undefined,
    themeConfig: {} as any,
  });

  it('at t=0, groups come from FROM state (not TO)', () => {
    const from = makeDiagramState('d1', fromGroups);
    const to = makeDiagramState('d1', toGroups);
    const ctx = { t: 0, bp: 0, channel: () => 0 };

    const closure = functionalDiagramTransitionSpec.interpolateFn(from, to);
    const result = closure(ctx);

    expect(
      result.groups[0]?.label,
      'At t=0, the group label should be FROM state, not TO state. ' +
      'The interpolateFn spreads ...to as the base, overwriting from\'s groups.',
    ).toBe('FROM group label');
  });

  it('at t=1, groups come from TO state', () => {
    const from = makeDiagramState('d1', fromGroups);
    const to = makeDiagramState('d1', toGroups);
    const ctx = { t: 1, bp: 1, channel: () => 1 };

    const closure = functionalDiagramTransitionSpec.interpolateFn(from, to);
    const result = closure(ctx);

    expect(result.groups[0]?.label).toBe('TO group label');
  });
});
