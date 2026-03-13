// SpotlightRig render — Three.js scene management for rotating spotlights. No React, no compile.ts.

import * as THREE from 'three';
import type { SpotlightRigState } from './types';
import { parseHexColor } from '../../math';

// ─── Data Structures ──────────────────────────────────────────────────────────

/** Per-light Three.js objects managed in the spotlight cache. */
type SpotRigEntry = {
  light: THREE.SpotLight;
  target: THREE.Object3D;
  beam: THREE.Mesh;            // cone mesh for visible beam
  helper: THREE.SpotLightHelper | null;
  /** Geometry fingerprint — rebuild cone if angle or distance changes. */
  builtAngle: number;
  builtDistance: number;
};

/** Cache of all Three.js objects owned by one SpotlightRig widget instance. */
type SpotlightRigCache = {
  entries: SpotRigEntry[];
  haloSprite: THREE.Sprite | null;
  haloTex: THREE.CanvasTexture | null;
};

/**
 * External refs passed into applySpotlightRig each tick.
 * Stored by the widget after initialize().
 */
export type SpotlightRigRefs = {
  scene: THREE.Scene;
  cache: SpotlightRigCache;
};

/** Cache key stored on scene.userData — unique per widget instance. */
const CACHE_KEY = '__brewsite_spotlight_rig_';

/**
 * Floor renderer's exclusion key. Objects marked with this are excluded from
 * computeSceneBaseY() so they don't shift the floor plane downward.
 * Must match the key used in floor/render.ts.
 */
const FLOOR_PART_KEY = '__brewsite_floor_part';

/** Mark a Three.js object as infrastructure so the floor ignores it. */
const markAsFloorPart = (obj: THREE.Object3D): void => {
  (obj.userData as Record<string, unknown>)[FLOOR_PART_KEY] = true;
};

// ─── Cache Lifecycle ──────────────────────────────────────────────────────────

/**
 * Returns the existing SpotlightRigCache for this widgetId on the given scene,
 * or creates and stores a fresh empty cache if none exists.
 */
export function getOrCreateCache(scene: THREE.Scene, widgetId: string): SpotlightRigCache {
  const key = CACHE_KEY + widgetId;
  const existing = scene.userData[key] as SpotlightRigCache | undefined;
  if (existing) return existing;
  const created: SpotlightRigCache = { entries: [], haloSprite: null, haloTex: null };
  scene.userData[key] = created;
  return created;
}

/**
 * Removes all Three.js objects from the scene, disposes all geometries/materials/textures,
 * and clears the cache. Safe to call multiple times.
 */
export function disposeCache(scene: THREE.Scene, cache: SpotlightRigCache): void {
  for (const entry of cache.entries) {
    scene.remove(entry.light);
    scene.remove(entry.target);
    scene.remove(entry.beam);
    if (entry.helper) scene.remove(entry.helper);
    entry.beam.geometry.dispose();
    (entry.beam.material as THREE.MeshBasicMaterial).dispose();
    if (entry.helper) entry.helper.dispose();
  }
  cache.entries = [];
  if (cache.haloSprite) {
    scene.remove(cache.haloSprite);
    (cache.haloSprite.material as THREE.SpriteMaterial).dispose();
    cache.haloSprite = null;
  }
  if (cache.haloTex) {
    cache.haloTex.dispose();
    cache.haloTex = null;
  }
}

// ─── Geometry Helpers ─────────────────────────────────────────────────────────

/**
 * Builds a ConeGeometry representing the spotlight beam.
 * The apex (narrow end) is translated to the local origin so the pivot is at the light source.
 */
function buildBeamGeometry(angle: number, distance: number): THREE.ConeGeometry {
  const baseRadius = Math.tan(angle) * distance;
  const geo = new THREE.ConeGeometry(baseRadius, distance, 32, 1, true);
  // Translate pivot to cone apex (top) so position.copy(light.position) places it correctly.
  geo.translate(0, -distance / 2, 0);
  return geo;
}

