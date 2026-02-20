import {Children, Fragment, isValidElement, type ReactElement, type ReactNode} from 'react';
import {createBaseSceneState} from './sceneDefaults';
import type {SceneFrameContext, SceneFrameState, SceneTransition} from './sceneTypes';
import {getNodeHandler, isPrimitiveComponent} from './registry';
import type {CompileApi, CompileHelpers, NodeHandler} from './sceneDslTypes';
import './primitives';

export type ResolvedScene = {
  frame: SceneFrameState;
  transitions: SceneTransition[];
};

const resolveValue = <T,>(value: T | ((context: SceneFrameContext) => T), context: SceneFrameContext): T =>
  typeof value === 'function' ? (value as (ctx: SceneFrameContext) => T)(context) : value;

const resolveObjectValues = <T extends Record<string, unknown>>(value: T, context: SceneFrameContext): T => {
  const entries = Object.entries(value).map(([key, entry]) => {
    if (typeof entry === 'function') {
      return [key, (entry as (ctx: SceneFrameContext) => unknown)(context)];
    }
    if (Array.isArray(entry)) {
      return [key, entry.map((item) => (typeof item === 'function' ? (item as (ctx: SceneFrameContext) => unknown)(context) : item))];
    }
    if (entry && typeof entry === 'object') {
      return [key, resolveObjectValues(entry as Record<string, unknown>, context)];
    }
    return [key, entry];
  });
  return Object.fromEntries(entries) as T;
};

const stripUndefinedDeep = <T extends Record<string, unknown>>(value: T): T => {
  const entries = Object.entries(value).flatMap(([key, entry]) => {
    if (entry === undefined) return [];
    if (Array.isArray(entry)) {
      return [[key, entry]];
    }
    if (entry && typeof entry === 'object') {
      const cleaned = stripUndefinedDeep(entry as Record<string, unknown>);
      if (Object.keys(cleaned).length === 0) return [];
      return [[key, cleaned]];
    }
    return [[key, entry]];
  });
  return Object.fromEntries(entries) as T;
};

const expandNode = (node: unknown): unknown[] => {
  if (!isValidElement(node)) return [node];
  const element = node as ReactElement;
  const props = element.props as { children?: ReactNode } & Record<string, unknown>;
  if (element.type === Fragment) {
    return Children.toArray(props.children).flatMap(expandNode);
  }
  if (typeof element.type === 'function' && !isPrimitiveComponent(element.type)) {
    const next = (element.type as (props: Record<string, unknown>) => unknown)(props);
    return expandNode(next);
  }
  return [node];
};

const collectChildren = (node: ReactElement): unknown[] =>
  Children.toArray(isValidElement(node) ? (node.props as { children?: ReactNode }).children : []).flatMap(expandNode);

const helpers: CompileHelpers = {
  compileChildren: (node, api) => {
    const children = collectChildren(node);
    for (const child of children) {
      if (!isValidElement(child)) continue;
      const childEl = child as ReactElement;
      const handler = getNodeHandler(childEl.type);
      if (handler) {
        handler(childEl, api, helpers);
        continue;
      }
      if (typeof childEl.type === 'function') {
        const expanded = expandNode(childEl);
        for (const next of expanded) {
          if (isValidElement(next)) {
            const nextEl = next as ReactElement;
            const nextHandler = getNodeHandler(nextEl.type);
            if (nextHandler) nextHandler(nextEl, api, helpers);
          }
        }
      }
    }
  },
  resolveValue,
  resolveObjectValues,
  stripUndefinedDeep,
  collectChildren,
};

const createApi = (context: SceneFrameContext): CompileApi => {
  const state: SceneFrameState = createBaseSceneState(context);
  return {
    context,
    state,
    transitions: [],
    annotations: [],
    pushAnnotation: (annotation) => {
      state.annotations = state.annotations ?? [];
      state.annotations.push(annotation);
    },
    setLighting: (lighting) => {
      state.lighting = { ...state.lighting, ...lighting };
    },
    setRibbon: (ribbon) => {
      state.ribbon = { ...state.ribbon, ...ribbon };
    },
    setModelInstance: (id, instance) => {
      if (!state.models) state.models = {};
      state.models[id] = instance;
    },
    setSceneMeta: (meta) => {
      if (meta.id) state.id = meta.id;
      if (typeof meta.isLightScene === 'boolean') state.isLightScene = meta.isLightScene;
    },
  };
};

export const resolveSceneFromDsl = (tree: unknown, context: SceneFrameContext): ResolvedScene => {
  if (!isValidElement(tree)) {
    throw new Error('Scene DSL must return a JSX element.');
  }
  const treeEl = tree as ReactElement;
  const api = createApi(context);
  const handler = getNodeHandler(treeEl.type) as NodeHandler | undefined;
  if (!handler) {
    throw new Error('Scene DSL root must be <Scene>.');
  }
  handler(treeEl, api, helpers);

  api.state.id = api.state.id ?? 'scene';
  api.state.scrollProgress = context.sceneProgress;

  return {
    frame: api.state,
    transitions: api.transitions,
  };
};
