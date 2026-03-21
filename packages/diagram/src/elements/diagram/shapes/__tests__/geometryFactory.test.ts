import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createShapeGeometry,
  createShapeOutlineGeometry,
  isRectangularShape,
  getContentRect,
} from '../geometryFactory';

// Tests exercise geometryFactory at its public boundary:
// real DiagramNodeShape inputs → real Three.js geometry outputs.
// No mocks required — all functions are pure.

describe('createShapeGeometry', () => {
  // ── Default / rectangle ────────────────────────────────────────────────────

  it('returns BoxGeometry for rectangle', () => {
    const { geometry, materialCount } = createShapeGeometry('rectangle', [4, 2], 0.4);
    expect(geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect(materialCount).toBe(6);
  });

  it('returns BoxGeometry for square', () => {
    const { geometry, materialCount } = createShapeGeometry('square', [3, 3], 0.4);
    expect(geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect(materialCount).toBe(6);
  });

  it('returns ExtrudeGeometry for rectangle with cornerRadius > 0', () => {
    const { geometry, materialCount } = createShapeGeometry('rectangle', [4, 2], 0.4, 0.3);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });

  it('returns ExtrudeGeometry for square with cornerRadius > 0', () => {
    const { geometry, materialCount } = createShapeGeometry('square', [3, 3], 0.4, 0.3);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });

  // ── Regular polygon prisms ─────────────────────────────────────────────────
  // All polygon shapes use ExtrudeGeometry so the polygon face (cap) is oriented
  // toward +Z (camera), not the barrel. materialCount: 2 = caps + walls.

  it('returns ExtrudeGeometry for circle', () => {
    const { geometry, materialCount } = createShapeGeometry('circle', [4, 4], 0.4);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });

  it('returns ExtrudeGeometry for triangle', () => {
    const { geometry, materialCount } = createShapeGeometry('triangle', [3, 3], 0.4);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });

  it('returns ExtrudeGeometry for pentagon', () => {
    const { geometry, materialCount } = createShapeGeometry('pentagon', [4, 4], 0.4);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });

  it('returns ExtrudeGeometry for hexagon', () => {
    const { geometry, materialCount } = createShapeGeometry('hexagon', [4, 4], 0.4);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });

  it('returns ExtrudeGeometry for heptagon', () => {
    const { geometry, materialCount } = createShapeGeometry('heptagon', [4, 4], 0.4);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });

  it('returns ExtrudeGeometry for octagon', () => {
    const { geometry, materialCount } = createShapeGeometry('octagon', [4, 4], 0.4);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });

  it('returns ExtrudeGeometry for nonagon', () => {
    const { geometry, materialCount } = createShapeGeometry('nonagon', [4, 4], 0.4);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });

  it('returns ExtrudeGeometry for decagon', () => {
    const { geometry, materialCount } = createShapeGeometry('decagon', [4, 4], 0.4);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });

  // Polygon geometry uses r = max(w, h) / 2 as uniform radius.
  // For a hexagon [6, 4], r = 3, so the geometry is a regular hexagon with
  // vertex-to-vertex diameter = 6 on both axes.
  it('hexagon uses max dimension as uniform circumradius', () => {
    const { geometry } = createShapeGeometry('hexagon', [6, 4], 0.4);
    const bbox = new THREE.Box3().setFromBufferAttribute(
      geometry.getAttribute('position') as THREE.BufferAttribute,
    );
    const size = bbox.getSize(new THREE.Vector3());
    // r = max(6, 4) / 2 = 3. Vertex-to-vertex = 2r = 6 on Y axis.
    expect(size.y).toBeCloseTo(6, 0);
    // Flat-side-to-flat-side = 2r * cos(π/6) ≈ 5.196 on X axis.
    expect(size.x).toBeCloseTo(2 * 3 * Math.cos(Math.PI / 6), 1);
    // Depth: Z extent ≈ depth (0.4)
    expect(size.z).toBeCloseTo(0.4, 1);
  });

  // ── Special 2D shapes ──────────────────────────────────────────────────────

  it('returns BoxGeometry (rotated) for diamond', () => {
    const { geometry, materialCount } = createShapeGeometry('diamond', [4, 2], 0.4);
    expect(geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect(materialCount).toBe(6);
    // Rotation by 45° makes the diagonal of the original box span the X axis —
    // bounding width should be greater than the original narrower side (2).
    const bbox = new THREE.Box3().setFromBufferAttribute(
      geometry.getAttribute('position') as THREE.BufferAttribute,
    );
    expect(bbox.getSize(new THREE.Vector3()).x).toBeGreaterThan(2);
  });

  it('returns SphereGeometry for oval', () => {
    const { geometry, materialCount } = createShapeGeometry('oval', [6, 3], 0.4);
    expect(geometry).toBeInstanceOf(THREE.SphereGeometry);
    expect(materialCount).toBe(6);
  });

  it('returns ExtrudeGeometry for cloud', () => {
    const { geometry, materialCount } = createShapeGeometry('cloud', [4, 3], 0.4);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });

  it('returns ExtrudeGeometry for document', () => {
    const { geometry, materialCount } = createShapeGeometry('document', [4, 3], 0.4);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });

  it('returns ExtrudeGeometry for parallelogram', () => {
    const { geometry, materialCount } = createShapeGeometry('parallelogram', [4, 2], 0.4);
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(materialCount).toBe(2);
  });
});

describe('createShapeOutlineGeometry', () => {
  // The outline geometry is used by NodeRenderer for LineLoop borders.
  // All shapes return a BufferGeometry with at least 3 position points.

  it('rectangle outline has positions at correct Z offset', () => {
    const geo = createShapeOutlineGeometry('rectangle', 4, 2, 0.4, 0);
    const positions = geo.getAttribute('position') as THREE.BufferAttribute;
    expect(positions.count).toBeGreaterThanOrEqual(3);
    // All points should be at Z = 0.005 (just in front of the front face at Z=0).
    for (let i = 0; i < positions.count; i++) {
      expect(positions.getZ(i)).toBeCloseTo(0.005, 3);
    }
  });

  it('hexagon outline has 7 points (6 vertices + close)', () => {
    const geo = createShapeOutlineGeometry('hexagon', 4, 4, 0.4, 0);
    const positions = geo.getAttribute('position') as THREE.BufferAttribute;
    expect(positions.count).toBe(7); // 6 sides + 1 closing point
  });

  it('triangle outline has 4 points (3 vertices + close)', () => {
    const geo = createShapeOutlineGeometry('triangle', 3, 3, 0.4, 0);
    const positions = geo.getAttribute('position') as THREE.BufferAttribute;
    expect(positions.count).toBe(4); // 3 sides + 1 closing point
  });

  it('diamond outline has 5 points (4 vertices + close)', () => {
    const geo = createShapeOutlineGeometry('diamond', 4, 2, 0.4, 0);
    const positions = geo.getAttribute('position') as THREE.BufferAttribute;
    expect(positions.count).toBe(5); // top, right, bottom, left, close
  });

  it('oval outline has points spanning full width and height', () => {
    const geo = createShapeOutlineGeometry('oval', 6, 3, 0.4, 0);
    const positions = geo.getAttribute('position') as THREE.BufferAttribute;
    const bbox = new THREE.Box3().setFromBufferAttribute(positions);
    const size = bbox.getSize(new THREE.Vector3());
    // rx = 3, ry = 1.5 → full span should be close to 6 × 3
    expect(size.x).toBeCloseTo(6, 0);
    expect(size.y).toBeCloseTo(3, 0);
  });

  it('rectangle with cornerRadius > 0 produces more points than sharp rectangle', () => {
    const sharp = createShapeOutlineGeometry('rectangle', 4, 2, 0.4, 0);
    const rounded = createShapeOutlineGeometry('rectangle', 4, 2, 0.4, 0.3);
    const sharpPos = sharp.getAttribute('position') as THREE.BufferAttribute;
    const roundedPos = rounded.getAttribute('position') as THREE.BufferAttribute;
    // Rounded rect uses getPoints(48) → more subdivided than the corner-degenerate version
    expect(roundedPos.count).toBeGreaterThanOrEqual(sharpPos.count);
  });
});

describe('getContentRect', () => {
  // rectangle/square — full bounding box, no reduction.
  it('rectangle returns full size unchanged', () => {
    expect(getContentRect('rectangle', [6, 3])).toEqual([6, 3]);
  });

  it('square returns full size unchanged', () => {
    expect(getContentRect('square', [4, 4])).toEqual([4, 4]);
  });

  // Hexagon content rect: inscribed square in a regular hexagon with r = max(w,h)/2.
  // The compile layer clamps polygon sizes to [max, max] before reaching here.
  it('hexagon content rect is a square inscribed within the hexagonal boundary', () => {
    const size = [4, 4] as const;
    const r = 2;
    const [cw, ch] = getContentRect('hexagon', size);
    expect(cw).toBe(ch); // must be square for a regular polygon
    expect(cw).toBeLessThan(size[0]);
    // Verify corners fit inside the hexagon
    const halfSide = cw / 2;
    const cornerDist = halfSide * Math.SQRT2;
    const apothem = r * Math.cos(Math.PI / 6);
    const edgeDist = apothem / Math.cos(Math.PI / 12);
    expect(cornerDist).toBeLessThanOrEqual(edgeDist + 0.001);
  });

  it('triangle content rect is smaller than hexagon for same size', () => {
    const size = [4, 4] as const;
    const [twHex] = getContentRect('hexagon', size);
    const [twTri] = getContentRect('triangle', size);
    expect(twTri).toBeLessThan(twHex); // triangle apothem is smaller
  });

  it('octagon content rect is wider than hexagon for same size', () => {
    const size = [4, 4] as const;
    const [cwHex] = getContentRect('hexagon', size);
    const [cwOct] = getContentRect('octagon', size);
    expect(cwOct).toBeGreaterThan(cwHex); // octagon has larger apothem
  });

  it('polygon content rect always fits within the diameter (compile layer clamps to square)', () => {
    // The compile layer clamps polygon sizes to [max, max] before reaching the
    // renderer, so getContentRect always receives square sizes for polygons.
    const shapes = ['triangle', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'nonagon', 'decagon'] as const;
    const size = [5, 5] as const; // square (as produced by compile-time max-clamp)
    for (const shape of shapes) {
      const [cw, ch] = getContentRect(shape, size);
      expect(cw).toBeLessThanOrEqual(size[0]);
      expect(ch).toBeLessThanOrEqual(size[1]);
    }
  });

  // Circle — inscribed square with 5% inset: side = r·√2·0.95
  it('circle content rect is a square inscribed within the circle', () => {
    const size = [4, 4] as const;
    const r = 2;
    const [cw, ch] = getContentRect('circle', size);
    const expected = r * Math.SQRT2 * 0.95;
    expect(cw).toBeCloseTo(expected, 5);
    expect(ch).toBeCloseTo(expected, 5);
    expect(cw).toBe(ch); // must be square
    // Content square corners must fit inside the circle
    const halfSide = cw / 2;
    const cornerDist = halfSide * Math.SQRT2;
    expect(cornerDist).toBeLessThanOrEqual(r + 0.001);
  });

  // Diamond — inscribed rectangle: r × r
  it('diamond content rect is r × r', () => {
    const [cw, ch] = getContentRect('diamond', [4, 4]);
    expect(cw).toBeCloseTo(2, 5); // r = 2
    expect(ch).toBeCloseTo(2, 5);
  });

  // Special shapes — all smaller than bounding box
  it('cloud content rect is smaller than bounding box', () => {
    const [cw, ch] = getContentRect('cloud', [6, 4]);
    expect(cw).toBeLessThan(6);
    expect(ch).toBeLessThan(4);
  });

  it('document content rect is smaller than bounding box', () => {
    const [cw, ch] = getContentRect('document', [6, 4]);
    expect(cw).toBeLessThan(6);
    expect(ch).toBeLessThan(4);
  });

  it('parallelogram content width is reduced from bounding box', () => {
    const [cw] = getContentRect('parallelogram', [6, 4]);
    expect(cw).toBeLessThan(6);
  });
});

describe('isRectangularShape', () => {
  it('returns true for rectangle', () => {
    expect(isRectangularShape('rectangle')).toBe(true);
  });

  it('returns true for square', () => {
    expect(isRectangularShape('square')).toBe(true);
  });

  it('returns false for hexagon', () => {
    expect(isRectangularShape('hexagon')).toBe(false);
  });

  it('returns false for circle', () => {
    expect(isRectangularShape('circle')).toBe(false);
  });

  it('returns false for diamond', () => {
    expect(isRectangularShape('diamond')).toBe(false);
  });
});
