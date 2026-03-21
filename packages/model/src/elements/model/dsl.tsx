/**
 * Model element DSL - React components for scene authoring.
 */

import type { ReactNode } from 'react';
import type { Resolvable, SceneAngle } from '@brewsite/core';
import type {
  AxisRotation,
  AxisTranslation,
  CustomAnimation,
  MotionCommand,
  MotionScene,
} from './types';

// ─── Shared primitive types ─────────────────────────────────────────────────

export type { Vec3 } from '@brewsite/core';

// ─── DSL Component Props ─────────────────────────────────────────────────────

export type ModelProps = {
  scale?: Resolvable<number>;
  /** World-space Z depth of the model center. Default: 0. */
  z?: Resolvable<number>;
  /** Rotation with explicit angle units [x, y, z] (Euler XYZ order). Resolved to radians at compile time. */
  rotation?: Resolvable<[SceneAngle, SceneAngle, SceneAngle]>;
  opacity?: Resolvable<number>;
  metalness?: Resolvable<number>;
  roughness?: Resolvable<number>;
  metalnessMultiplier?: Resolvable<number>;
  roughnessMultiplier?: Resolvable<number>;
  enabled?: Resolvable<boolean>;
  reset?: Resolvable<boolean>;
  /**
   * The asset type key for this model instance (e.g., 'bot', 'server').
   * Must match a key in the asset manifest models array.
   */
  type: string;
  /**
   * Unique identifier for this model instance in the runtime widget registry.
   * Must match the widget ID used when registering the ModelWidget in widgetSetup.ts.
   * Also used as the targetId in camera descriptors (e.g., <Camera targetId="bot">).
   */
  id: string;
  /** NVS x-coordinate of the model's viewport region [0, 1]. Default: 0 */
  x?: number;
  /** NVS y-coordinate of the model's viewport region [0, 1]. Default: 0 */
  y?: number;
  /** NVS width of the model's viewport region [0, 1]. Default: 1 */
  w?: number;
  /** NVS height of the model's viewport region [0, 1]. Default: 1 */
  h?: number;
  children?: ReactNode;
};

export type BodyPartProps = {
  opacity?: Resolvable<number>;
  color?: Resolvable<string>;
  metalness?: Resolvable<number>;
  roughness?: Resolvable<number>;
  reset?: Resolvable<boolean>;
  children?: ReactNode;
};

export type BodyPartByIdProps = BodyPartProps & {
  id: string;
  targetKind?: 'bone' | 'mesh';
  /** When set, this bone ID is used for pose lookups (enables unified bone+mesh component). */
  boneId?: string;
  /** When set, this mesh ID is used for material lookups (enables unified bone+mesh component). */
  meshId?: string;
};

export type PoseProps = {
  rotate?: Resolvable<AxisRotation>;
  translate?: Resolvable<AxisTranslation>;
  reset?: Resolvable<boolean>;
  // Flat shortcuts - merged into rotate/translate objects at compilation
  yawPct?: Resolvable<number>;
  pitchPct?: Resolvable<number>;
  rollPct?: Resolvable<number>;
  xPct?: Resolvable<number>;
  yPct?: Resolvable<number>;
  zPct?: Resolvable<number>;
};

export type ModelPartProps = {
  id: string;
  anchor?: string;
  space?: 'local' | 'world';
  enabled?: Resolvable<boolean>;
  opacity?: Resolvable<number>;
  scale?: Resolvable<number>;
  position?: Resolvable<[number, number, number]>;
  rotation?: Resolvable<[number, number, number]>;
  reset?: Resolvable<boolean>;
  children?: ReactNode;
};

export type ContainedModelProps = {
  modelId: string;
  position?: Resolvable<[number, number, number]>;
  rotation?: Resolvable<[number, number, number]>;
  scale?: Resolvable<number>;
  children?: ReactNode;
};

export type SubpartProps = {
  id: string;
  enabled?: Resolvable<boolean>;
  opacity?: Resolvable<number>;
  color?: Resolvable<string>;
  metalness?: Resolvable<number>;
  roughness?: Resolvable<number>;
  reset?: Resolvable<boolean>;
  children?: ReactNode;
};

export type PlaybackProps = {
  reset?: Resolvable<boolean>;
  children?: ReactNode;
};

export type MotionProps = {
  reset?: Resolvable<boolean>;
  /** Motion commands for named bone groups (e.g., gaze direction, limb overrides). */
  commands?: MotionCommand[];
  /** Time-coded motion sequences with easing. Evaluated each frame at runtime. */
  scenes?: MotionScene[];
  /** Procedural per-frame animation functions applied as an overlay layer. */
  customAnimations?: CustomAnimation[];
};

export type AnimationProps = {
  reset?: Resolvable<boolean>;
  enabled?: Resolvable<boolean>;
  clipName?: string;
  gltfUrl?: string;
  gltfClipName?: string;
  fbxUrl?: string;
  fbxClipName?: string;
  fbxRetarget?: boolean;
  fadeInSeconds?: number;
  weight?: number;
  clipStart?: number;
  clipEnd?: number;
  clipRangeUnit?: 'seconds' | 'percent';
  clipRepeat?: boolean;
  /** Apply a start offset only the first time this animation starts. */
  clipStartOnce?: number;
  /** Trim N keyframes from the start of each animation track before playback. Useful for removing a T-pose frame. */
  trimStartKeyframes?: number;
  /** Trim N keyframes from the end of each animation track before playback. */
  trimEndKeyframes?: number;
  holdStartPose?: boolean;
  allowRotation?: boolean;
  allowScale?: boolean;
};

