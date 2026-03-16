// CarouselScrubber element Three.js renderer.
// Excluded from test coverage — Three.js rendering logic.

import * as THREE from 'three';
import type { CarouselScrubberState, CarouselScrubberStyle, CarouselTrayEdgeStyle, CarouselTraySurfacePattern } from './types';
import type { NVSCoordService } from '../../widget/types';
import { generateSurfaceNormalMap, loadCustomSurfaceMap } from './surfaceTexture';
import {
  resolveTrayShapeKind,
  generateEllipsePoints,
  generateParabolicPoints,
  generateRoundedRectPoints,
  computeParabolicBandWidth,
  computeLinearMaxDepth,
  computeBevelRadius,
  computeGeometryKey,
  computeTrayZDepth,
  type TrayGeometryParams,
} from './geometry';
import { computeTrayPosition, computeTrayWorldWidth, computeRingRotation, type TrayCoordService } from './trayPosition';

/** Three.js refs for the carousel scrubber renderer. */
export type CarouselScrubberRefs = {
  scene: THREE.Scene;
};

/** Internal cache structure stored on scene.userData. */
export type CarouselScrubberCache = {
  root: THREE.Group;
  base: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null;
  /** String key encoding all geometry parameters for change detection. */
  lastGeoKey: string;
  /** Last surface pattern used for normal map generation. */
  lastSurfacePattern: CarouselTraySurfacePattern | null;
  /** Last surface map URL. */
  lastSurfaceMapUrl: string | null;
  /** Cached normal map texture. */
  normalMapTexture: THREE.Texture | null;
  /** Last compiled style for material change detection. */
  lastStyleKey: string;
  /** Current interpolated rotation (radians). null = not yet initialized. */
  currentRotation: number | null;
};

const CACHE_KEY = '__brewsite_carousel_scrubber';
const FLOOR_PART_KEY = '__brewsite_floor_part';

/**
 * Applies vertex displacement to the front edge of the tray geometry.
 * Called BEFORE the -π/2 X rotation, in the original ExtrudeGeometry coordinate
 * system where:
 *   - Shape is in XY plane (X = width, Y = depth/front-back)
 *   - Extrusion is along +Z (height)
 *   - Front edge = the -Y side of the shape outline (camera-facing after rotation)
 *
 * Only displaces side-wall vertices (not top/bottom caps) on the front edge.
 * Side-wall vertices are identified by having a normal Y component < -0.7
 * (pointing toward -Y = toward the camera after rotation).
 *
 * For ellipses, this naturally limits to the frontmost arc of the perimeter.
 */
function applyEdgeTreatment(
  geometry: THREE.ExtrudeGeometry,
  height: number,
  style: 'knurled' | 'ridged',
): void {
  const posAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');

  for (let i = 0; i < posAttr.count; i++) {
    const ny = normalAttr.getY(i);
    // Only displace side-wall vertices facing the front (-Y direction in pre-rotation space).
    // Threshold -0.7 catches the flat front face and a narrow band of adjacent bevel,
    // but excludes the top/bottom caps (ny ≈ 0) and the side/back walls (ny > 0).
    if (ny > -0.7) continue;

    const x = posAttr.getX(i);
    const z = posAttr.getZ(i); // Z = height axis before rotation

    let displacement = 0;

    if (style === 'knurled') {
      // Diamond knurl pattern: two intersecting sine waves keyed on X and Z (height).
      const knurlCountX = 40;
      const knurlCountZ = 8;
      const knurlDepth = 0.005;
      const patternX = Math.sin(x * knurlCountX * Math.PI);
      const patternZ = Math.cos(z * knurlCountZ * Math.PI / height);
      displacement = patternX * patternZ * knurlDepth;
    } else if (style === 'ridged') {
      // Horizontal ridges: sine-wave displacement keyed on Z (height) position.
      const ridgeCount = 6;
      const ridgeDepth = 0.004;
      const zNorm = z / height;
      displacement = Math.sin(zNorm * ridgeCount * Math.PI * 2) * ridgeDepth;
    }

    // Displace along the normal direction (outward from the front face).
    posAttr.setY(i, posAttr.getY(i) + displacement * (ny / Math.abs(ny)));
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
}

/**
 * Converts a plain ShapePoint array to a THREE.Shape for extrusion.
 * The first point becomes the moveTo; subsequent points are lineTo.
 */
function pointsToThreeShape(points: ReadonlyArray<{ x: number; y: number }>): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length === 0) return shape;
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }
  return shape;
}

