import { describe, it, expect } from 'vitest';
import {
  sideAttachmentPoint,
  routePipe,
  rerouteLivePipes,
  rotateXYZ,
} from '../pipeRouter';
import type { DiagramPipeState } from '../../types';
import type { DiagramState } from '../../../types';

const FULL_VIEWPORT = { x: 0, y: 0, w: 1, h: 1 };
const NO_TILT: readonly [number, number, number] = [0, 0, 0];

describe('sideAttachmentPoint — full rotation fix', () => {
  it('zero rotation → canonical right face point', () => {
    // Node at NVS center [0.5, 0.5] → canvas local [0, 0].
    // Size [0.2, 0.1] → halfW = 0.2*1*1/2 = 0.1. Target far right.
    const result = sideAttachmentPoint(
      [0.5, 0.5, 0], [0.2, 0.1], 0.4,
      FULL_VIEWPORT, NO_TILT, 1,
      [10, 0, 0],
    );
    expect(result.point[0]).toBeCloseTo(0.1);
    expect(result.normal[0]).toBeCloseTo(1);
  });

  it('Y rotation of 45° tilts X axis into -Z', () => {
    const result = sideAttachmentPoint(
      [0.5, 0.5, 0], [0.2, 0.1], 0.4,
      FULL_VIEWPORT, [0, Math.PI / 4, 0], 1,
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
    // Node at NVS center [0.5, 0.5] → canvas [0, 0]. halfH = 0.1*1/2 = 0.05.
    const upper = sideAttachmentPoint(
      [0.5, 0.5, 0], [0.2, 0.1], 0.4,
      FULL_VIEWPORT, NO_TILT, 1,
      [10, 10, 0],
    );
    const lower = sideAttachmentPoint(
      [0.5, 0.5, 0], [0.2, 0.1], 0.4,
      FULL_VIEWPORT, NO_TILT, 1,
      [10, -10, 0],
    );
    expect(upper.point[1]).toBeGreaterThan(0);
    expect(lower.point[1]).toBeLessThan(0);
  });
});

describe('routePipe — anti-parallel arc fix', () => {
  it('anti-parallel normals keeps orthogonal endpoint stubs', () => {
    const pts = routePipe([0, 0, 0], [4, 0, 0], [-1, 0, 0], [1, 0, 0], 'curved');
    expect(pts).toHaveLength(4);
    expect(pts[1]?.[0]).toBeLessThan(pts[0]?.[0] ?? 0);
    expect(pts[2]?.[0]).toBeGreaterThan(pts[3]?.[0] ?? 0);
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
  // Two diagrams side-by-side: 'a' occupies left half of viewport, 'b' right half.
  const diagram = (id: string, vpX: number): DiagramState => ({
    id,
    viewportBounds: { x: vpX, y: 0, w: 0.5, h: 1 },
    tiltRotation: [0, 0, 0],
    nodes: [
      {
        id: 'n1',
        label: 'n1',
        sublabel: undefined,
        shape: 'flow:rect',
        position: [0.5, 0.5, 0],
        size: [0.2, 0.1],
        thickness: 0.4,
        color: '#fff',
        sideColor: '#fff',
        borderColor: '#000',
        metalness: 0,
        roughness: 1,
        emissiveIntensity: 0,
        emissive: false,
        emissiveColor: '#fff',
        cornerRadius: 0,
        labelColor: '#000',
        sublabelColor: '#000',
        opacity: 1,
        clickable: false,
        enabled: true,
        iconUrl: undefined,
        iconScale: 0.6,
        iconStyle: 'flat',
        iconDepth: 0.1,
        groupId: undefined,
        positionInherited: undefined,
      },
    ],
    edges: [],
    groups: [],
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
      edgeFlowSpeed: 0,
      edgeFlowWidth: 0.2,
      fontUrl: undefined,
    },
    exit: undefined,
    enter: undefined,
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
    const points = rerouteLivePipes([pipe], [diagram('a', 0), diagram('b', 0.5)], 'curved', 'sides');
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
    const points = rerouteLivePipes([pipe], [diagram('a', 0), diagram('b', 0.5)], 'curved', 'sides');
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
    const points = rerouteLivePipes([pipe], [diagram('a', 0), diagram('b', 0.5)], 'curved', 'sides');
    expect(points.size).toBe(1);
  });
});
