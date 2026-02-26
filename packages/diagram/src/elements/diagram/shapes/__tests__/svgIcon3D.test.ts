import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { buildSvgIcon3D, resolveLayerConfig } from '../svgIcon3D';
import type { SvgIcon3DStyle } from '../../types';

// ─── resolveLayerConfig ────────────────────────────────────────────────────────

describe('resolveLayerConfig', () => {
  it('extruded: all paths get zBase=0 regardless of index', () => {
    const c0 = resolveLayerConfig(0, 3, 'extruded', 0.15);
    const c1 = resolveLayerConfig(1, 3, 'extruded', 0.15);
    const c2 = resolveLayerConfig(2, 3, 'extruded', 0.15);
    expect(c0.zBase).toBe(0);
    expect(c1.zBase).toBe(0);
    expect(c2.zBase).toBe(0);
  });

  it('extruded: all paths get equal depth', () => {
    const c0 = resolveLayerConfig(0, 3, 'extruded', 0.15);
    const c1 = resolveLayerConfig(2, 3, 'extruded', 0.15);
    expect(c0.depth).toBeCloseTo(c1.depth, 10);
    expect(c0.depth).toBeGreaterThan(0);
  });

  it('layered: path[0] has zBase=0', () => {
    const c0 = resolveLayerConfig(0, 3, 'layered', 0.15);
    expect(c0.zBase).toBe(0);
  });

  it('layered: subsequent paths have strictly increasing zBase', () => {
    const c0 = resolveLayerConfig(0, 3, 'layered', 0.15);
    const c1 = resolveLayerConfig(1, 3, 'layered', 0.15);
    const c2 = resolveLayerConfig(2, 3, 'layered', 0.15);
    expect(c1.zBase).toBeGreaterThan(c0.zBase);
    expect(c2.zBase).toBeGreaterThan(c1.zBase);
  });

  it('layered: frontmost face of path[1] is forward of path[0]', () => {
    const c0 = resolveLayerConfig(0, 2, 'layered', 0.15);
    const c1 = resolveLayerConfig(1, 2, 'layered', 0.15);
    const front0 = c0.zBase + c0.depth;
    const front1 = c1.zBase + c1.depth;
    expect(front1).toBeGreaterThan(front0);
  });

  it('embossed: bevelThickness is larger than extruded bevelThickness', () => {
    const embossed = resolveLayerConfig(0, 2, 'embossed', 0.15);
    const extruded = resolveLayerConfig(0, 2, 'extruded', 0.15);
    expect(embossed.bevelThickness).toBeGreaterThan(extruded.bevelThickness);
  });

  it('embossed: bevelSegments is 5 (smooth rim)', () => {
    const c = resolveLayerConfig(0, 1, 'embossed', 0.15);
    expect(c.bevelSegments).toBe(5);
  });

  it('extruded/embossed: bevelSegments is 3 (chamfer)', () => {
    expect(resolveLayerConfig(0, 1, 'extruded', 0.15).bevelSegments).toBe(3);
  });

  it('all styles: depth scales proportionally with maxDepth', () => {
    const styles: Exclude<SvgIcon3DStyle, 'flat'>[] = ['extruded', 'layered', 'embossed'];
    styles.forEach((s) => {
      const small = resolveLayerConfig(0, 1, s, 0.10);
      const large = resolveLayerConfig(0, 1, s, 0.20);
      expect(large.depth).toBeCloseTo(small.depth * 2, 10);
    });
  });

  it('all styles: bevelThickness scales proportionally with maxDepth', () => {
    const styles: Exclude<SvgIcon3DStyle, 'flat'>[] = ['extruded', 'layered', 'embossed'];
    styles.forEach((s) => {
      const small = resolveLayerConfig(0, 1, s, 0.10);
      const large = resolveLayerConfig(0, 1, s, 0.20);
      expect(large.bevelThickness).toBeCloseTo(small.bevelThickness * 2, 10);
    });
  });

  it('layered: depth is positive for all indices with realistic path counts', () => {
    [1, 2, 3, 4].forEach((totalPaths) => {
      for (let i = 0; i < totalPaths; i++) {
        const c = resolveLayerConfig(i, totalPaths, 'layered', 0.15);
        expect(c.depth).toBeGreaterThan(0);
      }
    });
  });
});