/**
 * Converts a rounded-rect ShapePoint array to a THREE.Shape using quadratic curves.
 * This preserves the smooth corner rounding from the original createRoundedRectShape.
 */
function roundedRectPointsToThreeShape(halfW: number, halfZ: number): THREE.Shape {
  const r = Math.min(halfZ * 0.45, halfW * 0.15, 0.5);
  const shape = new THREE.Shape();
  shape.moveTo(-halfW + r, -halfZ);
  shape.lineTo(halfW - r, -halfZ);
  shape.quadraticCurveTo(halfW, -halfZ, halfW, -halfZ + r);
  shape.lineTo(halfW, halfZ - r);
  shape.quadraticCurveTo(halfW, halfZ, halfW - r, halfZ);
  shape.lineTo(-halfW + r, halfZ);
  shape.quadraticCurveTo(-halfW, halfZ, -halfW, halfZ - r);
  shape.lineTo(-halfW, -halfZ + r);
  shape.quadraticCurveTo(-halfW, -halfZ, -halfW + r, -halfZ);
  return shape;
}

/**
 * Normalizes UV coordinates of an ExtrudeGeometry so the shape center
 * maps to UV (0.5, 0.5) and the full shape extent maps to [0, 1].
 *
 * Three.js ExtrudeGeometry uses the shape's 2D coordinates directly as UVs.
 * For a shape centered at (0, 0) with half-extents (halfW, halfZ), the raw
 * UVs range from (-halfW, -halfZ) to (halfW, halfZ). This function remaps
 * them to [0, 1] × [0, 1] so procedural normal map patterns (which assume
 * center at 0.5, 0.5) align with the geometry center.
 *
 * Must be called BEFORE the -π/2 X rotation (UVs use pre-rotation coords).
 */
function normalizeCapUVs(geometry: THREE.ExtrudeGeometry, halfW: number, halfZ: number): void {
  const uvAttr = geometry.getAttribute('uv');
  if (!uvAttr) return;

  // Use the larger axis for uniform scaling so the texture isn't stretched
  // on non-square shapes. This preserves the pattern's aspect ratio.
  const maxHalf = Math.max(halfW, halfZ, 0.001);

  for (let i = 0; i < uvAttr.count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    // Remap from [-maxHalf, maxHalf] → [0, 1]
    uvAttr.setXY(i, u / (maxHalf * 2) + 0.5, v / (maxHalf * 2) + 0.5);
  }
  uvAttr.needsUpdate = true;
}

/**
 * Creates a tray geometry — circular for ring carousels, parabolic for
 * linear carousels with zStep, or rounded-rect for flat linear carousels.
 *
 * Uses pure shape functions from geometry.ts and converts their point arrays
 * to THREE.Shape objects for extrusion.
 */
function createTrayGeometry(
  width: number,
  zDepth: number,
  height: number,
  isRing: boolean,
  zStep: number,
  childCount: number,
  bevelRadius: number,
  bevelSegments: number,
  edgeStyle: CarouselTrayEdgeStyle,
): THREE.ExtrudeGeometry {
  let shape: THREE.Shape;
  const shapeKind = resolveTrayShapeKind(isRing, zStep);

  if (shapeKind === 'ellipse') {
    const points = generateEllipsePoints(width * 0.5, zDepth * 0.5);
    shape = pointsToThreeShape(points);
  } else if (shapeKind === 'parabolic') {
    const maxDepth = computeLinearMaxDepth(childCount, zStep);
    const bandWidth = computeParabolicBandWidth(zStep, width);
    const points = generateParabolicPoints(width * 0.5, maxDepth, bandWidth, 32);
    shape = pointsToThreeShape(points);
    shape.closePath();
  } else {
    // Rounded rectangle uses quadratic curves for smooth corners
    shape = roundedRectPointsToThreeShape(width * 0.5, zDepth * 0.5);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: bevelRadius,
    bevelSize: bevelRadius,
    bevelSegments,
  });

  // Normalize UVs so the pattern center aligns with the geometry center.
  // Must happen before rotation and before edge treatment.
  normalizeCapUVs(geometry, width * 0.5, zDepth * 0.5);

  // Apply front-edge surface treatment BEFORE rotation — only for non-ring shapes.
  // Circles have no flat "front edge" — the perimeter is curved, so knurling/ridges
  // would spread across the entire front hemisphere. Edge treatment is reserved for
  // tray shapes with a distinct flat front face.
  if (!isRing && edgeStyle !== 'smooth' && edgeStyle !== 'matte') {
    applyEdgeTreatment(geometry, height, edgeStyle);
  }

  // Rotate so the extrusion direction is along +Y (up), shape in XZ.
  geometry.rotateX(-Math.PI / 2);

  return geometry;
}

