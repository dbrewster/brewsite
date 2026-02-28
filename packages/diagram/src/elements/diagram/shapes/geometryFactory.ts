// Three.js geometry factory for diagram node shapes.
// Three.js only — no React, no compiler imports.

import * as THREE from 'three';
import type { DiagramNodeShape } from './shapeVariants';

export type ShapeGeometrySpec = {
  geometry: THREE.BufferGeometry;
  rotation?: THREE.Euler;
  /**
   * Number of material groups in the geometry.
   * 6 = BoxGeometry or SphereGeometry (single surface — all groups use material[0])
   * 2 = ExtrudeGeometry (group 0 = caps front+back → face color, group 1 = walls → side color)
   */
  materialCount: 2 | 6;
};

// ── Private helpers ──────────────────────────────────────────────────────────

/**
 * Creates a regular N-sided polygon THREE.Shape centered at the origin.
 * Vertex 0 is at the top (angle = −π/2); vertices wind counter-clockwise.
 * Used by both createShapeGeometry (ExtrudeGeometry) and createShapeOutlineGeometry (LineLoop).
 */
function createRegularPolygonShape(sides: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

/** Extrudes a regular polygon shape, centered along Z. materialCount: 2. */
function polygonGeo(sides: number, r: number, depth: number): ShapeGeometrySpec {
  const polyShape = createRegularPolygonShape(sides, r);
  const geo = new THREE.ExtrudeGeometry(polyShape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return { geometry: geo, materialCount: 2 };
}

/** Creates a LineLoop BufferGeometry tracing a regular polygon at the given Z depth. */
function polygonOutlineGeo(sides: number, r: number, z: number): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    points.push(new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, z));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

/**
 * Creates a THREE.Shape path approximating a cloud silhouette.
 * The cloud has a flat bottom at -h*0.25 and four bumps of varying radii across the top.
 * Arc parameters may need visual tuning at extreme aspect ratios.
 */
function createCloudShape(w: number, h: number): THREE.Shape {
  const shape = new THREE.Shape();
  const by = -h * 0.25; // flat bottom baseline

  // Four bumps, left to right: small, large, medium, small
  const bump1 = { cx: -w * 0.30, cy: by + h * 0.18, r: w * 0.18 };
  const bump2 = { cx: -w * 0.08, cy: by + h * 0.30, r: w * 0.25 };
  const bump3 = { cx:  w * 0.13, cy: by + h * 0.24, r: w * 0.20 };
  const bump4 = { cx:  w * 0.33, cy: by + h * 0.14, r: w * 0.16 };

  // Build the cloud outline counter-clockwise: left side of bump1 → sweep each bump → right flat base
  shape.absarc(bump1.cx, bump1.cy, bump1.r, Math.PI, 0, false);
  shape.absarc(bump2.cx, bump2.cy, bump2.r, Math.PI, 0, false);
  shape.absarc(bump3.cx, bump3.cy, bump3.r, Math.PI, 0, false);
  shape.absarc(bump4.cx, bump4.cy, bump4.r, Math.PI * 0.9, -0.1, false);
  shape.lineTo( w * 0.46, by);
  shape.lineTo(-w * 0.46, by);
  shape.closePath();
  return shape;
}

/**
 * Creates a THREE.Shape path for a document/page silhouette.
 * Rectangle with the top-right corner folded inward (classic document icon).
 */
function createDocumentShape(w: number, h: number): THREE.Shape {
  const fold = Math.min(w, h) * 0.18;
  const hw = w / 2;
  const hh = h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo( hw, -hh);
  shape.lineTo( hw,  hh - fold);
  shape.lineTo( hw - fold,  hh);
  shape.lineTo(-hw,  hh);
  shape.closePath();
  return shape;
}

/**
 * Creates a THREE.Shape path for a parallelogram.
 * A rectangle sheared horizontally by 20% of width.
 */
function createParallelogramShape(w: number, h: number): THREE.Shape {
  const shear = w * 0.20;
  const hw = w / 2;
  const hh = h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + shear / 2, -hh);
  shape.lineTo( hw + shear / 2, -hh);
  shape.lineTo( hw - shear / 2,  hh);
  shape.lineTo(-hw - shear / 2,  hh);
  shape.closePath();
  return shape;
}

