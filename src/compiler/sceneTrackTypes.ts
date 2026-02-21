import type { AnnotationDefinition, AnnotationDefaults } from '../annotations/annotationTypes';
import type { LabelDefinition } from '../labels/types';
import type { JsonPrimitive } from '../widget/VariableStore';

// Re-export annotation types
export type { AnnotationResolved } from '../annotations/annotationTypes';
export type { LabelResolved } from '../labels/types';

// ─── ClipMeta — lives here so the compiler has no element dependency ──────────

/** Metadata about a single animation clip, used in CompileExtraContext. */
export type ClipMeta = {
  name: string;
  duration: number;
};

export type SceneFrame = {
  id: string;
  scrollProgress: number;
  widgets: Record<string, unknown>;
  meta?: Record<string, JsonPrimitive>;
  annotations?: AnnotationDefinition[];
  annotationDefaults?: Partial<AnnotationDefaults>;
  labels?: LabelDefinition[];
};

export type SceneFrameDelta = {
  widgets?: Record<string, unknown>;
  annotations?: SceneFrame['annotations'];
  annotationDefaults?: SceneFrame['annotationDefaults'];
  labels?: SceneFrame['labels'];
};

export type SceneWindow = {
  id: string;
  index: number;
  start: number;
  end: number;
};

export type SceneTrackTick = {
  index: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  blockProgress: number;
  state: SceneFrame;
  annotationPrimitives?: import('../annotations/annotationTypes').AnnotationResolved[];
  labelPrimitives?: import('../labels/types').LabelResolved[];
  deltaForward: SceneFrameDelta;
  deltaBackward: SceneFrameDelta;
  widgetExtras?: Record<string, unknown>;
};

export type SceneTrack = {
  ticks: SceneTrackTick[];
  tickStep: number;
  subTickCount: number;
  sceneWindows: SceneWindow[];
};
