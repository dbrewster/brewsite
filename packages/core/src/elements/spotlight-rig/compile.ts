// SpotlightRig compile — pure state resolution and transition spec. No Three.js, no React.

import type { SceneSnapshotContext } from '../../compiler/sceneTypes';
import type { FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { blendNumber, blendColor } from '../../compiler/transitions/transitionTypes';
import type { SpotlightRigTheme, SpotlightRigState, Vec3Tuple } from './types';
import type { SpotlightRigProps } from './dsl';

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

/** Default number of individual spotlights in the rig. Element-only, not in theme. */
export const DEFAULT_SPOTLIGHT_RIG_COUNT = 3;

/** Default center of the rig orbit. Element-only, not in theme. */
export const DEFAULT_SPOTLIGHT_RIG_CENTER: Vec3Tuple = [0, 0, 0];

/**
 * Pure function — resolves SpotlightRigProps into SpotlightRigState.
 * Priority: individual prop override > props.theme > DEFAULT_SPOTLIGHT_RIG_THEME.
 */
export function resolveSpotlightRigState(
  props: SpotlightRigProps,
  context: SceneSnapshotContext,
): SpotlightRigState {
  const base = DEFAULT_SPOTLIGHT_RIG_THEME;
  const theme: SpotlightRigTheme = props.theme
    ? { ...base, ...props.theme }
    : base;

  const r = <T>(v: T | ((ctx: SceneSnapshotContext) => T) | undefined): T | undefined =>
    typeof v === 'function' ? (v as (c: SceneSnapshotContext) => T)(context) : v;

  return {
    center:        r(props.center)        ?? DEFAULT_SPOTLIGHT_RIG_CENTER,
    target:        r(props.target)        ?? null,
    count:         r(props.count)         ?? DEFAULT_SPOTLIGHT_RIG_COUNT,
    showHelper:    props.showHelper        ?? false,
    enabled:       true,
    color:         r(props.color)         ?? theme.color,
    intensity:     r(props.intensity)     ?? theme.intensity,
    speed:         r(props.speed)         ?? theme.speed,
    radius:        r(props.radius)        ?? theme.radius,
    height:        r(props.height)        ?? theme.height,
    targetY:       r(props.targetY)       ?? theme.targetY,
    angle:         r(props.angle)         ?? theme.angle,
    penumbra:      r(props.penumbra)      ?? theme.penumbra,
    decay:         r(props.decay)         ?? theme.decay,
    distance:      r(props.distance)      ?? theme.distance,
    castShadow:    r(props.castShadow)    ?? theme.castShadow,
    shadowMapSize: r(props.shadowMapSize) ?? theme.shadowMapSize,
    showBeam:      r(props.showBeam)      ?? theme.showBeam,
    beamOpacity:   r(props.beamOpacity)   ?? theme.beamOpacity,
    beamColor:     r(props.beamColor)     ?? theme.beamColor,
    showHalo:      r(props.showHalo)      ?? theme.showHalo,
    haloOpacity:   r(props.haloOpacity)   ?? theme.haloOpacity,
    haloSize:      r(props.haloSize)      ?? theme.haloSize,
  };
}

/**
 * Shallow-merges overrides onto base, producing a new SpotlightRigTheme.
 * Neither argument is mutated.
 */
export function mergeSpotlightRigTheme(
  base: SpotlightRigTheme,
  overrides: Partial<SpotlightRigTheme>,
): SpotlightRigTheme {
  return { ...base, ...overrides };
}

// Internal — not exported. Used only by the transition spec.
const blendSpotlightRig = (
  from: SpotlightRigState,
  to: SpotlightRigState,
  t: number,
): SpotlightRigState => ({
  ...to,
  // Numeric interpolation
  intensity:    blendNumber(from.intensity,    to.intensity,    t) ?? to.intensity,
  speed:        blendNumber(from.speed,        to.speed,        t) ?? to.speed,
  radius:       blendNumber(from.radius,       to.radius,       t) ?? to.radius,
  height:       blendNumber(from.height,       to.height,       t) ?? to.height,
  targetY:      blendNumber(from.targetY,      to.targetY,      t) ?? to.targetY,
  angle:        blendNumber(from.angle,        to.angle,        t) ?? to.angle,
  penumbra:     blendNumber(from.penumbra,     to.penumbra,     t) ?? to.penumbra,
  decay:        blendNumber(from.decay,        to.decay,        t) ?? to.decay,
  distance:     blendNumber(from.distance,     to.distance,     t) ?? to.distance,
  beamOpacity:  blendNumber(from.beamOpacity,  to.beamOpacity,  t) ?? to.beamOpacity,
  haloOpacity:  blendNumber(from.haloOpacity,  to.haloOpacity,  t) ?? to.haloOpacity,
  haloSize:     blendNumber(from.haloSize,     to.haloSize,     t) ?? to.haloSize,
  // Color interpolation
  color:        blendColor(from.color,     to.color,     t) ?? to.color,
  beamColor:    blendColor(from.beamColor, to.beamColor, t) ?? to.beamColor,
  // Vec3 interpolation
  center: [
    blendNumber(from.center[0], to.center[0], t) ?? to.center[0],
    blendNumber(from.center[1], to.center[1], t) ?? to.center[1],
    blendNumber(from.center[2], to.center[2], t) ?? to.center[2],
  ],
  // target: blend if both are non-null, otherwise discrete switch
  target: from.target && to.target ? [
    blendNumber(from.target[0], to.target[0], t) ?? to.target[0],
    blendNumber(from.target[1], to.target[1], t) ?? to.target[1],
    blendNumber(from.target[2], to.target[2], t) ?? to.target[2],
  ] : to.target,
  // Discrete — take destination value immediately
  count:         to.count,
  castShadow:    to.castShadow,
  shadowMapSize: to.shadowMapSize,
  showBeam:      to.showBeam,
  showHalo:      to.showHalo,
  showHelper:    to.showHelper,
  enabled:       to.enabled,
});

/**
 * Functional transition spec for SpotlightRig.
 *
 * enter/exit: fade intensity, beamOpacity, and haloOpacity to/from zero.
 * interpolate: blend all numeric and color fields; discrete fields take the `to` value immediately.
 */
export const spotlightRigTransitionSpec: FunctionalTransitionSpec<SpotlightRigState> = {
  exitFn: (from) => ({ t }) => ({
    ...from,
    intensity:   blendNumber(from.intensity,   0, t) ?? 0,
    beamOpacity: blendNumber(from.beamOpacity, 0, t) ?? 0,
    haloOpacity: blendNumber(from.haloOpacity, 0, t) ?? 0,
  }),
  enterFn: (to) => ({ t }) => ({
    ...to,
    intensity:   blendNumber(0, to.intensity,   t) ?? to.intensity,
    beamOpacity: blendNumber(0, to.beamOpacity, t) ?? to.beamOpacity,
    haloOpacity: blendNumber(0, to.haloOpacity, t) ?? to.haloOpacity,
  }),
  interpolateFn: (from, to) => ({ t }) => blendSpotlightRig(from, to, t),
};
