import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EdgeRenderer } from '../EdgeRenderer';
import { EdgeMaterialFactory } from '../EdgeMaterialFactory';

const makeEdge = (overrides: Partial<{
  id: string;
  path: {
    commands: ReadonlyArray<
      | { kind: 'line'; from: readonly [number, number, number]; to: readonly [number, number, number] }
      | { kind: 'cubic'; p0: readonly [number, number, number]; p1: readonly [number, number, number]; p2: readonly [number, number, number]; p3: readonly [number, number, number] }
    >;
    startTangent: readonly [number, number, number];
    endTangent: readonly [number, number, number];
    punctures: ReadonlyArray<{ obstacleId: string; obstacleKind: 'node' | 'group' }>;
  };
  controlPoints: ReadonlyArray<readonly [number, number, number]>;
  routing: 'curved' | 'straight' | 'organic' | 'flow';
  thickness: number;
  color: string;
  opacity: number;
  style: 'solid' | 'dashed' | 'dotted';
  arrowStart?: string;
  arrowEnd?: string;
}> = {}) => {
  const base = {
    id: 'e1',
    controlPoints: [[0, 0, 0], [1, 0, 0]] as const,
    routing: 'straight' as const,
    thickness: 0.1,
    color: '#ff0000',
    opacity: 1,
    style: 'solid' as const,
    arrowStart: 'none',
    arrowEnd: 'open',
  };
  return {
    ...base,
    ...overrides,
  };
};

