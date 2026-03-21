// SpotlightRig DSL prop types — no runtime logic, no Three.js.

import type { ReactNode } from 'react';
import type { SceneSnapshotContext } from '../../compiler/sceneTypes';
import type { SpotlightRigState, SpotlightLightState, Vec3Tuple, OrbitFn } from './types';
import type { SceneAngle } from '../../units/types';

type Resolvable<T> = T | ((context: SceneSnapshotContext) => T);

/**
 * DSL props for a single <Spotlight> child of <SpotlightRig>.
 *
 * Priority chain (highest wins):
 *   individual prop > parent <SpotlightRig> prop > theme > DEFAULT_SPOTLIGHT_RIG_THEME
 *
 * All SpotlightRigTheme keys are individually overridable per-light.
 * Additional per-light-only props: phase, orbit, target.
 */
export type SpotlightProps = {
  // ── Per-light-only ───────────────────────────────────────────────────────────
  /**
   * Explicit angular phase offset for circular orbit.
   * Accepts SceneAngle values (e.g. `'45deg'`, `'0.78rad'`).
   * When omitted, defaults to auto-distributed phase: (2π × lightIndex / totalLights).
   * NOT in theme.
   */
  phase?: SceneAngle;
  /**
   * Custom orbit function. When provided, overrides the default circular orbit
   * computation for this light. Evaluated at tick time — not baked into SceneTrack.
   * NOT in theme. NOT Resolvable — must be a plain function reference.
   */
  orbit?: OrbitFn;
  /**
   * Per-light target point. Overrides the rig-level `target` for this light only.
   * Default: null (uses rig-level target or auto-aim).
   */
  target?: Resolvable<Vec3Tuple | null>;

  // ── Theme + per-light override ───────────────────────────────────────────────
  color?: Resolvable<string>;
  intensity?: Resolvable<number>;
  speed?: Resolvable<number>;
  radius?: Resolvable<number>;
  height?: Resolvable<number>;
  targetY?: Resolvable<number>;
  angle?: Resolvable<SceneAngle>;
  penumbra?: Resolvable<number>;
  decay?: Resolvable<number>;
  distance?: Resolvable<number>;
  castShadow?: Resolvable<boolean>;
  shadowMapSize?: Resolvable<number>;
  showBeam?: Resolvable<boolean>;
  beamOpacity?: Resolvable<number>;
  beamColor?: Resolvable<string>;
  showHalo?: Resolvable<boolean>;
  haloOpacity?: Resolvable<number>;
  haloSize?: Resolvable<number>;
};

/**
 * DSL props for <SpotlightRig>.
 *
 * Priority chain (highest wins per theme field):
 *   individual <Spotlight> prop > rig-level prop > props.theme > DEFAULT_SPOTLIGHT_RIG_THEME
 *
 * <Spotlight> children are required — each light must be explicitly declared.
 * <SpotlightRig> with zero children produces zero lights.
 */
export type SpotlightRigProps = {
  // ── Element-only ──────────────────────────────────────────────────────────────
  /** World-space center of the circular orbit. Default: [0, 0, 0]. NOT in theme. */
  center?: Resolvable<Vec3Tuple>;
  /**
   * Rig-level world-space target that all spotlights aim at (unless overridden per-light).
   * Default: null (each light targets straight down below itself at `targetY`).
   */
  target?: Resolvable<Vec3Tuple | null>;
  /**
   * Render Three.js SpotLightHelpers for all lights.
   * NOT Resolvable — consumed at tick time. NOT in theme.
   */
  showHelper?: boolean;

  // ── Theme + per-rig override ──────────────────────────────────────────────────
  color?: Resolvable<string>;
  intensity?: Resolvable<number>;
  speed?: Resolvable<number>;
  radius?: Resolvable<number>;
  height?: Resolvable<number>;
  targetY?: Resolvable<number>;
  angle?: Resolvable<SceneAngle>;
  penumbra?: Resolvable<number>;
  decay?: Resolvable<number>;
  distance?: Resolvable<number>;
  castShadow?: Resolvable<boolean>;
  shadowMapSize?: Resolvable<number>;
  showBeam?: Resolvable<boolean>;
  beamOpacity?: Resolvable<number>;
  beamColor?: Resolvable<string>;
  showHalo?: Resolvable<boolean>;
  haloOpacity?: Resolvable<number>;
  haloSize?: Resolvable<number>;

  /** <Spotlight> children. Each child defines one light in the rig. */
  children?: ReactNode;
};

// Re-export so consumers import from dsl.tsx without touching types.ts directly.
export type { SpotlightRigState, SpotlightLightState, Vec3Tuple, OrbitFn };
