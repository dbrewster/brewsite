/**
 * Model element types - state and animation contracts.
 *
 * This file contains purely TypeScript types and interfaces.
 * No React, no Three.js, no runtime logic.
 */

export type Vec3 = [number, number, number];

// ─── Metadata — re-exported from compiler so the compiler has no element dep ──

/** Metadata about a single animation clip. */
export type { ClipMeta } from '../../compiler/sceneTrackTypes';

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
  metalness?: number;
  roughness?: number;
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
};
