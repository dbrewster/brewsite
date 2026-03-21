// SpotlightRig compile — pure state resolution and transition spec. No Three.js, no React.

import type { SceneSnapshotContext } from '../../compiler/sceneTypes';
import type { FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { blendNumber, blendColor } from '../../compiler/transitions/transitionTypes';
import type { SpotlightRigTheme, SpotlightRigState, SpotlightLightState, Vec3Tuple } from './types';
import type { SpotlightRigProps, SpotlightProps } from './dsl';
import type { ThemeFamily } from '../../theme/types';
import { resolveAngle } from '../../units/resolve';
import type { SceneAngle } from '../../units/types';

/** Resolves an optional SceneAngle to radians, returning undefined if absent. */
function resolveAngleValue(v: SceneAngle | undefined): number | undefined {
  return v !== undefined ? resolveAngle(v) : undefined;
}

/**
 * Default theme values for SpotlightRig.
 * Applied as the lowest-priority layer in the resolution chain:
 * DEFAULT → props.theme → individual prop overrides.
 */
export const DEFAULT_SPOTLIGHT_RIG_THEME: SpotlightRigTheme = {
  color: '#ffffff',
  intensity: 80,           // high — spotlights are typically bright
  speed: 0.5,              // radians/second
  radius: 5,               // world units — modest default spread
  height: 0,               // Y offset above center — 0 means lights sit at center.y
  targetY: 0,              // ground plane Y (only used when target is null)
  angle: Math.PI / 16,     // ~11° — narrow dramatic cone
  penumbra: 0.25,
  decay: 2.0,              // physically-based
  distance: 30,            // reasonable reach without excessive shadow range
  castShadow: false,       // default off — expensive
  shadowMapSize: 1024,
  showBeam: true,
  beamOpacity: 0.10,
  beamColor: '#e8f0ff',    // slightly cool white
  showHalo: false,         // opt-in
  haloOpacity: 0.3,
  haloSize: 6,
};

/** Default number of individual spotlights used for the defaultState array. Not exported as a prop. */
const DEFAULT_SPOTLIGHT_RIG_COUNT = 3;

/** Default center of the rig orbit. Element-only, not in theme. */
export const DEFAULT_SPOTLIGHT_RIG_CENTER: Vec3Tuple = [0, 0, 0];

/** Per-theme-family spotlight presets. Falls back to DEFAULT_SPOTLIGHT_RIG_THEME for unregistered families. */
const SPOTLIGHT_PRESETS: Partial<Record<ThemeFamily, SpotlightRigTheme>> = {
  darkGlass: {
    color: '#FFD0A0', intensity: 100, speed: 0.3, radius: 16, height: 28,
    targetY: 0, angle: Math.PI / 18, penumbra: 0.20, decay: 2.0, distance: 65,
    castShadow: false, shadowMapSize: 1024,
    showBeam: true, beamOpacity: 0.11, beamColor: '#FFE8CC',
    showHalo: false, haloOpacity: 0.25, haloSize: 7,
  },
  neonCyber: {
    color: '#00E7FF', intensity: 160, speed: 1.4, radius: 14, height: 24,
    targetY: 0, angle: Math.PI / 20, penumbra: 0.12, decay: 2.0, distance: 55,
    castShadow: false, shadowMapSize: 1024,
    showBeam: true, beamOpacity: 0.18, beamColor: '#80F4FF',
    showHalo: true, haloOpacity: 0.40, haloSize: 9,
  },
  lightCanvas: {
    color: '#FFF8F0', intensity: 25, speed: 0.25, radius: 20, height: 30,
    targetY: 0, angle: Math.PI / 8, penumbra: 0.7, decay: 2.0, distance: 70,
    castShadow: false, shadowMapSize: 1024,
    showBeam: false, beamOpacity: 0.0, beamColor: '#ffffff',
    showHalo: false, haloOpacity: 0.0, haloSize: 6,
  },
  // 'default', 'midnight' → no entry, falls back to DEFAULT_SPOTLIGHT_RIG_THEME
};

/**
 * Resolves a single <Spotlight> child's props into a SpotlightLightState.
 *
 * Priority chain: lightProp > rigProp > theme > DEFAULT_SPOTLIGHT_RIG_THEME
 *
 * `phase` is passed in as a parameter because the auto-distribution formula
 * (2π × index / count) requires knowing the total count, which is determined
 * by the caller after all children have been collected.
 *
 * This function is pure: no side effects, no Three.js, no React.
 */
export function resolveSpotlightLightState(
  lightProps: SpotlightProps,
  rigProps: SpotlightRigProps,
  theme: SpotlightRigTheme,
  context: SceneSnapshotContext,
  autoPhase: number,
): SpotlightLightState {
  const r = <T>(v: T | ((ctx: SceneSnapshotContext) => T) | undefined): T | undefined =>
    typeof v === 'function' ? (v as (c: SceneSnapshotContext) => T)(context) : v;

  return {
    color:         r(lightProps.color)         ?? r(rigProps.color)         ?? theme.color,
    intensity:     r(lightProps.intensity)     ?? r(rigProps.intensity)     ?? theme.intensity,
    speed:         r(lightProps.speed)         ?? r(rigProps.speed)         ?? theme.speed,
    radius:        r(lightProps.radius)        ?? r(rigProps.radius)        ?? theme.radius,
    height:        r(lightProps.height)        ?? r(rigProps.height)        ?? theme.height,
    targetY:       r(lightProps.targetY)       ?? r(rigProps.targetY)       ?? theme.targetY,
    angle:         resolveAngleValue(r(lightProps.angle) ?? r(rigProps.angle)) ?? theme.angle,
    penumbra:      r(lightProps.penumbra)      ?? r(rigProps.penumbra)      ?? theme.penumbra,
    decay:         r(lightProps.decay)         ?? r(rigProps.decay)         ?? theme.decay,
    distance:      r(lightProps.distance)      ?? r(rigProps.distance)      ?? theme.distance,
    castShadow:    r(lightProps.castShadow)    ?? r(rigProps.castShadow)    ?? theme.castShadow,
    shadowMapSize: r(lightProps.shadowMapSize) ?? r(rigProps.shadowMapSize) ?? theme.shadowMapSize,
    showBeam:      r(lightProps.showBeam)      ?? r(rigProps.showBeam)      ?? theme.showBeam,
    beamOpacity:   r(lightProps.beamOpacity)   ?? r(rigProps.beamOpacity)   ?? theme.beamOpacity,
    beamColor:     r(lightProps.beamColor)     ?? r(rigProps.beamColor)     ?? theme.beamColor,
    showHalo:      r(lightProps.showHalo)      ?? r(rigProps.showHalo)      ?? theme.showHalo,
    haloOpacity:   r(lightProps.haloOpacity)   ?? r(rigProps.haloOpacity)   ?? theme.haloOpacity,
    haloSize:      r(lightProps.haloSize)      ?? r(rigProps.haloSize)      ?? theme.haloSize,
    phase:         lightProps.phase !== undefined ? resolveAngle(lightProps.phase) : autoPhase,
    target:        r(lightProps.target)         ?? null,
  };
}

/**
 * Resolves SpotlightRigProps and a list of per-light SpotlightProps
 * into SpotlightRigState.
 *
 * When lightPropsList is empty (no <Spotlight> children), produces zero lights.
 *
 * This function is pure — the caller is responsible for extracting JSX children.
 */
export function resolveSpotlightRig(
  rigProps: SpotlightRigProps,
  lightPropsList: SpotlightProps[],
  context: SceneSnapshotContext,
): SpotlightRigState {
  const familyPreset = SPOTLIGHT_PRESETS[context.themeFamily];
  const theme: SpotlightRigTheme = familyPreset ?? DEFAULT_SPOTLIGHT_RIG_THEME;

  const r = <T>(v: T | ((ctx: SceneSnapshotContext) => T) | undefined): T | undefined =>
    typeof v === 'function' ? (v as (c: SceneSnapshotContext) => T)(context) : v;

  const center: Vec3Tuple = r(rigProps.center) ?? DEFAULT_SPOTLIGHT_RIG_CENTER;
  const target: Vec3Tuple | null = r(rigProps.target) ?? null;
  const showHelper = rigProps.showHelper ?? false;

  const lights: SpotlightLightState[] = lightPropsList.map((lightProps, i) => {
    const autoPhase = (Math.PI * 2 * i) / lightPropsList.length;
    return resolveSpotlightLightState(lightProps, rigProps, theme, context, autoPhase);
  });

  return { center, target, showHelper, enabled: true, lights };
}

// ─── Transition Spec Internals ────────────────────────────────────────────────

/**
 * Blends two SpotlightLightState arrays.
 *
 * Rules:
 * - Matching indices: blend all numeric/color fields.
 * - Extra lights in `to` (new lights): enter by fading intensity from 0.
 * - Extra lights in `from` (removed lights): exit by fading intensity to 0.
 * - Discrete fields (castShadow, shadowMapSize, showBeam, showHalo): take `to` value.
 *
 * Phase and target are NOT blended — they are discrete structural fields.
 */
function blendLights(
  from: SpotlightLightState[],
  to: SpotlightLightState[],
  t: number,
): SpotlightLightState[] {
  const maxLen = Math.max(from.length, to.length);
  const result: SpotlightLightState[] = [];
  for (let i = 0; i < maxLen; i++) {
    const f = from[i];
    const toLight = to[i];
    if (f && toLight) {
      // Both present — full blend.
      result.push({
        ...toLight,
        color:        blendColor(f.color, toLight.color, t) ?? toLight.color,
        intensity:    blendNumber(f.intensity, toLight.intensity, t) ?? toLight.intensity,
        speed:        blendNumber(f.speed, toLight.speed, t) ?? toLight.speed,
        radius:       blendNumber(f.radius, toLight.radius, t) ?? toLight.radius,
        height:       blendNumber(f.height, toLight.height, t) ?? toLight.height,
        targetY:      blendNumber(f.targetY, toLight.targetY, t) ?? toLight.targetY,
        angle:        blendNumber(f.angle, toLight.angle, t) ?? toLight.angle,
        penumbra:     blendNumber(f.penumbra, toLight.penumbra, t) ?? toLight.penumbra,
        decay:        blendNumber(f.decay, toLight.decay, t) ?? toLight.decay,
        distance:     blendNumber(f.distance, toLight.distance, t) ?? toLight.distance,
        beamOpacity:  blendNumber(f.beamOpacity, toLight.beamOpacity, t) ?? toLight.beamOpacity,
        beamColor:    blendColor(f.beamColor, toLight.beamColor, t) ?? toLight.beamColor,
        haloOpacity:  blendNumber(f.haloOpacity, toLight.haloOpacity, t) ?? toLight.haloOpacity,
        haloSize:     blendNumber(f.haloSize, toLight.haloSize, t) ?? toLight.haloSize,
        // Discrete: take to value
        castShadow:    toLight.castShadow,
        shadowMapSize: toLight.shadowMapSize,
        showBeam:      toLight.showBeam,
        showHalo:      toLight.showHalo,
        phase:         toLight.phase,
        target:        toLight.target,
      });
    } else if (f && !toLight) {
      // Removed light — fade out intensity.
      result.push({
        ...f,
        intensity:   blendNumber(f.intensity, 0, t) ?? 0,
        beamOpacity: blendNumber(f.beamOpacity, 0, t) ?? 0,
        haloOpacity: blendNumber(f.haloOpacity, 0, t) ?? 0,
      });
    } else if (!f && toLight) {
      // New light — fade in intensity.
      result.push({
        ...toLight,
        intensity:   blendNumber(0, toLight.intensity, t) ?? toLight.intensity,
        beamOpacity: blendNumber(0, toLight.beamOpacity, t) ?? toLight.beamOpacity,
        haloOpacity: blendNumber(0, toLight.haloOpacity, t) ?? toLight.haloOpacity,
      });
    }
  }
  return result;
}

/**
 * Functional transition spec for SpotlightRig.
 *
 * enter/exit: fade all lights' intensity, beamOpacity, haloOpacity to/from zero.
 * interpolate: per-light blend with fade-in/out for count mismatches.
 */
export const spotlightRigTransitionSpec: FunctionalTransitionSpec<SpotlightRigState> = {
  exitFn: (from) => ({ t }) => ({
    ...from,
    lights: from.lights.map((light) => ({
      ...light,
      intensity:   blendNumber(light.intensity,   0, t) ?? 0,
      beamOpacity: blendNumber(light.beamOpacity, 0, t) ?? 0,
      haloOpacity: blendNumber(light.haloOpacity, 0, t) ?? 0,
    })),
  }),
  enterFn: (to) => ({ t }) => ({
    ...to,
    lights: to.lights.map((light) => ({
      ...light,
      intensity:   blendNumber(0, light.intensity,   t) ?? light.intensity,
      beamOpacity: blendNumber(0, light.beamOpacity, t) ?? light.beamOpacity,
      haloOpacity: blendNumber(0, light.haloOpacity, t) ?? light.haloOpacity,
    })),
  }),
  interpolateFn: (from, to) => ({ t }) => ({
    ...to,
    center: [
      blendNumber(from.center[0], to.center[0], t) ?? to.center[0],
      blendNumber(from.center[1], to.center[1], t) ?? to.center[1],
      blendNumber(from.center[2], to.center[2], t) ?? to.center[2],
    ],
    target: from.target && to.target ? [
      blendNumber(from.target[0], to.target[0], t) ?? to.target[0],
      blendNumber(from.target[1], to.target[1], t) ?? to.target[1],
      blendNumber(from.target[2], to.target[2], t) ?? to.target[2],
    ] : to.target,
    lights: blendLights(from.lights, to.lights, t),
  }),
};

// ─── Default State Exports ────────────────────────────────────────────────────

/** Default per-light states for the widget's defaultState (3 lights, evenly phased). */
export const DEFAULT_SPOTLIGHT_RIG_LIGHTS: SpotlightLightState[] = Array.from(
  { length: DEFAULT_SPOTLIGHT_RIG_COUNT },
  (_, i) => ({
    ...DEFAULT_SPOTLIGHT_RIG_THEME,
    phase: (Math.PI * 2 * i) / DEFAULT_SPOTLIGHT_RIG_COUNT,
    target: null,
  }),
);

/** Default SpotlightRigState used by the widget when no scene declares a SpotlightRig. */
export const DEFAULT_SPOTLIGHT_RIG_STATE: SpotlightRigState = {
  center: DEFAULT_SPOTLIGHT_RIG_CENTER,
  target: null,
  showHelper: false,
  enabled: false,
  lights: DEFAULT_SPOTLIGHT_RIG_LIGHTS,
};
