// SpotlightRig DSL prop types — no runtime logic, no Three.js.

import type { SceneSnapshotContext } from '../../compiler/sceneTypes';
import type { SpotlightRigTheme, SpotlightRigState, Vec3Tuple } from './types';

type Resolvable<T> = T | ((context: SceneSnapshotContext) => T);

/**
 * DSL props for <SpotlightRig>.
 *
 * Priority chain (highest wins):
 *   individual prop override > props.theme > DEFAULT_SPOTLIGHT_RIG_THEME
 *
 * Element-only (no theme equivalent): count, showHelper.
 * All SpotlightRigTheme keys are individually overridable.
 */
export type SpotlightRigProps = {
  // ── Element-only ──────────────────────────────────────────────────────────
  /** World-space center of the circular orbit. Default: [0, 0, 0]. NOT in theme. */
  center?: Resolvable<Vec3Tuple>;
  /**
   * World-space target point that all spotlights aim at.
   * Default: null (each light targets straight down below itself at `targetY`).
   * When set, all lights converge on this point.
   */
  target?: Resolvable<Vec3Tuple | null>;
  /** Number of individual spotlights. Default: 3. NOT in theme. */
  count?: Resolvable<number>;
  /**
   * Render Three.js SpotLightHelpers for all lights.
   * NOT Resolvable — consumed at initialize()/apply() time, not baked into SceneTrack.
   * NOT in theme.
   */
  showHelper?: boolean;

  // ── Theme + per-element override ──────────────────────────────────────────
  /**
   * Base theme object. Individual props below override matching theme fields.
   * Build custom themes with the provided preset + override pattern:
   *   theme={mergeSpotlightRigTheme(moviePremiereTheme, { speed: 0.8 })}
   */
  theme?: SpotlightRigTheme;

  color?: Resolvable<string>;
  intensity?: Resolvable<number>;
  speed?: Resolvable<number>;
  radius?: Resolvable<number>;
  height?: Resolvable<number>;
  targetY?: Resolvable<number>;
  angle?: Resolvable<number>;
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

// Re-export so consumers import from dsl.tsx without touching types.ts directly.
export type { SpotlightRigTheme, SpotlightRigState, Vec3Tuple };
