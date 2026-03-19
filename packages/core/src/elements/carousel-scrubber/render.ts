// CarouselScrubber element Three.js renderer.
// Excluded from test coverage — Three.js rendering logic.

import * as THREE from 'three';
import type CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import type {CarouselScrubberState, CarouselScrubberStyle, CarouselTrayEdgeStyle, CarouselTraySurfacePattern, ViewHighlight, ViewHighlightMode} from './types';
import {
  HL_BACKDROP_SCALE,
  HL_BEAM_SCALE,
  HL_BEAM_Z_SQUEEZE,
  HL_DEFAULT_BACKDROP_COLOR_DARK,
  HL_DEFAULT_BACKDROP_COLOR_LIGHT,
  HL_DEFAULT_BACKDROP_OPACITY,
  HL_DEFAULT_BEAM_HEIGHT,
  HL_DUST_OPACITY,
  HL_DUST_PARTICLE_COUNT,
  HL_DUST_POINT_SIZE,
  HL_FADE_LERP,
  HL_GLOW_MODE_SCALE,
  HL_GLOW_SCALE,
  HL_HOLOGRAPHIC_GLOW_FACTOR,
  HL_OPACITY_THRESHOLD,
  HL_POSITION_LERP,
  HL_SMOKE_OPACITY,
  HL_SMOKE_POINT_SIZE,
  HL_Y_OFFSET,
} from './highlightConstants';
import {resolveRuntimeHighlight} from './compileTray';
import type {NVSCoordService} from '../../widget/types';
import type {LoadedMaterialPreset, MaterialLoader, MaterialManifest} from '../../widget/index';
import {applyMaterialApplication, createPresetMaterial} from '../_shared/materialFactory';
import {generateSurfaceNormalMap, loadCustomSurfaceMap} from './surfaceTexture';
import {
  computeBevelRadius,
  computeGeometryKey,
  computeLinearMaxDepth,
  computeParabolicBandWidth,
  computeTrayZDepth,
  generateEllipsePoints,
  generateParabolicPoints,
  resolveTrayShapeKind,
  type TrayGeometryParams,
} from './geometry';
import {computeRingRotation, computeTrayPosition, computeTrayWorldWidth, type TrayCoordService} from './trayPosition';
import {advanceParticle, DEFAULT_PARTICLE_COUNT, initParticle, particleRingPosition, type ParticleState,} from './highlightParticles';

/** Three.js refs for the carousel scrubber renderer. */
export type CarouselScrubberRefs = {
  scene: THREE.Scene;
};

/** Cached meshes for a single view highlight. */
type HighlightMeshSet = {
  group: THREE.Group;
  glowPlane: THREE.Group | null;
  beamMesh: THREE.Mesh | null;
  /** Semi-transparent backdrop behind the beam to dim background content. */
  backdropMesh: THREE.Mesh | null;
  /** Volumetric dust particles filling the beam. */
  dustMesh: THREE.Points | null;
  dustParticles: DustParticle[] | null;
  smokeMesh: THREE.Points | null;
  smokeParticles: ParticleState[] | null;
  currentOpacity: number;
  mode: ViewHighlightMode;
  lastTime: number;
  /** LERP'd position for smooth tracking. null = not yet initialized (snap on first frame). */
  currentX: number | null;
  currentZ: number | null;
};

/** Simple dust mote state for volumetric beam fill. */
type DustParticle = {
  x: number; y: number; z: number;
  driftX: number; driftY: number; driftZ: number;
  age: number; lifetime: number;
  baseOpacity: number;
};

/** Internal cache structure stored on scene.userData. */
export type CarouselScrubberCache = {
  root: THREE.Group;
  base: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null;
  /** Back-fade plane that extends the tray and fades to transparent. */
  fadePlane: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null;
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
  /** Loaded material preset (null = not yet loaded or no preset configured). */
  loadedPreset: LoadedMaterialPreset | null;
  /** The CSM preset material instance (null = using fallback). */
  presetMaterial: CustomShaderMaterial | null;
  /** Set of preset names already warned about (missing from manifest). */
  warnedPresets: Set<string>;
  /** Last surface material name for change detection. */
  lastSurfaceMaterial: string | null;
  /** Per-view highlight mesh groups, keyed by viewId. */
  highlightMeshes: Map<string, HighlightMeshSet>;
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

/** Cached 1D gradient alpha texture — shared across all scrubber instances. */
let _sharedFadeAlphaTexture: THREE.DataTexture | null = null;

/**
 * Creates (or returns cached) a 1px-tall gradient texture for the back-fade
 * alphaMap. The gradient goes from white (alpha=1) at v=0 to black (alpha=0)
 * at v=1, producing a smooth opacity fade along the V axis.
 */
function createFadeAlphaTexture(): THREE.DataTexture {
  if (_sharedFadeAlphaTexture) return _sharedFadeAlphaTexture;
  const width = 1;
  const height = 64;
  const data = new Uint8Array(width * height);
  for (let i = 0; i < height; i++) {
    // Gradient: row 0 = 255 (opaque), row 63 = 0 (transparent)
    const t = i / (height - 1);
    // Ease out: faster initial fade, gentle tail
    const alpha = 1 - t * t;
    data[i] = Math.round(alpha * 255);
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RedFormat);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  _sharedFadeAlphaTexture = tex;
  return tex;
}

/**
 * Creates a flat plane geometry for the back-fade zone behind the tray.
 * The plane lies in the XZ plane (after rotation) extending into -Z.
 * UVs are set so V goes from 0 (front, tray edge) to 1 (far back),
 * which drives the alphaMap fade.
 *
 * @param width  - Tray width in world units.
 * @param depth  - Fade depth (2 * zStep).
 * @param height - Thickness (same as tray depth for visual continuity).
 */
function createBackFadePlane(width: number, depth: number, height: number): THREE.BufferGeometry {
  // Create a box with the same width/height as the tray, extending `depth` into Z.
  const geo = new THREE.BoxGeometry(width, height, depth, 1, 1, 8);

  // Remap UVs on the top face (Y+ side) so V maps to Z-depth (fade direction).
  // The top face normals point +Y. We remap all face UVs but only the top face
  // is visible (facing the camera from above after the tray's rotation).
  const uvAttr = geo.getAttribute('uv');
  const posAttr = geo.getAttribute('position');
  const halfDepth = depth / 2;

  for (let i = 0; i < uvAttr.count; i++) {
    // Map V coordinate from position Z: front of fade (z=+halfDepth) → v=0,
    // back of fade (z=-halfDepth) → v=1.
    const z = posAttr.getZ(i);
    const v = 1 - (z + halfDepth) / depth;
    uvAttr.setY(i, Math.max(0, Math.min(1, v)));
  }
  uvAttr.needsUpdate = true;

  return geo;
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
    const points = generateEllipsePoints(width * 0.5, zDepth * 0.5, 128);
    shape = pointsToThreeShape(points);
  } else if (shapeKind === 'parabolic') {
    const maxDepth = computeLinearMaxDepth(childCount, zStep);
    const bandWidth = computeParabolicBandWidth(zStep, width);
    const points = generateParabolicPoints(width * 0.5, maxDepth, bandWidth, 64);
    shape = pointsToThreeShape(points);
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
    curveSegments: 64,
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
    fadePlane: null,
    lastGeoKey: '',
    lastSurfacePattern: null,
    lastSurfaceMapUrl: null,
    normalMapTexture: null,
    lastStyleKey: '',
    currentRotation: null,
    loadedPreset: null,
    presetMaterial: null,
    warnedPresets: new Set(),
    lastSurfaceMaterial: null,
    highlightMeshes: new Map(),
  };

  scene.userData[key] = cache;
  return cache;
}