describe('EdgeRenderer', () => {
  let renderer: EdgeRenderer;
  let parent: THREE.Group;

  beforeEach(() => {
    renderer = new EdgeRenderer(new EdgeMaterialFactory());
    parent = new THREE.Group();
  });

  it('getOrCreate adds group to parent on first call', () => {
    renderer.getOrCreate(makeEdge(), parent);
    expect(parent.children.length).toBe(1);
  });

  it('getOrCreate same id → no duplicate in parent.children', () => {
    renderer.getOrCreate(makeEdge(), parent);
    renderer.getOrCreate(makeEdge(), parent);
    expect(parent.children.length).toBe(1);
  });

  it('controlPoints change → geometry disposed and rebuilt', () => {
    const entry = renderer.getOrCreate(makeEdge(), parent);
    const before = entry.tube.geometry;
    renderer.getOrCreate(makeEdge({ controlPoints: [[0, 0, 0], [2, 0, 0]] }), parent);
    const after = entry.tube.geometry;
    expect(after).not.toBe(before);
  });

  it('color change only → material disposed and rebuilt, geometry unchanged', () => {
    const sharedPoints = [[0, 0, 0], [1, 0, 0]] as const;
    const entry = renderer.getOrCreate(makeEdge({ controlPoints: sharedPoints }), parent);
    const geometryBefore = entry.tube.geometry;
    const materialBefore = entry.tube.material;
    renderer.getOrCreate(makeEdge({ color: '#00ff00', controlPoints: sharedPoints }), parent);
    expect(entry.tube.geometry).toBe(geometryBefore);
    expect(entry.tube.material).not.toBe(materialBefore);
  });

  it('dispose removes group from parent', () => {
    renderer.getOrCreate(makeEdge(), parent);
    renderer.dispose('e1', parent);
    expect(parent.children.length).toBe(0);
  });

  it('disposeAll clears all entries', () => {
    renderer.getOrCreate(makeEdge(), parent);
    renderer.getOrCreate(makeEdge({ id: 'e2' }), parent);
    renderer.disposeAll(parent);
    expect(parent.children.length).toBe(0);
  });

  it('edge with < 2 control points → group.visible = false', () => {
    const entry = renderer.getOrCreate(makeEdge({ controlPoints: [[0, 0, 0]] }), parent);
    expect(entry.group.visible).toBe(false);
  });

  it('opacity-only update toggles material transparency for dashed edges', () => {
    const sharedPoints = [[0, 0, 0], [1, 0, 0]] as const;
    const entry = renderer.getOrCreate(
      makeEdge({ controlPoints: sharedPoints, style: 'dashed', opacity: 0.5 }),
      parent,
    );
    const mat = entry.tube.material as THREE.MeshStandardMaterial;
    renderer.getOrCreate(makeEdge({ controlPoints: sharedPoints, style: 'dashed', opacity: 1 }), parent);
    expect(mat.transparent).toBe(true);
  });

  it('creates and removes arrow meshes when arrow style changes', () => {
    const entry = renderer.getOrCreate(makeEdge({ arrowStart: 'none', arrowEnd: 'none' }), parent);
    renderer.getOrCreate(makeEdge({ arrowStart: 'open', arrowEnd: 'open' }), parent);
    expect(entry.arrowStart).toBeDefined();
    expect(entry.arrowEnd).toBeDefined();

    renderer.getOrCreate(makeEdge({ arrowStart: 'none', arrowEnd: 'none' }), parent);
    expect(entry.arrowStart).toBeUndefined();
    expect(entry.arrowEnd).toBeUndefined();
  });

  it('uses explicit tubeRadialSegments when provided', () => {
    const renderer12 = new EdgeRenderer(new EdgeMaterialFactory(), false, 0.5, 0.3, 0.7, 0.7, 0.18, 12);
    const localParent = new THREE.Group();
    renderer12.getOrCreate(makeEdge(), localParent);
    expect(localParent.children.length).toBe(1);
  });

  it('builds 3D arrows when use3DArrows is enabled', () => {
    const threeD = new EdgeRenderer(new EdgeMaterialFactory(), true);
    const localParent = new THREE.Group();
    const entry = threeD.getOrCreate(makeEdge({ arrowEnd: 'none' }), localParent);
    threeD.getOrCreate(makeEdge({ arrowEnd: 'open' }), localParent);
    expect(entry.arrowEnd).toBeDefined();
    expect(entry.arrowEnd?.geometry).toBeInstanceOf(THREE.ConeGeometry);
  });

  it('renders flow routing as a curve path built from explicit commands', () => {
    const entry = renderer.getOrCreate(makeEdge({
      routing: 'flow',
      path: {
        commands: [
          { kind: 'line', from: [0, 0, 0], to: [1, 0, 0] },
          { kind: 'cubic', p0: [1, 0, 0], p1: [1.4, 0, 0], p2: [1.6, 1, 0], p3: [2, 1, 0] },
        ],
        startTangent: [1, 0, 0],
        endTangent: [-1, 0, 0],

        punctures: [],
      },
      controlPoints: [[0, 0, 0], [1, 0, 0], [1.4, 0, 0], [1.6, 1, 0], [2, 1, 0]],
    }), parent);
    const geom = entry.tube.geometry as THREE.TubeGeometry;
    // Multi-command paths are resampled as CatmullRomCurve3 to eliminate
    // Frenet-frame kinks at line→cubic junctions in TubeGeometry.
    expect(geom.parameters.path).toBeInstanceOf(THREE.CatmullRomCurve3);
  });

  it('renders curved routing as a cubic bezier path', () => {
    const entry = renderer.getOrCreate(makeEdge({
      routing: 'curved',
      controlPoints: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [2, 1, 0],
      ],
    }), parent);
    const geom = entry.tube.geometry as THREE.TubeGeometry;
    expect(geom.parameters.path).toBeInstanceOf(THREE.CubicBezierCurve3);
  });

  it('adds pulse uniforms when flow is enabled and clears intensity when disabled', () => {
    const entry = renderer.getOrCreate(makeEdge({ flow: 'forward', flowColor: '#00ff00' }), parent);
    const mat = entry.tube.material as THREE.MeshStandardMaterial;
    const keys = Object.keys(mat.userData);
    expect(keys.length).toBeGreaterThan(0);

    renderer.getOrCreate(makeEdge({ flow: 'none' }), parent);
    const pulseData = mat.userData[keys[0]!] as { uniforms: { uPulseIntensity?: { value: number } } };
    expect(pulseData.uniforms.uPulseIntensity?.value).toBe(0);
  });

  it('tickPulseUniforms updates uTime on all edges with pulse materials', () => {
    // Create an edge with flow enabled so it gets pulse uniforms.
    const entry = renderer.getOrCreate(makeEdge({ flow: 'forward' }), parent);
    const mat = entry.tube.material as THREE.MeshStandardMaterial;
    const pulseKey = Object.keys(mat.userData).find((k) => k.includes('pulse'));
    expect(pulseKey).toBeDefined();

    const pulseData = mat.userData[pulseKey!] as { uniforms: { uTime: { value: number } } };

    // Set uTime to a sentinel value.
    pulseData.uniforms.uTime.value = -999;
    expect(pulseData.uniforms.uTime.value).toBe(-999);

    // tickPulseUniforms should update uTime from the sentinel to a real clock value.
    renderer.tickPulseUniforms();
    expect(pulseData.uniforms.uTime.value).not.toBe(-999);
    expect(pulseData.uniforms.uTime.value).toBeGreaterThan(0);
  });

  it('tickPulseUniforms is a no-op for edges without flow', () => {
    // Create an edge without flow — no pulse uniforms should exist.
    renderer.getOrCreate(makeEdge({ flow: undefined }), parent);

    // Should not throw.
    expect(() => renderer.tickPulseUniforms()).not.toThrow();
  });
});
