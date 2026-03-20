// Pure Three.js utility: converts SVGLoader output into extruded 3D icon geometry.
// Three.js only — no React, no compiler imports.

import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Visual rendering style for 3D SVG icons on diagram node faces.
 *
 * - 'flat':     ShapeGeometry + MeshBasicMaterial (unlit, 2-D).
 * - 'extruded': All paths extruded to a uniform depth. Clean and symmetric.
 *               Best for single-colour icons (tech:, security:, data: namespaces).
 * - 'layered':  Paths stacked on the Z axis — path[0] is the deep background slab,
 *               path[N] is closest to the viewer. AWS/GCP multi-colour icons use this
 *               naturally. Most visually impactful mode.
 * - 'embossed': Carved / debossed: same ExtrudeGeometry as 'extruded' but rendered
 *               with THREE.BackSide normals. Inverted normals flip the PBR lighting:
 *               the top walls darken (shadow) and the bottom walls brighten (reflected
 *               fill), exactly the lighting signature of a concave carved channel.
 *               The front cap is culled (open top), so the viewer looks into the shape.
 *               No custom shaders required.
 */
export type SvgIcon3DStyle = 'flat' | 'extruded' | 'layered' | 'embossed';

/** Options controlling 3D icon geometry generation. */
export interface SvgIcon3DOptions {
  /** Target icon width in diagram units (icon will be scaled to fit). */
  width: number;
  /** Target icon height in diagram units. */
  height: number;
  /**
   * Maximum Z depth of the frontmost extruded layer, in diagram units.
   * At the default diagram camera (25° elevation), 0.10–0.20 reads clearly
   * without making icons feel chunky.
   */
  maxDepth: number;
  /** Visual style. Must not be 'flat' — caller must use the existing flat path. */
  style: Exclude<SvgIcon3DStyle, 'flat'>;
  /**
   * PBR metalness for all extruded MeshStandardMaterial layers.
   * Should match or derive from the parent node's metalness.
   * Default: 0.15.
   */
  metalness?: number;
  /**
   * PBR roughness for all extruded MeshStandardMaterial layers.
   * Default: 0.45 — polished enough to read bevels, not a mirror.
   */
  roughness?: number;
  /** Override fill color for all SVG paths. When set, replaces any fill color defined in the SVG source. */
  fillColorOverride?: string;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

/** Shape of path.userData.style as populated by SVGLoader. */
type SvgPathStyle = {
  fill?: string;
  fillOpacity?: string;
  stroke?: string;
  strokeOpacity?: string;
  strokeWidth?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
};

/** Per-path extrusion parameters resolved from style + path index. */
interface LayerConfig {
  /** Z position of the path's back face in local icon space (diagram units). */
  zBase: number;
  /** Extrusion depth for this path (diagram units). Frontmost face = zBase + depth. */
  depth: number;
  /** Absolute bevel thickness in diagram units. */
  bevelThickness: number;
  /** Absolute bevel horizontal size in diagram units. */
  bevelSize: number;
  /** Bevel segment count. 3 = chamfer; 5 = rounded edge. */
  bevelSegments: number;
}

/**
 * Resolves per-layer extrusion config for a path by index.
 *
 * Depth strategy summary:
 *   'extruded': all paths same depth, zBase=0. Body extrudes forward from face. Simple.
 *   'layered':  path[0] = deep background slab; subsequent paths start progressively
 *               further forward, creating a physical stack above the face.
 *   'embossed': carved channel — zBase=0, depth ~0.35×maxDepth with small bevel.
 *               Material uses THREE.BackSide in buildSvgIcon3D to invert lighting.
 *
 * Exported for unit testing only. Do not import from outside the shapes/ directory.
 */
export function resolveLayerConfig(
  pathIndex: number,
  _totalPaths: number,
  style: Exclude<SvgIcon3DStyle, 'flat'>,
  maxDepth: number,
): LayerConfig {
  switch (style) {
    case 'extruded':
      return {
        zBase: 0,
        depth: maxDepth * 0.65,
        bevelThickness: maxDepth * 0.06,
        bevelSize: maxDepth * 0.04,
        bevelSegments: 3,
      };

    case 'layered': {
      // Path 0 is the deep background plate; subsequent paths are raised slabs.
      // Background front face ≈ 0.50 * maxDepth.
      // Foreground front face ≈ 0.72 * maxDepth (sitting clearly above background).
      const zBase = pathIndex === 0 ? 0 : pathIndex * maxDepth * 0.36;
      const depth =
        pathIndex === 0
          ? maxDepth * 0.50
          : maxDepth * Math.max(0.22, 0.38 - pathIndex * 0.05);
      return {
        zBase,
        depth,
        bevelThickness: maxDepth * 0.05,
        bevelSize: maxDepth * 0.035,
        bevelSegments: 3,
      };
    }

    case 'embossed': {
      // Carved / debossed channel — BackSide normals applied in buildSvgIcon3D.
      //
      // The geometry is the same type as 'extruded' (ExtrudeGeometry above the face)
      // but THREE.BackSide is set on the material, which:
      //   • Culls the front cap  → open channel mouth (viewer looks down into it)
      //   • Inverts all normals  → top walls become dark, bottom walls bright —
      //     the exact PBR lighting signature of a concave carved channel
      //
      // Depth ~0.35 × maxDepth gives visible channel walls at the default 25°
      // camera elevation without the icon feeling too deep.
      // All paths share the same zBase (no per-path stagger).
      return {
        zBase:          0,
        depth:          maxDepth * 0.35,
        bevelThickness: maxDepth * 0.08,
        bevelSize:      maxDepth * 0.06,
        bevelSegments:  3,
      };
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds a THREE.Group from SVGLoader result data using ExtrudeGeometry.
 *
 * Each filled SVG path becomes one or more extruded meshes. Paths with
 * fill:'none' are skipped for extrusion; their strokes (if any) are rendered
 * as flat overlaid geometry at the frontmost layer Z.
 *
 * The returned group is centred at local [0, 0, 0] and scaled to fit within
 * options.width × options.height. Y-flip is applied (SVG is Y-down, Three.js
 * is Y-up). The group is ready to be attached to a node's iconHolder at
 * position [0, yOffset, nodeDepth/2 + 0.01].
 *
 * The caller is responsible for propagating node opacity to the group's
 * materials — traverse children and mutate MeshStandardMaterial.opacity
 * in-place (do not call this function again on every opacity tick).
 */
export function buildSvgIcon3D(
  svgData: { paths: ReturnType<SVGLoader['parse']>['paths'] },
  options: SvgIcon3DOptions,
): THREE.Group {
  const { width, height, maxDepth, style, metalness = 0.15, roughness = 0.45, fillColorOverride } = options;

  const group = new THREE.Group();
  const paths = svgData.paths ?? [];

  // Filled paths become 3D geometry. Treat missing fill as inherited/default fill
  // (common in Heroicons where fill is set at the <svg> level). Only explicit
  // fill='none' is excluded.
  const filledPaths = paths.filter((path) => {
    const s = (path.userData as { style?: SvgPathStyle } | undefined)?.style;
    return s?.fill !== 'none';
  });

  const totalPaths = filledPaths.length;
  if (totalPaths === 0) return group;

  // 'embossed' (carved) uses THREE.BackSide normals on an otherwise normal PBR
  // material.  Inverted normals flip the lighting so the channel reads as concave.
  const isSunken = style === 'embossed';

  filledPaths.forEach((path, pathIndex) => {
    const s = (path.userData as { style?: SvgPathStyle } | undefined)?.style;
    const fillColor = fillColorOverride ?? s?.fill ?? '#ffffff';
    const color = new THREE.Color(fillColor);
    const layer = resolveLayerConfig(pathIndex, totalPaths, style, maxDepth);

    const shapes = SVGLoader.createShapes(path);
    if (shapes.length === 0) return;

    const iconMetalness = isSunken ? metalness * 0.2 : metalness * 0.3;
    const iconRoughness = isSunken ? Math.min(1, roughness * 1.6) : Math.max(roughness, 0.55);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
      metalness: iconMetalness,
      roughness: iconRoughness,
      transparent: true,
      opacity: 1,
      depthWrite: true,
      // BackSide inverts all normals for carved style.
      // For non-carved styles use DoubleSide because some SVG paths can have
      // opposite winding; FrontSide culling can hide those icons entirely.
      side: isSunken ? THREE.BackSide : THREE.DoubleSide,
    });

    shapes.forEach((shape) => {
      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: layer.depth,
        bevelEnabled: layer.bevelThickness > 0,
        bevelThickness: layer.bevelThickness,
        bevelSize: layer.bevelSize,
        bevelSegments: layer.bevelSegments,
        bevelOffset: 0,
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const mesh = new THREE.Mesh(geometry, material);
      // zBase positions the back face; ExtrudeGeometry extrudes in +Z by default.
      mesh.position.z = layer.zBase;
      group.add(mesh);
    });

    // ── Stroke overlay ─────────────────────────────────────────────────────────
    // For paths that carry both fill and stroke (uncommon in cloud icons but
    // present in some flow icons), render the stroke as a flat overlay on top
    // of the extrusion at the front face + epsilon to avoid z-fighting.
    const strokeColor = s?.stroke;
    if (strokeColor && strokeColor !== 'none') {
      const strokeWidth = parseFloat(s?.strokeWidth ?? '1');
      if (strokeWidth > 0) {
        const strokeStyle = SVGLoader.getStrokeStyle(strokeWidth, strokeColor);
        const frontZ = layer.zBase + layer.depth + 0.002;
        path.subPaths.forEach((subPath) => {
          const pts2D = subPath.getPoints();
          if (pts2D.length < 2) return;
          const strokeGeo = SVGLoader.pointsToStroke(pts2D, strokeStyle);
          if (!strokeGeo) return;
          const strokeMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(strokeColor),
            metalness: metalness * 0.5,
            roughness: roughness * 0.8,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const strokeMesh = new THREE.Mesh(strokeGeo, strokeMat);
          strokeMesh.position.z = frontZ;
          group.add(strokeMesh);
        });
      }
    }
  });

  // ── Fit to target size ────────────────────────────────────────────────────
  // SVG coordinate system is Y-down; Three.js is Y-up. Apply Y-flip first,
  // then scale to fit within width × height (preserving the Y-flip in the scale).
  group.scale.set(1, -1, 1);

  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);

  // Guard: degenerate SVG (invisible / zero-area shapes) — return as-is.
  if (size.x < 0.001 || size.y < 0.001) return group;

  const fitScale = Math.min(width / size.x, height / size.y);
  // Re-apply scale: fitScale for X, -fitScale preserves Y-flip, 1 for Z
  // (Z is not scaled — extrusion depth is already in diagram units via maxDepth).
  group.scale.set(fitScale, -fitScale, 1);

  // Centre XY so local [0, 0] maps to the icon's visual centre.
  // Z is NOT centred — the icon extrudes forward from Z=0 (the node front face).
  const box2 = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  group.position.set(-center.x, -center.y, 0);

  return group;
}