/** Builds the additive-blended transparent material used for the beam cone mesh. */
function buildBeamMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  const parsed = parseHexColor(color);
  return new THREE.MeshBasicMaterial({
    color: parsed.rgb,
    transparent: true,
    opacity: opacity * parsed.alpha,
    side: THREE.FrontSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Builds a radial gradient canvas texture for the ground halo sprite.
 * Baked once per widget; cached in SpotlightRigCache.
 */
function buildHaloTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  grad.addColorStop(0,   'rgba(255,255,255,0.8)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.3)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ─── Module-level scratch objects (avoid per-frame allocation) ────────────────

const _tmpVec = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
/** Cone geometry extends in -Y (apex at origin, base at -distance). Align this axis to light→target. */
const _CONE_AXIS = new THREE.Vector3(0, -1, 0);

// ─── Main Apply Function ──────────────────────────────────────────────────────

/**
 * Applies SpotlightRigState to the Three.js scene for the given wall-clock time.
 * Called once per frame from SpotlightRigWidget.onTick().
 *
 * Manages the light pool (grow/shrink), positions each light on its circular orbit,
 * updates beam cone orientation, manages SpotLightHelpers, and updates the halo sprite.
 */
export function applySpotlightRig(
  state: SpotlightRigState,
  refs: SpotlightRigRefs,
  wallTimeSeconds: number,
): void {
  const { scene, cache } = refs;

  if (!state.enabled) {
    // Disable all lights without removing them — avoids Three.js re-upload next frame.
    for (const entry of cache.entries) {
      entry.light.intensity = 0;
      entry.beam.visible = false;
      if (entry.helper) entry.helper.visible = false;
    }
    if (cache.haloSprite) cache.haloSprite.visible = false;
    return;
  }

  const count = Math.max(1, Math.round(state.count));

  // ── Resize pool ─────────────────────────────────────────────────────────────
  while (cache.entries.length > count) {
    const entry = cache.entries.pop()!;
    scene.remove(entry.light);
    scene.remove(entry.target);
    scene.remove(entry.beam);
    if (entry.helper) { scene.remove(entry.helper); entry.helper.dispose(); }
    entry.beam.geometry.dispose();
    (entry.beam.material as THREE.MeshBasicMaterial).dispose();
  }
  while (cache.entries.length < count) {
    const light = new THREE.SpotLight();
    const target = new THREE.Object3D();
    const geo = buildBeamGeometry(state.angle, state.distance || 60);
    const mat = buildBeamMaterial(state.beamColor, state.beamOpacity);
    const beam = new THREE.Mesh(geo, mat);
    // Mark all objects as floor-excluded infrastructure so beam bounding boxes
    // don't shift the floor plane downward via computeSceneBaseY().
    markAsFloorPart(light);
    markAsFloorPart(target);
    markAsFloorPart(beam);
    scene.add(light);
    scene.add(target);
    scene.add(beam);
    light.target = target;
    cache.entries.push({
      light, target, beam, helper: null,
      builtAngle: state.angle,
      builtDistance: state.distance,
    });
  }

  // ── Per-light update ─────────────────────────────────────────────────────────
  const TWO_PI = Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const entry = cache.entries[i]!;
    const { light, target, beam } = entry;

    const phase = (TWO_PI * i) / count;
    const theta = wallTimeSeconds * state.speed + phase;

    // Light source position (elevated, orbiting around state.center)
    const cx = state.center[0];
    const cy = state.center[1];
    const cz = state.center[2];
    light.position.set(
      cx + Math.sin(theta) * state.radius,
      cy + state.height,
      cz + Math.cos(theta) * state.radius,
    );

    // Target position: fixed point when state.target is set, otherwise straight-down orbit
    if (state.target) {
      target.position.set(state.target[0], state.target[1], state.target[2]);
    } else {
      target.position.set(
        cx + Math.sin(theta) * state.radius,
        cy + state.targetY,
        cz + Math.cos(theta) * state.radius,
      );
    }
    target.updateMatrixWorld();

    // Light properties
    const colorParsed = parseHexColor(state.color);
    light.color.set(colorParsed.rgb);
    light.intensity = state.intensity * colorParsed.alpha;
    light.angle = state.angle;
    light.penumbra = state.penumbra;
    light.decay = state.decay;
    light.distance = state.distance;

    // castShadow: only update if changed — toggling castShadow is expensive
    // (forces a shadow map re-upload). Shadow map size is set once at creation time.
    if (light.castShadow !== state.castShadow) {
      light.castShadow = state.castShadow;
      if (state.castShadow) {
        light.shadow.mapSize.set(state.shadowMapSize, state.shadowMapSize);
        light.shadow.needsUpdate = true;
      }
    }

    // Beam geometry rebuild: if angle or distance changed, rebuild the cone.
    if (entry.builtAngle !== state.angle || entry.builtDistance !== state.distance) {
      entry.beam.geometry.dispose();
      entry.beam.geometry = buildBeamGeometry(state.angle, state.distance || 60);
      entry.builtAngle = state.angle;
      entry.builtDistance = state.distance;
    }

    // Beam cone: position at light, orient using quaternion from +Y to direction vector.
    beam.visible = state.showBeam && state.beamOpacity > 0;
    if (beam.visible) {
      beam.position.copy(light.position);
      // Align cone axis (-Y, where the base/opening extends) to the light→target direction.
      // setFromUnitVectors avoids the lookAt + rotateX(π/2) pattern which has
      // gimbal edge cases at straight-down alignment.
      _tmpVec.subVectors(target.position, light.position).normalize();
      _tmpQuat.setFromUnitVectors(_CONE_AXIS, _tmpVec);
      beam.quaternion.copy(_tmpQuat);

      const mat = beam.material as THREE.MeshBasicMaterial;
      const beamParsed = parseHexColor(state.beamColor);
      mat.color.set(beamParsed.rgb);
      mat.opacity = state.beamOpacity * beamParsed.alpha;
    }

    // SpotLightHelper: add when showHelper enabled, remove when disabled.
    if (state.showHelper && !entry.helper) {
      entry.helper = new THREE.SpotLightHelper(light);
      markAsFloorPart(entry.helper);
      scene.add(entry.helper);
    } else if (!state.showHelper && entry.helper) {
      scene.remove(entry.helper);
      entry.helper.dispose();
      entry.helper = null;
    }
    if (entry.helper) {
      entry.helper.visible = true;
      entry.helper.update();
    }
  }

  // ── Halo sprite (single, centered at origin at targetY) ──────────────────────
  // V1: Single halo at world origin at targetY. Phase 2: per-light halos.
  if (state.showHalo && state.haloOpacity > 0) {
    if (!cache.haloSprite) {
      cache.haloTex = buildHaloTexture();
      cache.haloSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: cache.haloTex,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      );
      markAsFloorPart(cache.haloSprite);
      scene.add(cache.haloSprite);
    }
    cache.haloSprite.visible = true;
    cache.haloSprite.position.set(state.center[0], state.center[1] + state.targetY + 0.01, state.center[2]);
    cache.haloSprite.scale.set(state.haloSize, state.haloSize, 1);
    (cache.haloSprite.material as THREE.SpriteMaterial).opacity = state.haloOpacity;
  } else if (cache.haloSprite) {
    cache.haloSprite.visible = false;
  }
}
