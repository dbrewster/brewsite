import type {ReactElement} from 'react';
import type {SceneFrameContext, SceneFrameState, SceneTransition} from './sceneTypes';
import type {AnnotationDefinition} from '../../annotations/annotationTypes';
import type {SceneLighting} from '../../model/robotSceneTypes';

export type CompileApi = {
  context: SceneFrameContext;
  state: SceneFrameState;
  transitions: SceneTransition[];
  annotations: AnnotationDefinition[];
  pushAnnotation: (annotation: AnnotationDefinition) => void;
  setLighting: (lighting: SceneLighting) => void;
  setRibbon: (ribbon: SceneFrameState['ribbon']) => void;
  setModelInstance: (id: string, instance: NonNullable<SceneFrameState['models']>[string]) => void;
  setSceneMeta: (meta: { id?: string; isLightScene?: boolean }) => void;
};

export type CompileHelpers = {
  compileChildren: (node: ReactElement, api: CompileApi) => void;
  resolveValue: <T>(value: T | ((context: SceneFrameContext) => T), context: SceneFrameContext) => T;
  resolveObjectValues: <T extends Record<string, unknown>>(value: T, context: SceneFrameContext) => T;
  stripUndefinedDeep: <T extends Record<string, unknown>>(value: T) => T;
  collectChildren: (node: ReactElement) => unknown[];
};

export type NodeHandler = (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => void;
