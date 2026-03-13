// SpotlightRig render — Three.js scene management for rotating spotlights. No React, no compile.ts.

import * as THREE from 'three';
import type { SpotlightRigState } from './types';
import type { OrbitFn } from './types';
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
 * @param state           - Current per-light compiled state from SceneTrack.
 * @param refs            - Scene + cache references from widget instance.
 * @param wallTimeSeconds - Monotonically increasing wall clock (not scene-relative).
 * @param orbitFns        - Optional sparse array of custom orbit functions, indexed
 *                          by light index. Undefined entries use default circular orbit.
 */
export function applySpotlightRig(
  state: SpotlightRigState,
  refs: SpotlightRigRefs,
  wallTimeSeconds: number,
  orbitFns?: (OrbitFn | undefined)[],
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

  const count = state.lights.length;

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
    const lightState = state.lights[cache.entries.length]!;
    const threeLight = new THREE.SpotLight();
    const target = new THREE.Object3D();
    const geo = buildBeamGeometry(lightState.angle, lightState.distance || 60);
    const mat = buildBeamMaterial(lightState.beamColor, lightState.beamOpacity);
    const beam = new THREE.Mesh(geo, mat);
    // Mark all objects as floor-excluded infrastructure so beam bounding boxes
    // don't shift the floor plane downward via computeSceneBaseY().
    markAsFloorPart(threeLight);
    markAsFloorPart(target);
    markAsFloorPart(beam);
    scene.add(threeLight);
    scene.add(target);
    scene.add(beam);
    threeLight.target = target;
    cache.entries.push({
      light: threeLight, target, beam, helper: null,
      builtAngle: lightState.angle,
      builtDistance: lightState.distance,
    });
  }

  // ── Per-light update ─────────────────────────────────────────────────────────
  for (let i = 0; i < count; i++) {
    const entry = cache.entries[i]!;
    const light = state.lights[i]!;
    const { light: threeLight, target: threeTarget, beam } = entry;

    // Position computation
    const orbitFn = orbitFns?.[i];
    let lightPos: [number, number, number];
    if (orbitFn) {
      // Custom orbit function — evaluate at wall time and offset by rig center.
      const raw = orbitFn(wallTimeSeconds);
      lightPos = [
        state.center[0] + raw[0],
        state.center[1] + raw[1],
        state.center[2] + raw[2],
      ];
    } else {
      // Default circular orbit: phase from light.phase, speed from light.speed.
      const theta = wallTimeSeconds * light.speed + light.phase;
      lightPos = [
        state.center[0] + Math.sin(theta) * light.radius,
        state.center[1] + light.height,
        state.center[2] + Math.cos(theta) * light.radius,
      ];
    }
    threeLight.position.set(lightPos[0], lightPos[1], lightPos[2]);

    // Target computation
    // Priority: per-light target > rig-level target > auto-aim below source
    const effectiveTarget = light.target ?? state.target;
    if (effectiveTarget) {
      threeTarget.position.set(effectiveTarget[0], effectiveTarget[1], effectiveTarget[2]);
    } else {
      // Auto-aim: straight down to targetY
      if (orbitFn) {
        threeTarget.position.set(lightPos[0], state.center[1] + light.targetY, lightPos[2]);
      } else {
        const theta = wallTimeSeconds * light.speed + light.phase;
        threeTarget.position.set(
          state.center[0] + Math.sin(theta) * light.radius,
          state.center[1] + light.targetY,
          state.center[2] + Math.cos(theta) * light.radius,
        );
      }
    }
    threeTarget.updateMatrixWorld();

    // Per-light properties
    const colorParsed = parseHexColor(light.color);
    threeLight.color.set(colorParsed.rgb);
    threeLight.intensity = light.intensity * colorParsed.alpha;
    threeLight.angle = light.angle;
    threeLight.penumbra = light.penumbra;
    threeLight.decay = light.decay;
    threeLight.distance = light.distance;

    // castShadow: only update if changed — toggling castShadow is expensive
    // (forces a shadow map re-upload). Shadow map size is set once at creation time.
    if (threeLight.castShadow !== light.castShadow) {
      threeLight.castShadow = light.castShadow;
      if (light.castShadow) {
        threeLight.shadow.mapSize.set(light.shadowMapSize, light.shadowMapSize);
        threeLight.shadow.needsUpdate = true;
      }
    }

    // Beam geometry rebuild: if angle or distance changed, rebuild the cone.
    if (entry.builtAngle !== light.angle || entry.builtDistance !== light.distance) {
      entry.beam.geometry.dispose();
      entry.beam.geometry = buildBeamGeometry(light.angle, light.distance || 60);
      entry.builtAngle = light.angle;
      entry.builtDistance = light.distance;
    }

    // Beam cone: position at light, orient using quaternion from -Y axis to direction vector.
    beam.visible = light.showBeam && light.beamOpacity > 0;
    if (beam.visible) {
      beam.position.set(lightPos[0], lightPos[1], lightPos[2]);
      // Align cone axis (-Y, where the base/opening extends) to the light→target direction.
      // setFromUnitVectors avoids the lookAt + rotateX(π/2) pattern which has
      // gimbal edge cases at straight-down alignment.
      _tmpVec.subVectors(threeTarget.position, threeLight.position).normalize();
      _tmpQuat.setFromUnitVectors(_CONE_AXIS, _tmpVec);
      beam.quaternion.copy(_tmpQuat);

      const mat = beam.material as THREE.MeshBasicMaterial;
      const beamParsed = parseHexColor(light.beamColor);
      mat.color.set(beamParsed.rgb);
      mat.opacity = light.beamOpacity * beamParsed.alpha;
    }

    // SpotLightHelper: rig-level flag (not per-light). Add when enabled, remove when disabled.
    if (state.showHelper && !entry.helper) {
      entry.helper = new THREE.SpotLightHelper(threeLight);
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

  // ── Halo sprite (single, centered at rig center at targetY) ──────────────────
  // DEBT: Halo sprite is still a single centered sprite (one per rig, not per light).
  // The original V1 comment ("Phase 2: per-light halos") has been preserved.
  // Per-light halos require SpotlightRigCache to hold a halo sprite per entry
  // rather than a single haloSprite on the top-level cache. Deferred.
  const firstLight = state.lights[0];
  if (firstLight && firstLight.showHalo && firstLight.haloOpacity > 0) {
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
    cache.haloSprite.position.set(
      state.center[0],
      state.center[1] + firstLight.targetY + 0.01,
      state.center[2],
    );
    cache.haloSprite.scale.set(firstLight.haloSize, firstLight.haloSize, 1);
    (cache.haloSprite.material as THREE.SpriteMaterial).opacity = firstLight.haloOpacity;
  } else if (cache.haloSprite) {
    cache.haloSprite.visible = false;
  }
}
