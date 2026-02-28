import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { SceneSnapshotContext } from './sceneTypes';
import { getNodeHandler, isPrimitiveComponent, registerNode } from './registry';
import type { CompileApi, CompileHelpers, NodeHandler } from './sceneDslTypes';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { JsonPrimitive } from '../widget/VariableStore';
import type { SceneFrame } from './sceneTrackTypes';
import { ensureInputControllerRegistry } from './blocks/inputController';

export type ResolvedScene = {
  frame: SceneFrame;
};

const resolveValue = <T,>(value: T | ((context: SceneSnapshotContext) => T), context: SceneSnapshotContext): T =>
  typeof value === 'function' ? (value as (ctx: SceneSnapshotContext) => T)(context) : value;

const resolveObjectValues = <T extends Record<string, unknown>>(value: T, context: SceneSnapshotContext): T => {
  const entries = Object.entries(value).map(([key, entry]) => {
    if (typeof entry === 'function') {
      return [key, (entry as (ctx: SceneSnapshotContext) => unknown)(context)];
    }
    if (Array.isArray(entry)) {
      return [
        key,
        entry.map((item) =>
          typeof item === 'function' ? (item as (ctx: SceneSnapshotContext) => unknown)(context) : item,
        ),
      ];
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
  Children.toArray(isValidElement(node) ? (node.props as { children?: ReactNode }).children : []).flatMap(
    expandNode,
  );

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

const createApi = (context: SceneSnapshotContext): CompileApi => {
  const state: SceneFrame = {
    id: '',
    scrollProgress: 0,
    widgets: {},
  };
  return {
    context,
    state,
    pushHudItem: (item) => {
      state.hudItems = state.hudItems ?? [];
      state.hudItems.push(item);
    },
    pushLabel: (label) => {
      state.labels = state.labels ?? [];
      state.labels.push(label);
    },
    setWidgetState: (widgetId, widgetState) => {
      state.widgets[widgetId] = widgetState;
    },
    setSceneMeta: (meta) => {
      if (meta.id) state.id = meta.id;
      if (meta.meta) state.meta = meta.meta;
    },
  };
};

// Register Scene root handler
export const Scene = (_props: {
  id?: string;
  meta?: Record<string, JsonPrimitive>;
  metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  children?: React.ReactNode;
}) => null;
Scene.displayName = 'Scene';

const sceneRootHandler: NodeHandler = (node, api, helpers) => {
  const props = node.props as {
    id?: string;
    meta?: Record<string, JsonPrimitive>;
    metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
    roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  };
  const sceneId = node.key ?? props.id ?? null;
  if (sceneId === null) {
    console.warn(
      '[ScenePlayer] A <Scene> element has no key or id. ' +
      'Assign key="..." for stable scene identity.',
    );
  }
  if (sceneId) api.setSceneMeta({ id: String(sceneId) });
  if (props.meta) api.setSceneMeta({ meta: props.meta });
  if (props.metalnessMultiplier !== undefined) {
    api.state.materialMetalnessMultiplier = helpers.resolveValue(props.metalnessMultiplier, api.context);
  }
  if (props.roughnessMultiplier !== undefined) {
    api.state.materialRoughnessMultiplier = helpers.resolveValue(props.roughnessMultiplier, api.context);
  }
  helpers.compileChildren(node, api);
};

export const ensureSceneRegistry = (): void => {
  ensureInputControllerRegistry();
  if (!getNodeHandler(Scene)) {
    registerNode(Scene, sceneRootHandler);
  }
};

ensureInputControllerRegistry();
registerNode(Scene, sceneRootHandler);

export const resolveSceneFromDsl = (
  tree: unknown,
  context: SceneSnapshotContext,
  widgetRegistry: WidgetRegistry,
): ResolvedScene => {
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

  api.state.id = api.state.id || 'scene';
  api.state.scrollProgress = 0;

  return {
    frame: api.state,
  };
};
