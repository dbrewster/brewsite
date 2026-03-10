import { describe, it, expect } from 'vitest';
import {
  blendDiagramNodes,
  buildLiveNodeMaps,
  rerouteLiveEdges,
  blendDiagramEdges,
} from '../transitionHelpers';
import type { DiagramNodeState, DiagramEdgeState } from '../../types';

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
    const { positions, sizes } = buildLiveNodeMaps(nodes);
    const live = rerouteLiveEdges(
      [makeEdge('e1', 'a', 'a')],
      [],
      new Set(['e1']),
      positions,
      sizes,
    );
    expect(live.get('e1')?.controlPoints).toEqual([]);
  });

  it('returns empty control points for edges with missing nodes', () => {
    const { positions, sizes } = buildLiveNodeMaps([]);
    const live = rerouteLiveEdges(
      [makeEdge('e1', 'a', 'b')],
      [],
      new Set(['e1']),
      positions,
      sizes,
    );
    expect(live.get('e1')?.controlPoints).toEqual([]);
  });

  it('recomputes control points when node positions change', () => {
    const nodes = [makeNode('a', { position: [0, 0, 0] }), makeNode('b', { position: [5, 0, 0] })];
    const { positions, sizes } = buildLiveNodeMaps(nodes);
    const live = rerouteLiveEdges(
      [makeEdge('e1', 'a', 'b')],
      [],
      new Set(['e1']),
      positions,
      sizes,
    );
    expect(live.get('e1')?.controlPoints.length).toBeGreaterThan(1);
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