/**
 * Finds the floor mesh Y position in the scene, or null if no floor exists.
 * Scans scene.children for objects tagged with __brewsite_floor_part userData.
 */
function findFloorY(scene: THREE.Scene): number | null {
  for (const child of scene.children) {
    const userData = child.userData as Record<string, unknown>;
    if (userData[FLOOR_PART_KEY] === true && child.name === 'Floor') {
      return child.position.y;
    }
  }
  return null;
}

/** Gets or creates the scrubber cache on the scene. */
export function getOrCreateCache(
  scene: THREE.Scene,
  widgetId: string,
): CarouselScrubberCache {
  const key = `${CACHE_KEY}_${widgetId}`;
  const existing = scene.userData[key] as CarouselScrubberCache | undefined;
  if (existing) return existing;

  const root = new THREE.Group();
  root.name = `CarouselScrubber_${widgetId}`;
  // Tag as a floor-adjacent part so the floor's computeSceneBaseY() excludes
  // this group from the scene bounding box. Without this tag, the tray's
  // geometry pushes the floor downward every frame (feedback loop).
  (root.userData as Record<string, unknown>)[FLOOR_PART_KEY] = true;
  scene.add(root);

  const cache: CarouselScrubberCache = {
    root,
    base: null,
    lastGeoKey: '',
    lastSurfacePattern: null,
    lastSurfaceMapUrl: null,
    normalMapTexture: null,
    lastStyleKey: '',
    currentRotation: null,
  };

  scene.userData[key] = cache;
  return cache;
}