// ── Public exports ───────────────────────────────────────────────────────────

/**
 * Creates a THREE.Shape path for a rounded rectangle centered at the origin.
 * Used for both ExtrudeGeometry (rounded boxes) and LineLoop border outlines.
 * cornerRadius is clamped to at most 49.9% of half-width/height to prevent collapse.
 */
export function createRoundedRectShape(w: number, h: number, cornerRadius: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(Math.abs(cornerRadius), hw * 0.499, hh * 0.499);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

/**
 * Creates a BufferGeometry for a rounded rectangle LineLoop outline.
 * Points lie at Z = depth/2 + 0.005 so the outline sits just in front of the node face.
 * @deprecated Prefer createShapeOutlineGeometry which handles all DiagramNodeShape values.
 */
export function createRoundedBorderGeometry(
  w: number,
  h: number,
  depth: number,
  cornerRadius: number,
): THREE.BufferGeometry {
  const shape = createRoundedRectShape(w, h, cornerRadius);
  const pts2d = shape.getPoints(48);
  const z = depth / 2 + 0.005;
  const points3d = pts2d.map((p) => new THREE.Vector3(p.x, p.y, z));
  // Close the loop explicitly — LineLoop also closes implicitly, but an extra
  // identical final point avoids a visual gap at the seam on some drivers.
  points3d.push(new THREE.Vector3(pts2d[0].x, pts2d[0].y, z));
  return new THREE.BufferGeometry().setFromPoints(points3d);
}

/**
 * Creates a LineLoop-compatible BufferGeometry tracing the 2D front-face outline
 * of any DiagramNodeShape. Points lie at Z = depth/2 + 0.005 (just in front of the
 * node face). Used by NodeRenderer for all shapes except flat-cornered rectangle/square
 * (which use EdgesGeometry on the BoxGeometry directly).
 *
 * For rectangle/square, this produces the same outline as createRoundedBorderGeometry,
 * respecting the cornerRadius. For polygon shapes, cornerRadius is ignored.
 */
export function createShapeOutlineGeometry(
  shape: DiagramNodeShape,
  w: number,
  h: number,
  depth: number,
  cornerRadius: number,
): THREE.BufferGeometry {
  const z = depth / 2 + 0.005;

  /** Convert a THREE.Shape path to a closed array of 3D points at the given Z. */
  const shapeToPoints = (s: THREE.Shape, segs = 48): THREE.Vector3[] => {
    const pts = s.getPoints(segs);
    const out = pts.map((p) => new THREE.Vector3(p.x, p.y, z));
    out.push(new THREE.Vector3(pts[0].x, pts[0].y, z)); // explicit close
    return out;
  };

  switch (shape) {
    // Rectangle/square: respect cornerRadius (produces plain rect when cornerRadius=0)
    case 'rectangle':
    case 'square':
      return new THREE.BufferGeometry().setFromPoints(
        shapeToPoints(createRoundedRectShape(w, h, cornerRadius)),
      );

    // Regular polygon prisms — cornerRadius is irrelevant for these shapes
    case 'circle':
      return polygonOutlineGeo(64, Math.min(w, h) / 2, z);
    case 'triangle':
      return polygonOutlineGeo(3, Math.min(w, h) / 2, z);
    case 'pentagon':
      return polygonOutlineGeo(5, Math.min(w, h) / 2, z);
    case 'hexagon':
      return polygonOutlineGeo(6, Math.min(w, h) / 2, z);
    case 'heptagon':
      return polygonOutlineGeo(7, Math.min(w, h) / 2, z);
    case 'octagon':
      return polygonOutlineGeo(8, Math.min(w, h) / 2, z);
    case 'nonagon':
      return polygonOutlineGeo(9, Math.min(w, h) / 2, z);
    case 'decagon':
      return polygonOutlineGeo(10, Math.min(w, h) / 2, z);

    // Special 2D shapes
    case 'diamond': {
      const hw = w / 2;
      const hh = h / 2;
      return new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(  0,  hh, z),
        new THREE.Vector3( hw,   0, z),
        new THREE.Vector3(  0, -hh, z),
        new THREE.Vector3(-hw,   0, z),
        new THREE.Vector3(  0,  hh, z), // explicit close
      ]);
    }
    case 'oval': {
      const rx = w / 2;
      const ry = h / 2;
      const segs = 48;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry, z));
      }
      return new THREE.BufferGeometry().setFromPoints(pts);
    }
    case 'cloud':
      return new THREE.BufferGeometry().setFromPoints(shapeToPoints(createCloudShape(w, h)));
    case 'document':
      return new THREE.BufferGeometry().setFromPoints(shapeToPoints(createDocumentShape(w, h)));
    case 'parallelogram':
      return new THREE.BufferGeometry().setFromPoints(shapeToPoints(createParallelogramShape(w, h)));
  }
}

