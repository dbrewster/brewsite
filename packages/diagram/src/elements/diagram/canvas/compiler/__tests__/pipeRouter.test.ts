import { describe, it, expect } from 'vitest';
import {
  sideAttachmentPoint,
  routePipe,
  rerouteLivePipes,
  rotateXYZ,
} from '../pipeRouter';
import type { DiagramPipeState } from '../../types';
import type { DiagramState } from '../../../types';

describe('sideAttachmentPoint — full rotation fix', () => {
  it('zero rotation → canonical right face point', () => {
    const result = sideAttachmentPoint(
      [0, 0, 0], [4, 2], 0.4,
      [0, 0, 0], 1,
      [0, 0, 0],
      [10, 0, 0],
    );
    expect(result.point[0]).toBeCloseTo(2);
    expect(result.normal[0]).toBeCloseTo(1);
  });

  it('Y rotation of 45° tilts X axis into -Z', () => {
    const result = sideAttachmentPoint(
      [0, 0, 0], [4, 2], 0.4,
      [0, 0, 0], 1,
      [0, Math.PI / 4, 0],
      [10, 0, 0],
    );
    expect(result.normal[0]).toBeCloseTo(Math.cos(Math.PI / 4));
    expect(result.normal[2]).toBeCloseTo(-Math.sin(Math.PI / 4));
  });

  it('combined rotation with Z tilt produces non-zero Y component', () => {
    const oldApprox: [number, number, number] = [Math.cos(Math.PI / 6), 0, -Math.sin(Math.PI / 6)];
    const newCombined = rotateXYZ([1, 0, 0], -Math.PI / 4, 0, Math.PI / 6);
    expect(oldApprox[1]).toBeCloseTo(0);
    expect(newCombined[1]).not.toBeCloseTo(0);
  });

  it('uses target-node direction to offset attachment on node Y axis', () => {
    const upper = sideAttachmentPoint(
      [0, 0, 0], [4, 2], 0.4,
      [0, 0, 0], 1,
      [0, 0, 0],
      [10, 10, 0],
    );
    const lower = sideAttachmentPoint(
      [0, 0, 0], [4, 2], 0.4,
      [0, 0, 0], 1,
      [0, 0, 0],
      [10, -10, 0],
    );
    expect(upper.point[1]).toBeGreaterThan(0.5);
    expect(lower.point[1]).toBeLessThan(-0.5);
  });
});

describe('routePipe — anti-parallel arc fix', () => {
  it('anti-parallel normals → 3-point arc', () => {
    const pts = routePipe([0, 0, 0], [4, 0, 0], [-1, 0, 0], [1, 0, 0], 'curved');
    expect(pts).toHaveLength(3);
  });

  it('straight routing → direct line', () => {
    const pts = routePipe([0, 0, 0], [4, 0, 0], undefined, undefined, 'straight');
    expect(pts).toEqual([[0, 0, 0], [4, 0, 0]]);
  });

  it('no normals → elevated midpoint fallback', () => {
    const pts = routePipe([0, 0, 0], [4, 0, 0], undefined, undefined, 'curved');
    expect(pts).toHaveLength(4);
  });
});

describe('rerouteLivePipes', () => {
  const diagram = (id: string, pos: [number, number, number]): DiagramState => ({
    id,
    position: pos,
    rotation: [0, 0, 0],
    scale: 1,
    pivot: 'center',
    nodes: [
      {
        id: 'n1',
        label: 'n1',
        sublabel: undefined,
        shape: 'flow:rect',
        position: [0, 0, 0],
        size: [4, 2],
        depth: 0.4,
        color: '#fff',
        sideColor: '#fff',
        borderColor: '#000',
        metalness: 0,
        roughness: 1,
        emissiveIntensity: 0,
        cornerRadius: 0,
        labelColor: '#000',
        sublabelColor: '#000',
        opacity: 1,
        clickable: false,
        enabled: true,
        iconUrl: '',
        iconScale: 0.6,
        iconStyle: 'flat',
        iconDepth: 0.1,
        groupId: undefined,
        positionInherited: undefined,
      },
    ],
    edges: [],
    groups: [],
    bounds: { x: 0, y: 0, w: 1, h: 1, minZ: 0, maxZ: 0 },
    themeConfig: {
      envMapUrl: null,
      envMapIntensity: 1,
      skyColor: '#000',
      horizonColor: '#000',
      nodeGlowIntensity: 0,
      nodeCornerRadius: 0,
      use3DArrows: false,
      edgeSmoothness: 0.5,
      edgeMetalness: 0,
      edgeRoughness: 1,
      fontUrl: '',
    },
    exit: null,
    enter: null,
  });

  it('pipe with valid from/to nodes → computes control points', () => {
    const pipe: DiagramPipeState = {
      id: 'p1',
      fromDiagramId: 'a',
      fromNodeId: 'n1',
      toDiagramId: 'b',
      toNodeId: 'n1',
      label: undefined,
      style: 'solid',
      arrowStart: 'none',
      arrowEnd: 'open',
      color: '#fff',
      thickness: 0.1,
      opacity: 1,
      controlPoints: [],
    };
    const points = rerouteLivePipes([pipe], [diagram('a', [0, 0, 0]), diagram('b', [10, 0, 0])], 'curved', 'sides');
    expect(points.get('p1')?.length).toBeGreaterThan(1);
  });

  it('pipe with missing from node → returns empty controlPoints', () => {
    const pipe: DiagramPipeState = {
      id: 'p1',
      fromDiagramId: 'a',
      fromNodeId: 'missing',
      toDiagramId: 'b',
      toNodeId: 'n1',
      label: undefined,
      style: 'solid',
      arrowStart: 'none',
      arrowEnd: 'open',
      color: '#fff',
      thickness: 0.1,
      opacity: 1,
      controlPoints: [],
    };
    const points = rerouteLivePipes([pipe], [diagram('a', [0, 0, 0]), diagram('b', [10, 0, 0])], 'curved', 'sides');
    expect(points.get('p1')).toEqual([]);
  });

  it('returns same number of entries as input pipes', () => {
    const pipe: DiagramPipeState = {
      id: 'p1',
      fromDiagramId: 'a',
      fromNodeId: 'n1',
      toDiagramId: 'b',
      toNodeId: 'n1',
      label: undefined,
      style: 'solid',
      arrowStart: 'none',
      arrowEnd: 'open',
      color: '#fff',
      thickness: 0.1,
      opacity: 1,
      controlPoints: [],
    };
    const points = rerouteLivePipes([pipe], [diagram('a', [0, 0, 0]), diagram('b', [10, 0, 0])], 'curved', 'sides');
    expect(points.size).toBe(1);
  });
});