/** Ensures the base mesh is correct for the current shape/size/visibility. */
function ensureBase(
  cache: CarouselScrubberCache,
  showBase: boolean,
  geoParams: TrayGeometryParams,
  style: CarouselScrubberStyle,
): void {
  if (!showBase) {
    if (cache.base) cache.base.visible = false;
    return;
  }

  const geoKey = computeGeometryKey(geoParams);
  const needsRecreate = !cache.base || cache.lastGeoKey !== geoKey;

  if (needsRecreate) {
    if (cache.base) {
      cache.root.remove(cache.base);
      cache.base.geometry.dispose();
      cache.base.material.dispose();
    }

    const geometry = createTrayGeometry(
      geoParams.worldWidth,
      geoParams.zDepth,
      geoParams.trayDepth,
      geoParams.shapeKind === 'ellipse',
      geoParams.zStep,
      geoParams.childCount,
      geoParams.bevelRadius,
      geoParams.bevelSegments,
      style.edgeStyle,
    );

    const material = new THREE.MeshStandardMaterial({
      color: style.baseColor,
      opacity: style.baseOpacity,
      transparent: style.baseOpacity < 1,
      metalness: style.metalness,
      roughness: style.roughness,
      side: THREE.DoubleSide,
    });

    const base = new THREE.Mesh(geometry, material);
    base.name = 'CarouselScrubberBase';
    base.receiveShadow = true;
    base.castShadow = true;

    cache.root.add(base);
    cache.base = base as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    cache.lastGeoKey = geoKey;
  }

  cache.base!.visible = true;
  cache.base!.material.color.set(style.baseColor);
  cache.base!.material.opacity = style.baseOpacity;
  cache.base!.material.metalness = style.metalness;
  cache.base!.material.roughness = style.roughness;

  // Detect style changes (from theme switch or DSL prop change) and force
  // material recompile for render pass re-sorting.
  const styleKey = `${style.baseColor}|${style.baseOpacity}|${style.metalness}|${style.roughness}|${style.edgeStyle}`;
  if (styleKey !== cache.lastStyleKey) {
    cache.base!.material.needsUpdate = true;
    cache.lastStyleKey = styleKey;
  }

  // -- Surface texture (normal map) --
  const wantedPattern = style.surfacePattern;
  const wantedMapUrl = style.surfaceMapUrl;
  const patternChanged = cache.lastSurfacePattern !== wantedPattern;
  const mapUrlChanged = cache.lastSurfaceMapUrl !== wantedMapUrl;

  if (patternChanged || mapUrlChanged || needsRecreate) {
    // Dispose old normal map if we created it (procedural textures are cached
    // globally in surfaceTexture.ts, so we only null out the local reference).
    cache.normalMapTexture = null;
    cache.base!.material.normalMap = null;

    if (wantedMapUrl) {
      // Custom URL: async load
      loadCustomSurfaceMap(wantedMapUrl).then((tex) => {
        if (cache.base && cache.lastSurfaceMapUrl === wantedMapUrl) {
          cache.base.material.normalMap = tex;
          cache.base.material.normalScale.set(style.surfaceIntensity, style.surfaceIntensity);
          cache.base.material.needsUpdate = true;
          cache.normalMapTexture = tex;
        }
      });
    } else {
      // Procedural pattern
      const tex = generateSurfaceNormalMap(wantedPattern);
      cache.normalMapTexture = tex;
      cache.base!.material.normalMap = tex;
      cache.base!.material.needsUpdate = true;
    }

    cache.lastSurfacePattern = wantedPattern;
    cache.lastSurfaceMapUrl = wantedMapUrl;
  }

  // Always update normalScale (intensity may change between frames via theme)
  if (cache.base!.material.normalMap) {
    cache.base!.material.normalScale.set(style.surfaceIntensity, style.surfaceIntensity);
  }

  // -- Transparency safety --
  const transparentNow = style.baseOpacity < 1;
  if (cache.base!.material.transparent !== transparentNow) {
    cache.base!.material.transparent = transparentNow;
    cache.base!.material.needsUpdate = true;
  }
}

/**
 * Adapts an NVSCoordService to the TrayCoordService interface expected by
 * the pure position math module.
 */
function toTrayCoordService(coords: NVSCoordService): TrayCoordService {
  return {
    toWorld: (x, y, z) => coords.toWorld(x, y, z),
    toWorldSize: (w, h) => coords.toWorldSize(w, h),
    visibleWorldHeight: coords.visibleWorldHeight,
  };
}

/**
 * Applies the carousel scrubber state to the Three.js scene.
 * Called each frame by the widget's apply() method.
 *
 * Positioning logic:
 * 1. Converts NVS bounds bottom edge to world Y via coords.toWorld()
 * 2. Positions tray top at that world Y
 * 3. Finds floor Y and positions tray bottom at floor Y + gap
 * 4. Tray depth adapts to fill the space (min: compiled trayDepth)
 *
 * IMPORTANT: state.style values are already theme-resolved at compile time.
 * The viewLayoutHandler in viewHandlers.ts calls resolveSceneTheme() and
 * bakes themed values into CarouselScrubberState.style before it reaches
 * this function. Do NOT add render-time theme resolution here — it would
 * create a stale-reference bug with Object.is equality on theme objects.
 * See the comment in viewHandlers.ts at the CarouselTray detection block.
 */