/**
 * Returns true when the shape uses flat BoxGeometry with no rounding — the only
 * case where NodeRenderer uses EdgesGeometry directly for the border outline.
 */
export function isRectangularShape(shape: DiagramNodeShape): boolean {
  return shape === 'rectangle' || shape === 'square';
}

/**
 * Returns the [width, height] of the largest axis-aligned rectangle that safely
 * fits inside the rendered shape for content layout (icon + label placement).
 *
 * For rectangle/square this is the full bounding box. For all other shapes it
 * is smaller, preventing icons and text from overflowing the polygon boundary.
 *
 * ## Regular polygon math (pointy-top/bottom orientation, vertex at ±Y extremes)
 *
 * With circumradius r = Math.min(w,h)/2 and N sides:
 *   apothem = r·cos(π/N)           — distance from center to each flat side
 *   content width  = 2·apothem     — the full flat-side span (touches left & right sides)
 *   content height = r             — the flat-side band height (half the bounding box)
 *
 * The rectangle corners land exactly on the polygon edge at y = ±r/2, x = ±apothem.
 * Any taller rectangle must be narrower, giving smaller total area — this is optimal.
 *
 * For circle the inscribed square has side = r·√2.
 */
export function getContentRect(
  shape: DiagramNodeShape,
  size: readonly [number, number],
): readonly [number, number] {
  const [w, h] = size;
  const r = Math.min(w, h) / 2;

  /**
   * Content square for a regular N-gon: 85% of the inscribed-circle diameter.
   *
   * apothem = r·cos(π/N) is the inscribed-circle radius. Using a square side of
   * 2·apothem·0.85 gives a balanced layout area that fills the visible face without
   * the asymmetry of the exact [2·apothem, r] rectangle (which restricts height to
   * 50% of the bounding box for all N, making higher-order polygons feel over-padded).
   *
   * For circle (N=64), apothem ≈ r, so content ≈ [1.7r, 1.7r] — noticeably larger
   * than the inscribed-circle square (r·√2 ≈ 1.41r) that was previously too tight.
   */
  const polygonRect = (N: number): readonly [number, number] => {
    const apothem = r * Math.cos(Math.PI / N);
    const side = 2 * apothem * 0.85;
    return [side, side];
  };

  switch (shape) {
    case 'rectangle':
    case 'square':
      return size;

    // Regular polygon prisms — symmetric content square (85% of inscribed circle)
    case 'circle': {
      // Circle needs more margin than polygons because there are no flat sides —
      // content in the corners of a content square visually clips the curved edge.
      // 0.75 of inscribed circle diameter (≈ 1.50r) gives comfortable breathing room.
      const side = r * Math.cos(Math.PI / 64) * 2 * 0.70;
      return [side, side];
    }
    case 'triangle': return polygonRect(3);
    case 'pentagon': return polygonRect(5);
    case 'hexagon':  return polygonRect(6);
    case 'heptagon': return polygonRect(7);
    case 'octagon':  return polygonRect(8);
    case 'nonagon':  return polygonRect(9);
    case 'decagon':  return polygonRect(10);

    case 'diamond': {
      // Diamond = box rotated 45°. Largest inscribed rect:
      // apothem = r·cos(π/4) = r/√2; inscribed rect = r × r.
      return [r, r];
    }

    case 'oval': {
      // Use the minor-axis inscribed square as the safe content area.
      const side = r * Math.SQRT2;
      return [side, side];
    }

    case 'cloud':
      // Irregular silhouette — conservative estimate using visible interior.
      return [w * 0.65, h * 0.55];

    case 'document':
      // Rectangle with folded corner — slightly reduced on all sides.
      return [w * 0.85, h * 0.82];

    case 'parallelogram':
      // Sheared rectangle — center column is safe, but horizontal extent is reduced.
      return [w * 0.72, h];
  }
}

