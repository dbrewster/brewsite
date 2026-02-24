import type { ReactElement } from 'react';
import type { SceneSnapshotContext } from './sceneTypes';
import type { SceneFrame } from './sceneTrackTypes';
import type { AnnotationDefinition } from '../annotations/annotationTypes';
import type { LabelResolved } from '../labels/types';
import type { JsonPrimitive } from '../widget/VariableStore';

export type CompileApi = {
  context: SceneSnapshotContext;
  state: SceneFrame;
  pushAnnotation: (annotation: AnnotationDefinition) => void;
  pushLabel: (label: LabelResolved) => void;
  setWidgetState: (widgetId: string, state: unknown) => void;
  setSceneMeta: (meta: { id?: string; meta?: Record<string, JsonPrimitive> }) => void;
};

export type CompileHelpers = {
  compileChildren: (node: ReactElement, api: CompileApi) => void;
  resolveValue: <T>(value: T | ((context: SceneSnapshotContext) => T), context: SceneSnapshotContext) => T;
  resolveObjectValues: <T extends Record<string, unknown>>(value: T, context: SceneSnapshotContext) => T;
  stripUndefinedDeep: <T extends Record<string, unknown>>(value: T) => T;
  collectChildren: (node: ReactElement) => unknown[];
};

export type NodeHandler = (
  node: ReactElement,
  api: CompileApi,
  helpers: CompileHelpers,
) => void;