/**
 * Resolves a preset material from the manifest and kicks off async loading
 * if the textures haven't been loaded yet.
 */
function resolvePresetMaterial(
  cache: CarouselScrubberCache,
  style: CarouselScrubberStyle,
  materialLoader: MaterialLoader,
  materialManifest: MaterialManifest,
): void {
  const presetName = style.surfaceMaterial;
  if (!presetName) return;

  // Detect preset name change — reset material state.
  if (cache.lastSurfaceMaterial !== presetName) {
    cache.loadedPreset = null;
    cache.presetMaterial = null;
    cache.lastSurfaceMaterial = presetName;
  }

  // Lookup preset in manifest.
  const preset = materialManifest.presets[presetName];
  if (!preset) {
    // Warn once per unknown preset name per widget instance.
    if (!cache.warnedPresets.has(presetName)) {
      console.warn(
        `[CarouselScrubber] Material preset '${presetName}' not found in manifest. Falling back to base color.`,
      );
      cache.warnedPresets.add(presetName);
    }
    return;
  }

  // Don't retry presets that have permanently failed to load.
  if (materialLoader.isPresetFailed(preset, materialManifest.basePath)) return;

  // Check sync cache hit first.
  const alreadyLoaded = materialLoader.getLoadedPresetByKey(preset, materialManifest.basePath);
  if (alreadyLoaded && !cache.loadedPreset) {
    cache.loadedPreset = alreadyLoaded;
  }

  // Kick off async load if not yet loaded.
  if (!cache.loadedPreset) {
    materialLoader.loadPreset(preset, materialManifest.basePath).then((loaded) => {
      if (!loaded) return; // Load failed — MaterialLoader already logged the warning.
      cache.loadedPreset = loaded;
      // Invalidate preset material so it gets recreated with textures.
      cache.presetMaterial = null;
    });
  }
}