// ─── buildSvgIcon3D ────────────────────────────────────────────────────────────

/**
 * Creates a minimal SVGLoader path entry with a real THREE.Shape so that
 * SVGLoader.createShapes() returns geometry-producing shapes.
 *
 * SVGLoader.createShapes() is a static method that inspects a ShapePath's
 * internal subPaths. We satisfy its contract by providing a synthetic ShapePath
 * whose toShapes() / createShapes() result is well-defined.
 *
 * Strategy: monkey-patch SVGLoader.createShapes in each test that needs real
 * geometry, restoring it after. This keeps the test fully in-process without
 * a real DOM/SVG parser.
 */
function makeShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(10, 0);
  shape.lineTo(10, 10);
  shape.lineTo(0, 10);
  shape.closePath();
  return shape;
}

/** Builds a fake SVGLoader paths array with N filled paths using the given colors. */
function makePaths(fillColors: string[]): Parameters<typeof buildSvgIcon3D>[0]['paths'] {
  return fillColors.map((fill) => ({
    userData: { style: { fill, stroke: 'none', strokeWidth: '0' } },
    subPaths: [],
    color: new THREE.Color(fill),
  })) as unknown as Parameters<typeof buildSvgIcon3D>[0]['paths'];
}

/** Temporarily overrides SVGLoader.createShapes to return [shape] for any call. */
function withFakeShapes(shape: THREE.Shape, fn: () => void): void {
  const orig = SVGLoader.createShapes;
  (SVGLoader as { createShapes: unknown }).createShapes = () => [shape];
  try {
    fn();
  } finally {
    (SVGLoader as { createShapes: unknown }).createShapes = orig;
  }
}