export function applyCarouselScrubber(
  state: CarouselScrubberState,
  cache: CarouselScrubberCache,
  scene: THREE.Scene,
  coords?: NVSCoordService,
): void {
  if (state.childCount === 0 || state.layoutId === '') {
    cache.root.visible = false;
    return;
  }
  cache.root.visible = true;

  // -- Style: already theme-resolved at compile time ----------------------------
  // The viewLayoutHandler resolves SceneTheme at compilation and bakes themed
  // values into state.style (same pattern as diagrams/charts). No render-time
  // theme resolution needed — the compiled state IS the final style.
  const style = state.style;
  const trayDepth = state.trayDepth;
  const gap = state.gap;

  const zStep = state.zStep;

  // -- Positioning (must run before width computation — effectiveDepth is needed) --
  // Use viewExtent (tight view bounding box) for positioning — NOT nvsBounds (container).
  const viewExtent = state.viewExtent;
  const trayCoords = coords ? toTrayCoordService(coords) : null;
  const floorY = findFloorY(scene);
  const trayPos = trayCoords
    ? computeTrayPosition(viewExtent, zStep, state.loop, trayDepth, gap, trayCoords, floorY)
    : null;

  const effectiveDepth = trayPos?.effectiveDepth ?? trayDepth;

  // -- Width from view extent -------------------------------------------------
  let worldWidth: number;
  let zDepth: number;

  if (trayCoords) {
    worldWidth = computeTrayWorldWidth(viewExtent.w, viewExtent.h, trayCoords);
    zDepth = computeTrayZDepth(state.loop, zStep, worldWidth, state.childCount);
  } else {
    // Fallback: no coord service available.
    worldWidth = 4.0;
    zDepth = 1.5;
  }

  // Ring carousels must be circular (equal axes) so the disc looks correct
  // when rotating around Y. An ellipse wobbles visually because the outline
  // changes shape from the camera's perspective as it turns.
  if (state.loop) {
    const diameter = Math.max(worldWidth, zDepth);
    worldWidth = diameter;
    zDepth = diameter;
  }
  const centerZ = trayPos?.centerZ ?? (state.loop && zStep > 0 ? -zStep / 2 : 0);

  // ExtrudeGeometry bevel extends below local Y=0 by bevelThickness.
  // Offset root Y upward so the geometry's actual bottom sits at bottomY.
  const bevelOffset = computeBevelRadius(effectiveDepth);
  if (trayPos) {
    cache.root.position.set(0, trayPos.bottomY + bevelOffset, centerZ);
  } else {
    cache.root.position.set(0, -0.5 + bevelOffset, centerZ);
  }

  // -- Geometry ---------------------------------------------------------------
  const isRing = state.loop;

  const shapeKind = resolveTrayShapeKind(isRing, zStep);
  const bevelRadius = computeBevelRadius(effectiveDepth);
  const geoParams: TrayGeometryParams = {
    shapeKind,
    worldWidth,
    zDepth,
    trayDepth: effectiveDepth,
    zStep,
    childCount: state.childCount,
    bevelRadius,
    bevelSegments: 5,
  };

  ensureBase(cache, state.showBase, geoParams, style);

  // -- Tray rotation for ring carousels --
  // Smooth-lerp the tray group Y rotation so it tracks the ring carousel
  // with the same fluid feel as ViewWidget's position lerp.
  // Uses shortest-path angular interpolation to handle the 2π wrap-around
  // (e.g., index 5→0 rotates the short way, not almost a full revolution).
  const ROTATION_LERP = 0.12; // matches ViewWidget's LERP_FACTOR
  const ROTATION_SNAP = 0.0005; // radians — snap threshold

  if (state.loop && state.childCount > 0) {
    const targetRotation = computeRingRotation(state.activeIndex, state.childCount);

    if (cache.currentRotation === null) {
      // First frame: snap to target (no animation on mount).
      cache.currentRotation = targetRotation;
    } else {
      // Shortest-path angular delta: wrap difference into (-π, π].
      let delta = targetRotation - cache.currentRotation;
      delta = delta - Math.round(delta / (Math.PI * 2)) * Math.PI * 2;

      if (Math.abs(delta) < ROTATION_SNAP) {
        cache.currentRotation = targetRotation;
      } else {
        cache.currentRotation += delta * ROTATION_LERP;
      }
    }

    cache.root.rotation.y = cache.currentRotation;
  } else {
    cache.root.rotation.y = 0;
    cache.currentRotation = null;
  }
}

/** Disposes all Three.js resources created by the carousel scrubber. */
export function disposeCarouselScrubber(
  scene: THREE.Scene,
  cache: CarouselScrubberCache,
  widgetId: string,
): void {
  if (cache.base) {
    cache.root.remove(cache.base);
    cache.base.geometry.dispose();
    cache.base.material.dispose();
  }
  // Normal map textures from the procedural cache are shared — do not dispose.
  // Custom URL textures are also shared via the URL cache.
  cache.normalMapTexture = null;
  scene.remove(cache.root);
  delete scene.userData[`${CACHE_KEY}_${widgetId}`];
}