/** Ensures the base mesh is correct for the current shape/size/visibility. */
function ensureBase(
  cache: CarouselScrubberCache,
  showBase: boolean,
  geoParams: TrayGeometryParams,
  style: CarouselScrubberStyle,
  materialLoader?: MaterialLoader,
  materialManifest?: MaterialManifest,
): void {
  if (!showBase) {
    if (cache.base) cache.base.visible = false;
    if (cache.fadePlane) cache.fadePlane.visible = false;
    return;
  }

  // -- Preset material resolution (async, non-blocking) --
  const usePreset = style.surfaceMaterial !== null && materialLoader !== undefined && materialManifest !== undefined;
  if (usePreset) {
    resolvePresetMaterial(cache, style, materialLoader, materialManifest);
  }

  const geoKey = computeGeometryKey(geoParams);
  const needsRecreate = !cache.base || cache.lastGeoKey !== geoKey;

  if (needsRecreate) {
    if (cache.base) {
      cache.root.remove(cache.base);
      cache.base.geometry.dispose();
      cache.base.material.dispose();
    }
    // Reset preset material when geometry changes — it's tied to the old mesh.
    cache.presetMaterial = null;

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

    // Start with a plain MeshStandardMaterial. If a preset is loaded, it will
    // be swapped to a CSM material below (or on the next frame once loaded).
    const material = new THREE.MeshStandardMaterial({
      color: style.baseColor,
      opacity: style.baseOpacity,
      transparent: style.baseOpacity < 1,
      metalness: style.metalness,
      roughness: style.roughness,
      side: THREE.FrontSide,
    });

    const base = new THREE.Mesh(geometry, material);
    base.name = 'CarouselScrubberBase';
    base.receiveShadow = true;
    base.castShadow = true;

    cache.root.add(base);
    cache.base = base;
    cache.lastGeoKey = geoKey;

    // ── Back-fade plane ──
    // Extends from the back edge of the tray further into -Z (away from camera)
    // fading to transparent over 2 zSteps. Only for parabolic (linear) trays.
    if (cache.fadePlane) {
      cache.root.remove(cache.fadePlane);
      cache.fadePlane.geometry.dispose();
      cache.fadePlane.material.dispose();
      cache.fadePlane = null;
    }
    if (geoParams.shapeKind === 'parabolic' && geoParams.zStep > 0) {
      const fadeDepth = geoParams.zStep * 2;
      const fadeGeo = createBackFadePlane(geoParams.worldWidth, fadeDepth, geoParams.trayDepth);
      const fadeMat = new THREE.MeshStandardMaterial({
        color: style.baseColor,
        transparent: true,
        opacity: style.baseOpacity * 0.7,
        metalness: style.metalness,
        roughness: style.roughness,
        side: THREE.FrontSide,
        alphaMap: createFadeAlphaTexture(),
        depthWrite: false,
      });
      const fadeMesh = new THREE.Mesh(fadeGeo, fadeMat);
      fadeMesh.name = 'CarouselScrubberBackFade';
      fadeMesh.receiveShadow = true;

      // Position: align fade plane's front face with the tray's back edge.
      // After -π/2 X rotation, the tray's back edge (shape y = maxDepth + frontOffset)
      // maps to world z = -(maxDepth + frontOffset) in root-local space.
      const maxDepth = computeLinearMaxDepth(geoParams.childCount, geoParams.zStep);
      const fadeBandWidth = computeParabolicBandWidth(geoParams.zStep, geoParams.worldWidth);
      const fadeFrontOffset = fadeBandWidth * 0.5;
      const backEdgeZ = -(maxDepth + fadeFrontOffset);
      fadeMesh.position.set(0, 0, backEdgeZ - fadeDepth / 2);

      cache.fadePlane = fadeMesh;
      cache.root.add(fadeMesh);
    }
  }

  cache.base!.visible = true;
  if (cache.fadePlane) cache.fadePlane.visible = true;

  // -- Material update: preset CSM or procedural fallback --
  if (usePreset && cache.loadedPreset) {
    // Create or update the CSM preset material.
    if (!cache.presetMaterial) {
      const csm = createPresetMaterial({
        textures: cache.loadedPreset.textures,
        defaults: cache.loadedPreset.defaults,
        projection: 'triplanar',
        application: style.materialApplication,
        baseColor: style.baseColor,
        baseOpacity: style.baseOpacity,
        metalness: style.metalness,
        roughness: style.roughness,
      });
      cache.presetMaterial = csm;
      cache.base!.material.dispose();
      cache.base!.material = csm as unknown as THREE.MeshStandardMaterial;
    }

    // Per-frame uniform updates (animatable MaterialApplication controls).
    applyMaterialApplication(cache.presetMaterial, style.materialApplication, style.baseColor);
  } else if (!usePreset || !cache.loadedPreset) {
    // Procedural fallback path: no preset, or preset not yet loaded.
    // Update base material properties every frame.
    cache.base!.material.color.set(style.baseColor);
    cache.base!.material.metalness = style.metalness;
    cache.base!.material.roughness = style.roughness;

    // Sync fade plane material with base style.
    if (cache.fadePlane) {
      cache.fadePlane.material.color.set(style.baseColor);
      cache.fadePlane.material.metalness = style.metalness;
      cache.fadePlane.material.roughness = style.roughness;
      cache.fadePlane.material.opacity = style.baseOpacity * 0.7;
    }

    // Detect style changes and force material recompile for render pass re-sorting.
    const styleKey = `${style.baseColor}|${style.baseOpacity}|${style.metalness}|${style.roughness}|${style.edgeStyle}`;
    if (styleKey !== cache.lastStyleKey) {
      cache.base!.material.needsUpdate = true;
      if (cache.fadePlane) cache.fadePlane.material.needsUpdate = true;
      cache.lastStyleKey = styleKey;
    }

    // -- Surface texture (normal map) — procedural fallback only --
    if (!usePreset) {
      const wantedPattern = style.surfacePattern;
      const wantedMapUrl = style.surfaceMapUrl;
      const patternChanged = cache.lastSurfacePattern !== wantedPattern;
      const mapUrlChanged = cache.lastSurfaceMapUrl !== wantedMapUrl;

      if (patternChanged || mapUrlChanged || needsRecreate) {
        cache.normalMapTexture = null;
        cache.base!.material.normalMap = null;

        if (wantedMapUrl) {
          loadCustomSurfaceMap(wantedMapUrl).then((tex) => {
            if (cache.base && cache.lastSurfaceMapUrl === wantedMapUrl) {
              cache.base.material.normalMap = tex;
              cache.base.material.normalScale.set(style.surfaceIntensity, style.surfaceIntensity);
              cache.base.material.needsUpdate = true;
              cache.normalMapTexture = tex;
            }
          });
        } else {
          const tex = generateSurfaceNormalMap(wantedPattern);
          cache.normalMapTexture = tex;
          cache.base!.material.normalMap = tex;
          cache.base!.material.needsUpdate = true;
        }

        cache.lastSurfacePattern = wantedPattern;
        cache.lastSurfaceMapUrl = wantedMapUrl;
      }

      if (cache.base!.material.normalMap) {
        cache.base!.material.normalScale.set(style.surfaceIntensity, style.surfaceIntensity);
      }
    }
  }

  // Opacity and transparency always apply.
  cache.base!.material.opacity = style.baseOpacity;
  const transparentNow = style.baseOpacity < 1;
  if (cache.base!.material.transparent !== transparentNow) {
    cache.base!.material.transparent = transparentNow;
    cache.base!.material.needsUpdate = true;
  }
}

// Highlight constants imported from types.ts — single source of truth.

/** Resolves a highlight blendMode string to the Three.js blending constant. */
function resolveBlending(mode: 'additive' | 'normal'): THREE.Blending {
  return mode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending;
}