describe('buildSvgIcon3D', () => {
  it('returns a THREE.Group for any input', () => {
    const group = buildSvgIcon3D({ paths: makePaths(['#ff0000']) }, {
      width: 1, height: 1, maxDepth: 0.15, style: 'extruded',
    });
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it('returns empty group for zero paths without throwing', () => {
    const group = buildSvgIcon3D({ paths: [] }, {
      width: 1, height: 1, maxDepth: 0.15, style: 'layered',
    });
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children.length).toBe(0);
  });

  it('returns empty group when all paths have fill:none', () => {
    const paths = makePaths([]).concat(
      [{ userData: { style: { fill: 'none' } }, subPaths: [], color: new THREE.Color() }] as unknown as Parameters<typeof buildSvgIcon3D>[0]['paths'],
    );
    const group = buildSvgIcon3D({ paths }, {
      width: 1, height: 1, maxDepth: 0.15, style: 'extruded',
    });
    expect(group.children.length).toBe(0);
  });

  it('uses ExtrudeGeometry (not ShapeGeometry) for extruded style', () => {
    const shape = makeShape();
    let result!: THREE.Group;
    withFakeShapes(shape, () => {
      result = buildSvgIcon3D({ paths: makePaths(['#ff4400']) }, {
        width: 1, height: 1, maxDepth: 0.15, style: 'extruded',
      });
    });
    expect(result.children.length).toBeGreaterThan(0);
    const mesh = result.children[0] as THREE.Mesh;
    expect(mesh.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
  });

  it('uses ExtrudeGeometry for layered style', () => {
    const shape = makeShape();
    let result!: THREE.Group;
    withFakeShapes(shape, () => {
      result = buildSvgIcon3D({ paths: makePaths(['#ff4400', '#ffffff']) }, {
        width: 1, height: 1, maxDepth: 0.15, style: 'layered',
      });
    });
    result.children.forEach((child) => {
      expect((child as THREE.Mesh).geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    });
  });

  it('uses ExtrudeGeometry for embossed style', () => {
    const shape = makeShape();
    let result!: THREE.Group;
    withFakeShapes(shape, () => {
      result = buildSvgIcon3D({ paths: makePaths(['#ff4400']) }, {
        width: 1, height: 1, maxDepth: 0.15, style: 'embossed',
      });
    });
    expect((result.children[0] as THREE.Mesh).geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
  });

  it('layered: path[1] mesh has strictly higher position.z than path[0]', () => {
    const shape = makeShape();
    let result!: THREE.Group;
    withFakeShapes(shape, () => {
      result = buildSvgIcon3D({ paths: makePaths(['#ff4400', '#ffffff']) }, {
        width: 1, height: 1, maxDepth: 0.15, style: 'layered',
      });
    });
    expect(result.children.length).toBe(2);
    const z0 = (result.children[0] as THREE.Mesh).position.z;
    const z1 = (result.children[1] as THREE.Mesh).position.z;
    expect(z1).toBeGreaterThan(z0);
  });

  it('extruded: all meshes have zBase=0', () => {
    const shape = makeShape();
    let result!: THREE.Group;
    withFakeShapes(shape, () => {
      result = buildSvgIcon3D({ paths: makePaths(['#ff4400', '#00aaff']) }, {
        width: 1, height: 1, maxDepth: 0.15, style: 'extruded',
      });
    });
    result.children.forEach((child) => {
      expect((child as THREE.Mesh).position.z).toBe(0);
    });
  });

  it('materials use MeshStandardMaterial (PBR, not flat MeshBasicMaterial)', () => {
    const shape = makeShape();
    let result!: THREE.Group;
    withFakeShapes(shape, () => {
      result = buildSvgIcon3D({ paths: makePaths(['#ff4400']) }, {
        width: 1, height: 1, maxDepth: 0.15, style: 'extruded',
      });
    });
    const mesh = result.children[0] as THREE.Mesh;
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it('material color matches the SVG fill color', () => {
    const shape = makeShape();
    let result!: THREE.Group;
    withFakeShapes(shape, () => {
      result = buildSvgIcon3D({ paths: makePaths(['#ed7100']) }, {
        width: 1, height: 1, maxDepth: 0.15, style: 'extruded',
      });
    });
    const mat = (result.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const expected = new THREE.Color('#ed7100');
    expect(mat.color.r).toBeCloseTo(expected.r, 3);
    expect(mat.color.g).toBeCloseTo(expected.g, 3);
    expect(mat.color.b).toBeCloseTo(expected.b, 3);
  });

  it('group position is finite (centred — not NaN)', () => {
    const shape = makeShape();
    let result!: THREE.Group;
    withFakeShapes(shape, () => {
      result = buildSvgIcon3D({ paths: makePaths(['#ff4400']) }, {
        width: 2, height: 2, maxDepth: 0.15, style: 'extruded',
      });
    });
    expect(Number.isFinite(result.position.x)).toBe(true);
    expect(Number.isFinite(result.position.y)).toBe(true);
  });

  it('group scale preserves Y-flip (scale.y is negative)', () => {
    const shape = makeShape();
    let result!: THREE.Group;
    withFakeShapes(shape, () => {
      result = buildSvgIcon3D({ paths: makePaths(['#ff4400']) }, {
        width: 1, height: 1, maxDepth: 0.15, style: 'extruded',
      });
    });
    expect(result.scale.y).toBeLessThan(0);
  });

  it('group scale.z is 1 (Z extrusion is not compressed by fit-scaling)', () => {
    const shape = makeShape();
    let result!: THREE.Group;
    withFakeShapes(shape, () => {
      result = buildSvgIcon3D({ paths: makePaths(['#ff4400']) }, {
        width: 1, height: 1, maxDepth: 0.15, style: 'extruded',
      });
    });
    expect(result.scale.z).toBe(1);
  });

  it('accepts optional metalness and roughness without throwing', () => {
    const shape = makeShape();
    let result!: THREE.Group;
    expect(() => {
      withFakeShapes(shape, () => {
        result = buildSvgIcon3D({ paths: makePaths(['#123456']) }, {
          width: 1, height: 1, maxDepth: 0.10, style: 'embossed',
          metalness: 0.5, roughness: 0.2,
        });
      });
    }).not.toThrow();
    const mat = (result.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(mat.metalness).toBeCloseTo(0.5, 5);
    expect(mat.roughness).toBeCloseTo(0.2, 5);
  });
});
