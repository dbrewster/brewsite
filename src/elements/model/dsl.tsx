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
  metalness?: number | ((context: unknown) => number);
  roughness?: number | ((context: unknown) => number);
  enabled?: boolean | ((context: unknown) => boolean);
  id?: string;
  children?: ReactNode;
};

export type BodyPartProps = {
  opacity?: number | ((context: unknown) => number);
  color?: string | ((context: unknown) => string);
  metalness?: number | ((context: unknown) => number);
  roughness?: number | ((context: unknown) => number);
  children?: ReactNode;
};

export type BodyPartByIdProps = BodyPartProps & {
  id: string;
};

export type PoseProps = {
  rotate?: AxisRotation | ((context: unknown) => AxisRotation);
  translate?: AxisTranslation | ((context: unknown) => AxisTranslation);
  space?: 'local' | 'world' | ((context: unknown) => 'local' | 'world');
};

export type ModelPartProps = {
  id: string;
  anchor?: string;
  enabled?: boolean | ((context: unknown) => boolean);
  opacity?: number | ((context: unknown) => number);
  scale?: number | ((context: unknown) => number);
  position?: [number, number, number] | ((context: unknown) => [number, number, number]);
  rotation?: [number, number, number] | ((context: unknown) => [number, number, number]);
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
};

export type PlaybackProps = {
  children?: ReactNode;
};

export type MotionProps = {
  commands?: unknown;
  scenes?: unknown;
  customAnimations?: unknown;
};

export type AnimationProps = {
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
  holdStartPose?: boolean;
  allowRotation?: boolean;
  allowScale?: boolean;
};

// ─── DSL Components (render as null - compilation happens in ModelWidget) ────

export const Model = (_props: ModelProps) => null;
export const BodyParts = (_props: { children?: ReactNode }) => null;
export const BodyPart = (_props: BodyPartByIdProps) => null;
export const Pose = (_props: PoseProps) => null;
export const ModelPart = (_props: ModelPartProps) => null;
export const ContainedModel = (_props: ContainedModelProps) => null;
export const Subpart = (_props: SubpartProps) => null;
export const Playback = (_props: PlaybackProps) => null;
export const Motion = (_props: MotionProps) => null;
export const Animation = (_props: AnimationProps) => null;