export function createShapeGeometry(
  shape: DiagramNodeShape,
  size: readonly [number, number],
  depth: number,
  cornerRadius = 0,
): ShapeGeometrySpec {
  const [width, height] = size;
  const r = Math.min(width, height) / 2;

  switch (shape) {
    // ── Regular polygon prisms ────────────────────────────────────────────────
    // ExtrudeGeometry with a regular polygon path — front cap faces +Z (toward camera).
    // materialCount: 2 → group 0 = caps (face color), group 1 = walls (side color).
    // Using ExtrudeGeometry (not CylinderGeometry) ensures:
    //   • Correct orientation: polygon face visible from the front (Z axis), not the top (Y axis)
    //   • Correct material groups: 2 groups matching createBoxMaterials(materialCount=2)
    case 'circle':   return polygonGeo(64, r, depth); // smooth approximation
    case 'triangle': return polygonGeo(3,  r, depth);
    case 'pentagon': return polygonGeo(5,  r, depth);
    case 'hexagon':  return polygonGeo(6,  r, depth);
    case 'heptagon': return polygonGeo(7,  r, depth);
    case 'octagon':  return polygonGeo(8,  r, depth);
    case 'nonagon':  return polygonGeo(9,  r, depth);
    case 'decagon':  return polygonGeo(10, r, depth);

    // ── Special 2D shapes ────────────────────────────────────────────────────
    case 'diamond': {
      // Rotated box — diamond vertices at top/bottom/left/right extremes.
      const geometry = new THREE.BoxGeometry(width, height, depth);
      geometry.rotateZ(Math.PI / 4);
      return { geometry, materialCount: 6 };
    }
    case 'oval': {
      // Scaled unit sphere — ellipsoidal prism.
      const geometry = new THREE.SphereGeometry(0.5, 24, 16);
      geometry.scale(width, height, depth);
      return { geometry, materialCount: 6 };
    }
    case 'cloud': {
      const cloudShape = createCloudShape(width, height);
      const geo = new THREE.ExtrudeGeometry(cloudShape, { depth, bevelEnabled: false });
      geo.translate(0, 0, -depth / 2);
      return { geometry: geo, materialCount: 2 };
    }
    case 'document': {
      const docShape = createDocumentShape(width, height);
      const geo = new THREE.ExtrudeGeometry(docShape, { depth, bevelEnabled: false });
      geo.translate(0, 0, -depth / 2);
      return { geometry: geo, materialCount: 2 };
    }
    case 'parallelogram': {
      const paraShape = createParallelogramShape(width, height);
      const geo = new THREE.ExtrudeGeometry(paraShape, { depth, bevelEnabled: false });
      geo.translate(0, 0, -depth / 2);
      return { geometry: geo, materialCount: 2 };
    }

    // ── Rectangle / Square (default) ─────────────────────────────────────────
    case 'square':
    case 'rectangle': {
      // 'square' shares the same BoxGeometry; caller controls aspect via size prop.
      if (cornerRadius > 0) {
        // Rounded rectangle via ExtrudeGeometry.
        // ExtrudeGeometry group indices: 0 = caps (front+back), 1 = side walls.
        const roundedShape = createRoundedRectShape(width, height, cornerRadius);
        const extrudeGeo = new THREE.ExtrudeGeometry(roundedShape, {
          depth,
          bevelEnabled: false,
        });
        // ExtrudeGeometry extrudes from Z=0 to Z=depth; center along Z axis.
        extrudeGeo.translate(0, 0, -depth / 2);
        return { geometry: extrudeGeo, materialCount: 2 };
      }
      return { geometry: new THREE.BoxGeometry(width, height, depth), materialCount: 6 };
    }

    default: {
      const _exhaustive: never = shape;
      console.warn(`[geometryFactory] Unknown shape: ${String(_exhaustive)}, falling back to rectangle`);
      return { geometry: new THREE.BoxGeometry(width, height, depth), materialCount: 6 };
    }
  }
}
