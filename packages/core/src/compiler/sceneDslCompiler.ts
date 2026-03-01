import React, {
  Children,
  Fragment,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { SceneSnapshotContext } from './sceneTypes';
import { getNodeHandler, isPrimitiveComponent } from './registry';
import type { CompileApi, CompileHelpers, NodeHandler } from './sceneDslTypes';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { JsonPrimitive } from '../widget/VariableStore';
import type { CompileWarning, SceneFrame } from './sceneTrackTypes';
import type { EasingName } from './transitions/easingFunctions';
import { SceneRegistrationContext } from './SceneRegistrationContext';
// registerCoreHandlers is imported via circular reference (safe — only used inside functions,
// not at module scope; see the comment above ensureSceneRegistry for details).
import { registerCoreHandlers } from './coreHandlers';

export type ResolvedScene = {
  frame: SceneFrame;
};

const resolveValue = <T,>(value: T | ((context: SceneSnapshotContext) => T), context: SceneSnapshotContext): T =>
  typeof value === 'function' ? (value as (ctx: SceneSnapshotContext) => T)(context) : value;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const resolveObjectValues = <T extends Record<string, unknown>>(
  value: T,
  context: SceneSnapshotContext,
  seen = new WeakSet<object>(),
): T => {
  if (seen.has(value)) return value;
  seen.add(value);

  const entries = Object.entries(value).map(([key, entry]) => {
    if (typeof entry === 'function') {
      return [key, (entry as (ctx: SceneSnapshotContext) => unknown)(context)];
    }
    if (Array.isArray(entry)) {
      return [
        key,
        entry.map((item) =>
          typeof item === 'function'
            ? (item as (ctx: SceneSnapshotContext) => unknown)(context)
            : isPlainObject(item)
              ? resolveObjectValues(item, context, seen)
              : item,
        ),
      ];
    }
    if (isValidElement(entry)) {
      return [key, entry];
    }
    if (isPlainObject(entry)) {
      return [key, resolveObjectValues(entry, context, seen)];
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

  compileChildrenSeparated: (node, api): ReactNode[] => {
    const children = collectChildren(node);
    const overlayNodes: ReactNode[] = [];

    for (const child of children) {
      if (!isValidElement(child)) {
        // Text nodes, numbers, booleans — treat as overlay content
        if (child !== null && child !== undefined && child !== false) {
          overlayNodes.push(child as ReactNode);
        }
        continue;
      }
      const childEl = child as ReactElement;

      // String type = native HTML element (div, h1, p, span, etc.) → overlay
      if (typeof childEl.type === 'string') {
        overlayNodes.push(childEl);
        continue;
      }

      // Registered DSL component → compile as normal
      const handler = getNodeHandler(childEl.type);
      if (handler) {
        handler(childEl, api, helpers);
        continue;
      }

      // Non-registered function component → try expanding
      if (typeof childEl.type === 'function' && !isPrimitiveComponent(childEl.type)) {
        const expanded = expandNode(childEl);
        let anyCompiled = false;
        // Collect HTML nodes found during expansion separately before committing them.
        // This avoids the double-push bug: if a component renders only HTML (no DSL),
        // anyCompiled stays false AND the individual HTML nodes would already be in
        // overlayNodes — then the whole-component fallback would push childEl on top,
        // rendering the content twice. Using pendingHtml as a staging area prevents this.
        const pendingHtml: ReactNode[] = [];
        for (const next of expanded) {
          if (isValidElement(next)) {
            const nextEl = next as ReactElement;
            const nextHandler = getNodeHandler(nextEl.type);
            if (nextHandler) {
              nextHandler(nextEl, api, helpers);
              anyCompiled = true;
            } else if (typeof nextEl.type === 'string') {
              // HTML inside expanded component — stage, don't commit yet
              pendingHtml.push(nextEl);
            }
          }
        }
        if (anyCompiled) {
          // Mixed component: DSL parts compiled, HTML parts become overlay
          overlayNodes.push(...pendingHtml);
        } else if (pendingHtml.length > 0) {
          // HTML-only expansion: use the individual collected nodes (not the wrapper)
          overlayNodes.push(...pendingHtml);
        } else {
          // No expansion yield at all: treat whole element as overlay
          overlayNodes.push(childEl);
        }
      }
    }

    return overlayNodes;
  },

  resolveValue,
  resolveObjectValues,
  stripUndefinedDeep,
  collectChildren,
};

const createApi = (
  context: SceneSnapshotContext,
  pushWarning?: (warning: CompileWarning) => void,
): CompileApi => {
  const state: SceneFrame = {
    id: '',
    scrollProgress: 0,
    widgets: {},
  };
  return {
    context,
    state,
    setWidgetState: (widgetId, widgetState) => {
      state.widgets[widgetId] = widgetState;
    },
    setSceneMeta: (meta) => {
      if (meta.id) state.id = meta.id;
      if (meta.meta) state.meta = meta.meta;
    },
    pushWarning: (warning) => {
      pushWarning?.(warning);
    },
  };
};

// Register Scene root handler
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const Scene = (props: {
  id: string;
  meta?: Record<string, JsonPrimitive>;
  /**
   * Multiplier applied to base metalness for all model materials in this scene.
   */
  metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  /**
   * Multiplier applied to base roughness for all model materials in this scene.
   */
  roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  /**
   * Easing curve for the transition into this scene.
   * Only affects widgets using FunctionalTransitionSpec. Widgets using
   * ElementTransitionSpec use pre-baked transition interpolation.
   */
  transition?: { easing?: EasingName };
  children?: React.ReactNode;
}): null => {
  const registration = useContext(SceneRegistrationContext);
  const element = React.createElement(Scene, props);

  useIsomorphicLayoutEffect(() => {
    registration?.register(props.id, element);
    return () => registration?.unregister(props.id);
  });

  return null;
};
Scene.displayName = 'Scene';

export const sceneRootHandler: NodeHandler = (node, api, helpers) => {
  const props = node.props as {
    id?: string;
    meta?: Record<string, JsonPrimitive>;
    metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
    roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
    transition?: { easing?: EasingName };
  };
  // Children.toArray() prefixes keys with ".$" (e.g. "arch-auto" -> ".$arch-auto").
  // Strip the prefix defensively for any direct-element fallback path.
  const rawKey = typeof node.key === 'string' && node.key.startsWith('.$')
    ? node.key.slice(2)
    : node.key;
  const sceneId = props.id ?? rawKey ?? null;
  if (sceneId === null) {
    console.warn(
      '[ScenePlayer] A <Scene> element has no id. ' +
      'Assign id="..." to every <Scene> for stable scene identity.',
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
  if (props.transition?.easing) {
    api.state.transitionEasing = props.transition.easing;
  }

  // Separate DSL children (compiled into api.state) from non-DSL overlay children
  const overlayNodes = helpers.compileChildrenSeparated(node, api);

  if (overlayNodes.length > 0) {
    api.state.sceneOverlay = overlayNodes.length === 1
      ? overlayNodes[0]
      : React.createElement(React.Fragment, null, ...overlayNodes);
  }
};

// Keep ensureSceneRegistry for backward compatibility — delegates to registerCoreHandlers.
// The circular import (sceneDslCompiler → coreHandlers → sceneDslCompiler) is safe because
// coreHandlers.ts only accesses Scene and sceneRootHandler inside registerCoreHandlers(),
// not at module scope. By the time any caller invokes ensureSceneRegistry(), both modules
// are fully evaluated and all live bindings are resolved.
export const ensureSceneRegistry = (): void => {
  registerCoreHandlers();
};

// NOTE: Module-scope auto-registration removed.
// registerCoreHandlers() in coreHandlers.ts handles all registrations.
// Called by EngineProvider, ScenePlayer, or corePlugin().registerHandlers().

export const resolveSceneFromDsl = (
  tree: unknown,
  context: SceneSnapshotContext,
  widgetRegistry: WidgetRegistry,
  pushWarning?: (warning: CompileWarning) => void,
): ResolvedScene => {
  // Ensure core handlers are registered before attempting DSL compilation.
  // This is a backward-compat fallback for tests and direct callers that don't
  // go through corePlugin().registerHandlers() or EngineProvider.
  // In production, plugins register handlers explicitly before compilation.
  ensureSceneRegistry();

  const describeValueType = (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };
  const describeElementType = (elementType: ReactElement['type']): string => {
    if (typeof elementType === 'string') return elementType;
    if (typeof elementType === 'function') {
      const component = elementType as ((props: unknown) => unknown) & { displayName?: string };
      return component.displayName ?? component.name ?? 'anonymous';
    }
    return 'unknown';
  };

  if (!isValidElement(tree)) {
    throw new Error(
      `Scene DSL must return a JSX element (got: ${describeValueType(tree)}). ` +
      'Ensure getFrame() has a return statement returning <Scene>.',
    );
  }
  const treeEl = tree as ReactElement;
  const api = createApi(context, pushWarning);
  const handler = getNodeHandler(treeEl.type) as NodeHandler | undefined;
  if (!handler) {
    throw new Error(
      `Scene DSL root must be <Scene> (got: <${describeElementType(treeEl.type)}>). ` +
      'Wrap your content in <Scene id="...">.',
    );
  }
  handler(treeEl, api, helpers);

  api.state.id = api.state.id || 'scene';
  api.state.scrollProgress = 0;

  return {
    frame: api.state,
  };
};
