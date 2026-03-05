/**
 * Model element types - state and animation contracts.
 *
 * This file contains purely TypeScript types and interfaces.
 * No React, no Three.js, no runtime logic.
 */

import type { Vec3, NVSRect } from '@brewsite/core';
export type { Vec3 } from '@brewsite/core';
export type { NVSRect } from '@brewsite/core';

// ─── ClipMeta — defined locally in @brewsite/model (moved from @brewsite/core Phase 4) ──

/** Metadata about a single animation clip. */
export type ClipMeta = {
  name: string;
  duration: number;
  clipStart?: number;
  clipEnd?: number;
};

// ─── Model parts (nested model attachments) ──────────────────────────────────

export type ModelPartId = string;
export type ModelPartAnchor = string;
export type ModelSubpartId = string;

export type ModelSubpartSpec = {
  id: ModelSubpartId;
  enabled?: boolean;
  opacity?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
  reset?: boolean;
};

export type ModelPartSpec = {
  id: ModelPartId;
  anchor: ModelPartAnchor;
  enabled: boolean;
  space?: 'local' | 'world';
  position: Vec3;
  rotation: Vec3;
  scale: number;
  containedPosition?: Vec3;
  containedRotation?: Vec3;
  containedScale?: number;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  modelId?: string;
  subparts?: Partial<Record<ModelSubpartId, ModelSubpartSpec>>;
  reset?: boolean;
};

export type ModelPartOverrides = Partial<Record<ModelPartId, Partial<ModelPartSpec>>>;

// ─── Body part overrides ─────────────────────────────────────────────────────

export type BodyPartOverride = {
  opacity?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
  targetKind?: 'bone' | 'mesh';
  pose?: PoseGroup;
  reset?: boolean;
  poseReset?: boolean;
  /** When set, this mesh ID is used for material lookups instead of the map key. */
  meshId?: string;
  /** When set, this bone ID is used for pose lookups instead of the map key. */
  boneId?: string;
};

export type BodyPartOverrideMap = Partial<Record<string, BodyPartOverride>>;

// ─── Motion (renamed from Robot* types) ──────────────────────────────────────

export type AxisRotation = {
  yawPct?: number;
  pitchPct?: number;
  rollPct?: number;
};

export type AxisTranslation = {
  xPct?: number;
  yPct?: number;
  zPct?: number;
};

export type MotionCommand = {
  groupId: string;
  rotate?: AxisRotation;
  translate?: AxisTranslation;
  weight?: number;
  space?: 'local' | 'world';
};

export type PoseGroup = {
  rotate?: AxisRotation;
  translate?: AxisTranslation;
  reset?: boolean;
};

export type ModelPose = {
  mode?: 'override' | 'add';
  groups: Partial<Record<string, PoseGroup>>;
};

export type MotionScene = {
  id: string;
  start: number;
  end: number;
  ease?: (t: number) => number;
  commands: MotionCommand[] | ((t: number, timeSeconds: number) => MotionCommand[]);
  holdAtEnd?: boolean;
};

export type MotionGroupLimits = {
  yaw: number;
  pitch: number;
  roll: number;
  x?: number;
  y?: number;
  z?: number;
};

export type CustomAnimationContext = {
  tickTimeSeconds: number;
  wallTimeSeconds: number;
  sceneProgress: number;
  globalProgress: number;
  getBaseTransform: (name: string) => { position: Vec3; rotation: Vec3; scale: Vec3 } | null;
};

export type CustomAnimationOp = {
  targetName: string;
  type: 'rotation' | 'position' | 'scale';
  value: Vec3;
  mode?: 'add' | 'set';
  weight?: number;
};

export type CustomAnimation = {
  id: string;
  enabled: boolean;
  layer?: 'base' | 'overlay';
  weight?: number;
  apply: (context: CustomAnimationContext) => CustomAnimationOp[];
};

export type SceneMotion = {
  commands: MotionCommand[];
  scenes: MotionScene[];
  customAnimations?: CustomAnimation[];
  pose?: ModelPose;
  reset?: boolean;
};

// ─── Animation (clip playback) ───────────────────────────────────────────────

export type SceneAnimation = {
  enabled: boolean;
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
  /** Trim N keyframes from the start of each track before playback. */
  trimStartKeyframes?: number;
  /** Trim N keyframes from the end of each track before playback. */
  trimEndKeyframes?: number;
  holdStartPose?: boolean;
  allowRotation?: boolean;
  allowScale?: boolean;
  reset?: boolean;
};

// ─── Playback (motion + animation) ──────────────────────────────────────────

export type ScenePlayback = {
  motion: SceneMotion;
  animation: SceneAnimation;
  reset?: boolean;
};

// ─── Model base state ───────────────────────────────────────────────────────

export type SceneModel = {
  scale: number;
  position: Vec3;
  rotation: Vec3;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  metalnessMultiplier?: number;
  roughnessMultiplier?: number;
  bodyPartOverrides?: BodyPartOverrideMap;
  parts?: Record<ModelPartId, ModelPartSpec>;
  enabled?: boolean;
  reset?: boolean;
};

// ─── Instance state (the main state type for ModelWidget) ────────────────────

export type SceneModelInstanceState = {
  model: SceneModel;
  playback: ScenePlayback;
  enabled?: boolean;
  /** Label definitions authored for this model instance. Compiled per scene. */
  labels?: import('../../labels/types').LabelResolved[];
  /**
   * NVS bounds declaring what region of the AR-locked container this model occupies.
   * Fullscreen is { x: 0, y: 0, w: 1, h: 1 }. Required — always filled by compile step.
   */
  nvsBounds: NVSRect;
};
