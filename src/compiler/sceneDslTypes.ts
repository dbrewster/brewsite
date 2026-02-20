import type { ReactElement } from 'react';
import type { SceneFrameContext, SceneTransition } from './sceneTypes';
import type { SceneFrame } from './sceneTrackTypes';
import type { AnnotationDefinition } from '../annotations/annotationTypes';
import type { LabelDefinition } from '../labels/types';
import type { JsonPrimitive } from '../widget/VariableStore';

export type CompileApi = {
  context: SceneFrameContext;
  state: SceneFrame;
  transitions: SceneTransition[];
  pushAnnotation: (annotation: AnnotationDefinition) => void;
  pushLabel: (label: LabelDefinition) => void;
  setWidgetState: (widgetId: string, state: unknown) => void;
  setSceneMeta: (meta: { id?: string; meta?: Record<string, JsonPrimitive> }) => void;
};

export type CompileHelpers = {
  compileChildren: (node: ReactElement, api: CompileApi) => void;
  resolveValue: <T>(value: T | ((context: SceneFrameContext) => T), context: SceneFrameContext) => T;
  resolveObjectValues: <T extends Record<string, unknown>>(value: T, context: SceneFrameContext) => T;
  stripUndefinedDeep: <T extends Record<string, unknown>>(value: T) => T;
  collectChildren: (node: ReactElement) => unknown[];
};

export type NodeHandler = (
  node: ReactElement,
  api: CompileApi,
  helpers: CompileHelpers,
) => void;