/**
 * Creates a soft radial gradient canvas texture for glow highlights.
 * Bright center, transparent edges.
 */
function createGlowTexture(_color: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx2d = canvas.getContext('2d')!;

  const gradient = ctx2d.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  // Gentle gradient — even brightness with soft edge fade
  gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(0.85, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx2d.fillStyle = gradient;
  ctx2d.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a soft circle canvas texture for smoke particles.
 */
function createSoftCircleTexture(): THREE.CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx2d = canvas.getContext('2d')!;

  const gradient = ctx2d.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx2d.fillStyle = gradient;
  ctx2d.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a glow group with stacked additive planes for visible glow
 * against both dark and light/textured surfaces.
 *
 * Three layers:
 * 1. Large soft outer glow (1.4× size, low opacity) — ambient halo
 * 2. Medium core glow (1.0× size, full opacity) — main highlight
 * 3. Small bright hot center (0.5× size, high opacity) — focal point
 *
 * All use AdditiveBlending so they compound on each other.
 */
function createGlowPlane(
  worldW: number,
  worldH: number,
  color: string,
  intensity: number,
  blendMode: 'additive' | 'normal' = 'additive',
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HighlightGlow';

  const texture = createGlowTexture(color);
  const blend = resolveBlending(blendMode);

  // Single glow plane — no stacking, no rings
  const geo = new THREE.PlaneGeometry(worldW, worldH);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color,
    map: texture,
    transparent: true,
    opacity: intensity,
    blending: blend,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);

  return group;
}

/**
 * Creates a vertical gradient canvas texture for the beam — bright at bottom, fading to top.
 */
function createBeamGradientTexture(_color: string): THREE.CanvasTexture {
  const w = 1;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx2d = canvas.getContext('2d')!;

  // Gradient from bottom (bright) to top (transparent)
  const gradient = ctx2d.createLinearGradient(0, h, 0, 0);
  gradient.addColorStop(0, 'rgba(255,255,255,1.0)');
  gradient.addColorStop(0.15, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.3)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.08)');
  gradient.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx2d.fillStyle = gradient;
  ctx2d.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a holographic beam cylinder mesh.
 * Uses MeshBasicMaterial with a vertical gradient texture for reliable
 * additive-blended visibility across all lighting conditions.
 */
function createBeamMesh(
  radius: number,
  beamHeight: number,
  color: string,
  _intensity: number,
  blendMode: 'additive' | 'normal' = 'additive',
): THREE.Mesh {
  // Gentle taper — mostly cylindrical, slightly narrower at top
  const geometry = new THREE.CylinderGeometry(radius, radius, beamHeight, 64, 1, true);
  // Move origin to base of cylinder so Y=0 is the base (sits on tray surface)
  geometry.translate(0, beamHeight / 2, 0);

  const texture = createBeamGradientTexture(color);
  const material = new THREE.MeshBasicMaterial({
    color,
    map: texture,
    transparent: true,
    opacity: 1.0,
    blending: resolveBlending(blendMode),
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'HighlightBeam';
  return mesh;
}

/**
 * Creates a semi-transparent backdrop cylinder just outside the beam.
 * Uses BackSide rendering so it only dims what's seen THROUGH it from outside —
 * neighboring views behind/beside the highlighted one. The highlighted chart
 * inside the beam is unaffected because you're looking at its front faces.
 *
 * Tightly hugs the beam (1.05× scale) so it reads as the beam's edge
 * rather than a separate shape.
 */
/**
 * Creates a vertical alpha gradient texture for the backdrop.
 * Opaque at bottom (UV.y=0), transparent at top (UV.y=1).
 */
function createBackdropGradientTexture(color: string): THREE.CanvasTexture {
  const w = 1;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx2d = canvas.getContext('2d')!;

  // CylinderGeometry UV.y: 0 = bottom, 1 = top.
  // Canvas Y: 0 = top of canvas, h = bottom of canvas.
  // So canvas top (y=0) = UV.y=1 (cylinder top) = transparent.
  // Canvas bottom (y=h) = UV.y=0 (cylinder bottom) = opaque.
  //
  // Hold full opacity from base to 80% height, then fade to transparent.
  // Canvas stops: 0.0 = cylinder top, 1.0 = cylinder bottom.
  // 80% height = 20% from top in canvas space = stop 0.2.
  const gradient = ctx2d.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');       // cylinder top: transparent
  gradient.addColorStop(0.1, `${color}22`);         // 90% height: nearly gone
  gradient.addColorStop(0.2, `${color}FF`);         // 80% height: full
  gradient.addColorStop(1.0, `${color}FF`);         // cylinder base: full
  ctx2d.fillStyle = gradient;
  ctx2d.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createBackdropMesh(
  beamHeight: number,
  backdropOpacity: number,
  blendMode: 'additive' | 'normal' = 'additive',
  backdropColor?: string,
): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(1.0, 1.0, beamHeight, 64, 1, true);
  geometry.translate(0, beamHeight / 2, 0);

  const resolvedColor = backdropColor ?? (blendMode === 'normal' ? HL_DEFAULT_BACKDROP_COLOR_LIGHT : HL_DEFAULT_BACKDROP_COLOR_DARK);
  const texture = createBackdropGradientTexture(resolvedColor);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: backdropOpacity,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'HighlightBackdrop';
  return mesh;
}

// Dust particle count from HL_DUST_PARTICLE_COUNT in types.ts.

/** Initializes a dust mote at a random position inside the beam volume. */
function initDustParticle(radiusX: number, radiusZ: number, beamHeight: number): DustParticle {
  // Random position inside an elliptical cylinder
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()); // sqrt for uniform distribution in disc
  return {
    x: Math.cos(angle) * r * radiusX,
    y: Math.random() * beamHeight,
    z: Math.sin(angle) * r * radiusZ,
    driftX: (Math.random() - 0.5) * 0.06,
    driftY: 0.05 + Math.random() * 0.15, // upward drift
    driftZ: (Math.random() - 0.5) * 0.06,
    age: Math.random() * 4.0, // stagger
    lifetime: 2.0 + Math.random() * 3.0,
    baseOpacity: 0.2 + Math.random() * 0.5,
  };
}

/**
 * Creates volumetric dust particles that fill the beam volume.
 * Motes drift slowly upward with slight horizontal wander,
 * simulating dust caught in a light beam.
 */
function createDustMesh(
  radiusX: number,
  radiusZ: number,
  beamHeight: number,
  color: string,
  blendMode: 'additive' | 'normal' = 'additive',
): { points: THREE.Points; particles: DustParticle[] } {
  const particles: DustParticle[] = [];
  const positions = new Float32Array(HL_DUST_PARTICLE_COUNT * 3);

  for (let i = 0; i < HL_DUST_PARTICLE_COUNT; i++) {
    const p = initDustParticle(radiusX, radiusZ, beamHeight);
    particles.push(p);
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const texture = createSoftCircleTexture();
  const material = new THREE.PointsMaterial({
    size: HL_DUST_POINT_SIZE,
    map: texture,
    transparent: true,
    blending: resolveBlending(blendMode),
    depthWrite: false,
    color,
    opacity: HL_DUST_OPACITY,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'HighlightDust';
  return {points, particles};
}

/** Advances dust particles — drift upward, recycle at top or end of life. */
function updateDustParticles(
  meshSet: HighlightMeshSet,
  radiusX: number,
  radiusZ: number,
  beamHeight: number,
  dt: number,
): void {
  if (!meshSet.dustMesh || !meshSet.dustParticles) return;

  const posAttr = meshSet.dustMesh.geometry.getAttribute('position');
  const particles = meshSet.dustParticles;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.driftX * dt;
    p.y += p.driftY * dt;
    p.z += p.driftZ * dt;
    p.age += dt;

    // Recycle if above beam or past lifetime
    if (p.y > beamHeight || p.age > p.lifetime) {
      const newP = initDustParticle(radiusX, radiusZ, beamHeight);
      newP.y = 0; // start at base
      particles[i] = newP;
      posAttr.setXYZ(i, newP.x, newP.y, newP.z);
    } else {
      posAttr.setXYZ(i, p.x, p.y, p.z);
    }
  }

  posAttr.needsUpdate = true;
}

/**
 * Creates the smoke ring Points mesh for holographic highlights.
 */
function createSmokeMesh(
  radius: number,
  color: string,
  particleCount: number,
  blendMode: 'additive' | 'normal' = 'additive',
): { points: THREE.Points; particles: ParticleState[] } {
  const particles: ParticleState[] = [];
  const positions = new Float32Array(particleCount * 3);
  const opacities = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const p = initParticle(Math.random);
    particles.push(p);
    const [x, z] = particleRingPosition(p.angle, radius * 0.7);
    positions[i * 3] = x;
    positions[i * 3 + 1] = p.yOffset;
    positions[i * 3 + 2] = z;
    opacities[i] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

  const texture = createSoftCircleTexture();
  const material = new THREE.PointsMaterial({
    size: HL_SMOKE_POINT_SIZE,
    map: texture,
    transparent: true,
    blending: resolveBlending(blendMode),
    depthWrite: false,
    color,
    opacity: HL_SMOKE_OPACITY,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'HighlightSmoke';
  return {points, particles};
}

/**
 * Updates smoke particle positions and opacities each frame.
 */
/**
 * Updates smoke particle positions each frame.
 * Particles wander randomly within the beam's elliptical XZ boundary
 * while drifting upward. Uses the angle from advanceParticle for orbital
 * motion combined with a random radial offset for natural dispersion.
 */
function updateSmokeParticles(
  meshSet: HighlightMeshSet,
  radiusX: number,
  radiusZ: number,
  beamHeight: number,
  dt: number,
): void {
  if (!meshSet.smokeMesh || !meshSet.smokeParticles) return;

  const posAttr = meshSet.smokeMesh.geometry.getAttribute('position');
  const particles = meshSet.smokeParticles;

  for (let i = 0; i < particles.length; i++) {
    particles[i] = advanceParticle(particles[i], dt, Math.random);
    const p = particles[i];

    // Compute XZ from orbital angle with random radial variation.
    // Each particle gets a unique radial factor based on its index
    // so they spread across the disc rather than clustering on the ring.
    const radialFactor = 0.2 + ((i * 7 + 3) % 10) / 10 * 0.8; // 0.2–1.0, deterministic per particle
    const wanderX = Math.sin(p.age * 0.5 + i) * radiusX * 0.15; // slow lateral wander
    const wanderZ = Math.cos(p.age * 0.7 + i * 1.3) * radiusZ * 0.15;

    const x = Math.cos(p.angle) * radiusX * radialFactor + wanderX;
    const z = Math.sin(p.angle) * radiusZ * radialFactor + wanderZ;

    // Clamp to ellipse boundary
    const normDist = (x * x) / (radiusX * radiusX) + (z * z) / (radiusZ * radiusZ);
    const clampFactor = normDist > 1 ? 1 / Math.sqrt(normDist) : 1;

    // Y wraps around beam height
    const y = p.yOffset % beamHeight;

    posAttr.setXYZ(i, x * clampFactor, y, z * clampFactor);
  }

  posAttr.needsUpdate = true;
}

/** Disposes all meshes inside a glow group (stacked additive planes). */
function disposeGlowGroup(glowGroup: THREE.Group): void {
  for (const child of glowGroup.children) {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mat = child.material as THREE.MeshBasicMaterial;
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
  }
}

/** Updates opacity on all meshes in a glow group. */
function updateGlowGroupOpacity(glowGroup: THREE.Group, opacity: number): void {
  for (const child of glowGroup.children) {
    if (child instanceof THREE.Mesh) {
      const mat = child.material as THREE.MeshBasicMaterial;
      // Scale each layer's opacity relative to its original ratio.
      // The layers were created with different base opacities — preserve the ratios.
      mat.opacity = opacity;
    }
  }
}

/** Disposes and removes a single Mesh or Points from its parent. */
function disposeMesh3D(obj: THREE.Mesh | THREE.Points): void {
  obj.geometry.dispose();
  const mat = obj.material as THREE.MeshBasicMaterial | THREE.PointsMaterial;
  if ('map' in mat && mat.map) mat.map.dispose();
  mat.dispose();
  obj.parent?.remove(obj);
}

/**
 * Tears down all child meshes in a HighlightMeshSet, resetting them to null.
 * The containing group is kept alive for reuse. Call this before rebuilding
 * meshes for a mode change.
 */
function clearHighlightMeshes(meshSet: HighlightMeshSet): void {
  if (meshSet.glowPlane) {
    disposeGlowGroup(meshSet.glowPlane);
    meshSet.group.remove(meshSet.glowPlane);
    meshSet.glowPlane = null;
  }
  if (meshSet.beamMesh) {
    disposeMesh3D(meshSet.beamMesh);
    meshSet.beamMesh = null;
  }
  if (meshSet.backdropMesh) {
    disposeMesh3D(meshSet.backdropMesh);
    meshSet.backdropMesh = null;
  }
  if (meshSet.dustMesh) {
    disposeMesh3D(meshSet.dustMesh);
    meshSet.dustMesh = null;
    meshSet.dustParticles = null;
  }
  if (meshSet.smokeMesh) {
    disposeMesh3D(meshSet.smokeMesh);
    meshSet.smokeMesh = null;
    meshSet.smokeParticles = null;
  }
}

/**
 * Disposes all Three.js resources in a HighlightMeshSet and removes its
 * group from the scene graph.
 */
function disposeHighlightMeshSet(meshSet: HighlightMeshSet): void {
  clearHighlightMeshes(meshSet);
  meshSet.group.parent?.remove(meshSet.group);
}

/**
 * Applies per-view highlight effects above the carousel tray.
 * Called at the end of applyCarouselScrubber() each frame.
 *
 * Highlights are parented to the scene (not the tray root) and positioned
 * at the layout container center — where the active view always sits.
 * The layout resolver always places the active view at the center of
 * the container bounds, so the highlight stays locked to the active view
 * regardless of which index is active.
 */
function applyViewHighlights(
  highlights: readonly ViewHighlight[],
  cache: CarouselScrubberCache,
  scene: THREE.Scene,
  trayTopY: number,
  coords: NVSCoordService,
  nvsBounds: { x: number; y: number; w: number; h: number },
  registry: import('../../widget/WidgetRegistry').WidgetRegistry | null,
): void {
  const now = Date.now();
  const activeViewIds = new Set<string>();

  // The active view is always centered in the layout container.
  const containerCenterX = nvsBounds.x + nvsBounds.w / 2;
  const containerCenterY = nvsBounds.y + nvsBounds.h / 2;
  const [activeCenterWorldX] = coords.toWorld(containerCenterX, containerCenterY, 0);

  for (let hlIdx = 0; hlIdx < highlights.length; hlIdx++) {
    const hl = highlights[hlIdx];
    activeViewIds.add(hl.viewId);

    let meshSet = cache.highlightMeshes.get(hl.viewId);

    // Resolve world position:
    // - followView: look up the view's live ViewState from the current tick
    //   to get NVS bounds (X position) and Z offset. The view moves along
    //   the ring ellipse as activeIndex changes; the tick state reflects this.
    // - default: use the container center (active view is always there)
    let worldX = 0;
    let worldZ = 0;
    let worldW = 0;
    let worldH = 0;

    if (hl.followView && hl.mode !== 'none' && registry) {
      // Read the ViewWidget's live world center directly.
      // ViewWidget.currentWorldCenter is updated each frame in apply()
      // with the NVS-to-world conversion of the current layout bounds.
      const viewWidget = registry.get(hl.viewId) as
        { currentWorldCenter?: { x: number; y: number; z: number } } | undefined;
      if (viewWidget?.currentWorldCenter) {
        worldX = viewWidget.currentWorldCenter.x;
        worldZ = viewWidget.currentWorldCenter.z;
      } else {
        worldX = activeCenterWorldX;
      }
      [worldW, worldH] = coords.toWorldSize(hl.bounds.w, hl.bounds.h);
    } else {
      worldX = hl.mode !== 'none' ? activeCenterWorldX : 0;
      [worldW, worldH] = coords.toWorldSize(hl.bounds.w, hl.bounds.h);
    }

    const targetOpacity = hl.mode !== 'none' ? hl.intensity : 0;

    if (!meshSet) {
      // Create new mesh set — parented to the scene, not the tray root,
      // so highlights don't rotate with the disc on ring carousels.
      const group = new THREE.Group();
      group.name = `Highlight_${hl.viewId}`;
      scene.add(group);

      meshSet = {
        group,
        glowPlane: null,
        beamMesh: null,
        backdropMesh: null,
        dustMesh: null,
        dustParticles: null,
        smokeMesh: null,
        smokeParticles: null,
        currentOpacity: 0,
        mode: 'none',
        lastTime: now,
        currentX: null,
        currentZ: null,
      };
      cache.highlightMeshes.set(hl.viewId, meshSet);
    }

    const dt = Math.min((now - meshSet.lastTime) / 1000, 0.1); // cap at 100ms
    meshSet.lastTime = now;

    // Mode change: tear down old meshes, create new ones
    if (meshSet.mode !== hl.mode) {
      clearHighlightMeshes(meshSet);

      const blend = hl.blendMode;

      if (hl.mode === 'glow') {
        meshSet.glowPlane = createGlowPlane(worldW * HL_GLOW_MODE_SCALE, worldH * HL_GLOW_MODE_SCALE, hl.color, hl.intensity, blend);
        meshSet.group.add(meshSet.glowPlane);
      } else if (hl.mode === 'holographic') {
        const unitRadius = 1.0;
        const beamHeight = hl.beamHeight ?? HL_DEFAULT_BEAM_HEIGHT;
        const scaleX = worldW * HL_BEAM_SCALE;
        const scaleZ = worldH * HL_BEAM_SCALE * HL_BEAM_Z_SQUEEZE;

        // Beam cylinder — elliptical
        meshSet.beamMesh = createBeamMesh(unitRadius, beamHeight, hl.color, hl.intensity, blend);
        meshSet.beamMesh.scale.set(scaleX, 1, scaleZ);
        meshSet.group.add(meshSet.beamMesh);

        // Backdrop — cylinder matching beam, dims neighbors
        const bdOpacity = hl.backdropOpacity ?? HL_DEFAULT_BACKDROP_OPACITY;
        if (bdOpacity > 0) {
          meshSet.backdropMesh = createBackdropMesh(beamHeight, bdOpacity, blend, hl.backdropColor);
          meshSet.backdropMesh.scale.set(scaleX * HL_BACKDROP_SCALE, 1, scaleZ * HL_BACKDROP_SCALE);
          meshSet.group.add(meshSet.backdropMesh);
        }

        // Surface glow
        meshSet.glowPlane = createGlowPlane(worldW * HL_GLOW_SCALE, worldH * HL_GLOW_SCALE * HL_BEAM_Z_SQUEEZE, hl.color, hl.intensity * HL_HOLOGRAPHIC_GLOW_FACTOR, blend);
        meshSet.group.add(meshSet.glowPlane);

        // Volumetric dust motes — optional
        if (hl.dust) {
          const {points: dustPts, particles: dustParts} = createDustMesh(
            scaleX, scaleZ, beamHeight, hl.color, blend,
          );
          meshSet.dustMesh = dustPts;
          meshSet.dustParticles = dustParts;
          meshSet.group.add(dustPts);
        }

        // Optional base smoke ring
        if (hl.smoke) {
          const smokeRadius = Math.max(worldW, worldH) * 0.45;
          const {points, particles} = createSmokeMesh(smokeRadius, hl.color, DEFAULT_PARTICLE_COUNT, blend);
          meshSet.smokeMesh = points;
          meshSet.smokeParticles = particles;
          meshSet.group.add(points);
        }
      }

      meshSet.mode = hl.mode;
    }

    // Position the highlight group in the tray root's local space.
    // trayTopY is in world space, but the group is a child of cache.root
    // which is already offset by root.position.y.
    // Smooth-lerp position to match the ViewWidget's LERP animation (0.12).
    // First frame snaps to target; subsequent frames lerp for fluid tracking.
    const POSITION_LERP = HL_POSITION_LERP;
    const zAdj = hl.zOffset ?? 0;
    const targetX = worldX;
    const targetZ = worldZ + zAdj;

    if (meshSet.currentX === null || meshSet.currentZ === null) {
      meshSet.currentX = targetX;
      meshSet.currentZ = targetZ;
    } else {
      meshSet.currentX += (targetX - meshSet.currentX) * POSITION_LERP;
      meshSet.currentZ += (targetZ - meshSet.currentZ) * POSITION_LERP;
    }

    // Position above the tray surface. trayTopY is the world Y of the tray's
    // logical top edge. Add enough offset to clear the bevel and sit visibly
    // above the tray geometry.
    meshSet.group.position.set(meshSet.currentX, trayTopY + HL_Y_OFFSET, meshSet.currentZ);

    // Pulse modulation: cosine wave that breathes the intensity between
    // `hl.intensity` (peak) and `hl.intensity * (1 - pulseIntensity)` (trough).
    // Uses wall-clock seconds so the pulse runs at real-time speed regardless
    // of scroll progress. pulseSpeed=0 or absent → pulseFactor stays 1.
    let pulseFactor = 1;
    const pulseSpeed = hl.pulseSpeed ?? 0;
    const pulseIntensity = hl.pulseIntensity ?? 0;
    if (pulseSpeed > 0 && pulseIntensity > 0) {
      const wallSeconds = now / 1000;
      // Cosine oscillation: 1 at t=0, 0 at t=period/2, 1 at t=period
      const oscillation = (1 + Math.cos((wallSeconds / pulseSpeed) * Math.PI * 2)) * 0.5;
      pulseFactor = 1 - pulseIntensity * (1 - oscillation);
    }

    // Fade transition toward target opacity (capped to authored intensity * pulseFactor)
    const pulsedTarget = targetOpacity * pulseFactor;
    meshSet.currentOpacity += (pulsedTarget - meshSet.currentOpacity) * HL_FADE_LERP;
    if (Math.abs(meshSet.currentOpacity - pulsedTarget) < HL_OPACITY_THRESHOLD) {
      meshSet.currentOpacity = pulsedTarget;
    }

    const visible = meshSet.currentOpacity > HL_OPACITY_THRESHOLD;
    meshSet.group.visible = visible;

    if (!visible) continue;

    // Update glow opacity — apply the holographic glow factor for holographic mode
    if (meshSet.glowPlane) {
      const glowFactor = hl.mode === 'holographic' ? HL_HOLOGRAPHIC_GLOW_FACTOR : 1.0;
      const glowFade = meshSet.currentOpacity / Math.max(hl.intensity * pulseFactor, 0.01);
      updateGlowGroupOpacity(meshSet.glowPlane, glowFade * hl.intensity * pulseFactor * glowFactor);
    }

    // Update beam opacity
    if (meshSet.beamMesh) {
      (meshSet.beamMesh.material as THREE.MeshBasicMaterial).opacity = meshSet.currentOpacity;
    }

    // Update backdrop opacity — scale by the fade transition
    if (meshSet.backdropMesh) {
      const bdTarget = hl.backdropOpacity ?? HL_DEFAULT_BACKDROP_OPACITY;
      (meshSet.backdropMesh.material as THREE.MeshBasicMaterial).opacity =
        (meshSet.currentOpacity / Math.max(hl.intensity * pulseFactor, 0.01)) * bdTarget;
    }

    // Update volumetric dust
    if (meshSet.dustMesh && meshSet.dustParticles) {
      const scaleX = worldW * HL_BEAM_SCALE;
      const scaleZ = worldH * HL_BEAM_SCALE * HL_BEAM_Z_SQUEEZE;
      const beamH = hl.beamHeight ?? HL_DEFAULT_BEAM_HEIGHT;
      updateDustParticles(meshSet, scaleX, scaleZ, beamH, dt);
      // Scale opacity by fade transition. HL_DUST_OPACITY is the target; currentOpacity/intensity normalizes the fade.
      const dustFade = meshSet.currentOpacity / Math.max(hl.intensity * pulseFactor, 0.01);
      (meshSet.dustMesh.material as THREE.PointsMaterial).opacity = dustFade * HL_DUST_OPACITY;
    }

    // Update smoke ring particles
    if (meshSet.smokeMesh && meshSet.smokeParticles) {
      const smokeRX = worldW * HL_BEAM_SCALE;
      const smokeRZ = worldH * HL_BEAM_SCALE * HL_BEAM_Z_SQUEEZE;
      const smokeH = hl.beamHeight ?? HL_DEFAULT_BEAM_HEIGHT;
      updateSmokeParticles(meshSet, smokeRX, smokeRZ, smokeH, dt);
      const smokeFade = meshSet.currentOpacity / Math.max(hl.intensity * pulseFactor, 0.01);
      (meshSet.smokeMesh.material as THREE.PointsMaterial).opacity = smokeFade * HL_SMOKE_OPACITY;
    }
  }

  // Remove highlight meshes for views no longer in the highlight list
  for (const [viewId, meshSet] of cache.highlightMeshes) {
    if (!activeViewIds.has(viewId)) {
      disposeHighlightMeshSet(meshSet);
      cache.highlightMeshes.delete(viewId);
    }
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
  materialLoader?: MaterialLoader,
  materialManifest?: MaterialManifest,
  _tickWidgetStates?: Record<string, unknown> | null,
  runtimeHighlights?: ReadonlyMap<string, import('./types').ViewHighlightConfig> | null,
  runtimeRegistry?: import('../../widget/WidgetRegistry').WidgetRegistry | null,
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

  // Outer margin: author-controlled NVS border beyond the view extent.
  // Converts NVS to world units and adds uniformly to all edges.
  if (trayCoords && state.outerMargin > 0) {
    const [marginWorld] = trayCoords.toWorldSize(state.outerMargin, 0);
    worldWidth += marginWorld * 2;
    zDepth += marginWorld * 2;
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
    bevelSegments: 12,
  };

  ensureBase(cache, state.showBase, geoParams, style, materialLoader, materialManifest);

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
      cache.currentRotation = targetRotation;
    } else {
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

  // -- View highlights ---------------------------------------------------------
  // Merge compiled highlights with runtime (programmatic) highlights.
  // Runtime highlights override compiled ones for the same viewId.
  let mergedHighlights = state.viewHighlights;
  if (runtimeHighlights && runtimeHighlights.size > 0) {
    const merged = [...state.viewHighlights];
    for (const [viewId, cfg] of runtimeHighlights) {
      const existingIdx = merged.findIndex(h => h.viewId === viewId);
      const fallbackBounds = existingIdx >= 0 ? merged[existingIdx].bounds : {x: 0, y: 0, w: 0, h: 0};
      const rtHighlight = resolveRuntimeHighlight(cfg, fallbackBounds, state.style.accentColor);
      if (existingIdx >= 0) {
        merged[existingIdx] = rtHighlight;
      } else {
        merged.push(rtHighlight);
      }
    }
    mergedHighlights = merged;
  }

  const hasHighlights = mergedHighlights.some(h => h.mode !== 'none');
  if (coords && hasHighlights) {
    const highlightTopY = trayPos ? trayPos.topY : 0;
    applyViewHighlights(mergedHighlights, cache, scene, highlightTopY, coords, state.nvsBounds, runtimeRegistry ?? null);
  } else if (cache.highlightMeshes.size > 0) {
    // Clean up highlights when none are active
    for (const [, meshSet] of cache.highlightMeshes) {
      disposeHighlightMeshSet(meshSet);
    }
    cache.highlightMeshes.clear();
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
  if (cache.fadePlane) {
    cache.root.remove(cache.fadePlane);
    cache.fadePlane.geometry.dispose();
    cache.fadePlane.material.dispose();
    cache.fadePlane = null;
  }
  if (cache.presetMaterial) {
    cache.presetMaterial.dispose();
    cache.presetMaterial = null;
  }
  // Normal map textures from the procedural cache are shared — do not dispose.
  // Custom URL textures are also shared via the URL cache.
  // LoadedMaterialPreset textures are owned by MaterialLoader — do not dispose here.
  cache.normalMapTexture = null;
  cache.loadedPreset = null;
  // Dispose all highlight meshes.
  for (const [, meshSet] of cache.highlightMeshes) {
    disposeHighlightMeshSet(meshSet);
  }
  cache.highlightMeshes.clear();
  scene.remove(cache.root);
  delete scene.userData[`${CACHE_KEY}_${widgetId}`];
}
