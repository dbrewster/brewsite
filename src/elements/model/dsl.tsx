/**
 * Model element DSL - React components for scene authoring.
 */

import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';
import type {
  BodyPartOverride,
  BodyPartOverrideMap,
  AxisRotation,
  AxisTranslation,
  ModelPose,
  PoseGroup,
  SceneModel,
  ScenePlayback,
} from './types';

// ─── DSL Component Props ─────────────────────────────────────────────────────

export type ModelProps = {
  scale?: number | ((context: unknown) => number);
  position?: [number, number, number] | ((context: unknown) => [number, number, number]);
  rotation?: [number, number, number] | ((context: unknown) => [number, number, number]);
  opacity?: number | ((context: unknown) => number);
  metalness?: number | ((context: unknown) => number);
  roughness?: number | ((context: unknown) => number);
  enabled?: boolean | ((context: unknown) => boolean);
  reset?: boolean | ((context: unknown) => boolean);
  type: string;
  id: string;
  children?: ReactNode;
};

export type BodyPartProps = {
  opacity?: number | ((context: unknown) => number);
  color?: string | ((context: unknown) => string);
  metalness?: number | ((context: unknown) => number);
  roughness?: number | ((context: unknown) => number);
  reset?: boolean | ((context: unknown) => boolean);
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
  rotate?: AxisRotation | ((context: unknown) => AxisRotation);
  translate?: AxisTranslation | ((context: unknown) => AxisTranslation);
  reset?: boolean | ((context: unknown) => boolean);
  // Flat shortcuts — merged into rotate/translate objects at compilation
  yawPct?: number | ((context: unknown) => number);
  pitchPct?: number | ((context: unknown) => number);
  rollPct?: number | ((context: unknown) => number);
  xPct?: number | ((context: unknown) => number);
  yPct?: number | ((context: unknown) => number);
  zPct?: number | ((context: unknown) => number);
};

export type ModelPartProps = {
  id: string;
  anchor?: string;
  space?: 'local' | 'world';
  enabled?: boolean | ((context: unknown) => boolean);
  opacity?: number | ((context: unknown) => number);
  scale?: number | ((context: unknown) => number);
  position?: [number, number, number] | ((context: unknown) => [number, number, number]);
  rotation?: [number, number, number] | ((context: unknown) => [number, number, number]);
  reset?: boolean | ((context: unknown) => boolean);
  children?: ReactNode;
};

export type ContainedModelProps = {
  modelId: string;
  position?: [number, number, number] | ((context: unknown) => [number, number, number]);
  rotation?: [number, number, number] | ((context: unknown) => [number, number, number]);
  scale?: number | ((context: unknown) => number);
  children?: ReactNode;
};

export type SubpartProps = {
  id: string;
  enabled?: boolean | ((context: unknown) => boolean);
  opacity?: number | ((context: unknown) => number);
  color?: string | ((context: unknown) => string);
  metalness?: number | ((context: unknown) => number);
  roughness?: number | ((context: unknown) => number);
  reset?: boolean | ((context: unknown) => boolean);
  children?: ReactNode;
};

export type PlaybackProps = {
  reset?: boolean | ((context: unknown) => boolean);
  children?: ReactNode;
};

export type MotionProps = {
  reset?: boolean | ((context: unknown) => boolean);
  commands?: unknown;
  scenes?: unknown;
  customAnimations?: unknown;
};

export type AnimationProps = {
  reset?: boolean;
  enabled?: boolean;
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
  holdStartPose?: boolean;
  allowRotation?: boolean;
  allowScale?: boolean;
};

// ─── DSL Components (render as null - compilation happens in ModelWidget) ────

export const Model = (_props: ModelProps) => null;
export const ModelRouter = (_props: ModelProps) => null;
export const BodyParts = (_props: { children?: ReactNode }) => null;
export const BodyPart = (_props: BodyPartByIdProps) => null;
export const Pose = (_props: PoseProps) => null;
export const ModelPart = (_props: ModelPartProps) => null;
export const ContainedModel = (_props: ContainedModelProps) => null;
export const Subpart = (_props: SubpartProps) => null;
export const Playback = (_props: PlaybackProps) => null;
export const Motion = (_props: MotionProps) => null;
export const Animation = (_props: AnimationProps) => null;
