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
import type { NVSRect } from '../layout/types';
import { composeBoundsIntoParent } from '../layout/regionNormalize';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { JsonPrimitive } from '../widget/VariableStore';
import type { CompileWarning, DslBreadcrumb, SceneFrame, TransitionWindow } from './sceneTrackTypes';
import { resolveSceneTransition } from './transitions/transitionPresets';
import type { SceneTransitionProp } from './transitions/transitionPresets';
import { SceneRegistrationContext } from './SceneRegistrationContext';
// registerCoreHandlers is imported via circular reference (safe — only used inside functions,
// not at module scope; see the comment above ensureSceneRegistry for details).
import { registerCoreHandlers } from './coreHandlers';
import { buildBreadcrumb, formatBreadcrumbChain, getComponentName } from './dslSourceInfo';

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
    let next: unknown;
    try {
      next = (element.type as (props: Record<string, unknown>) => unknown)(props);
    } catch {
      // DEBT: Route through api.pushWarning for structured diagnostics
      // Component cannot be called outside React render (e.g., it uses hooks, context,
      // or other React-only APIs). Treat it as opaque overlay content — preserve the
      // element as-is so EngineOverlayHost renders it correctly in the React tree.
      return [node];
    }
    return expandNode(next);
  }
  return [node];
};

const collectChildren = (node: ReactElement): unknown[] =>
  Children.toArray(isValidElement(node) ? (node.props as { children?: ReactNode }).children : []).flatMap(
    expandNode,
  );

/**
 * Like `collectChildren`, but only unwraps React Fragments — does NOT call
 * function components. Used by `compileChildrenSeparated` so that non-registered
 * function components (e.g. `<TextBox>`) are preserved as opaque React elements
 * with their original `key` prop intact, rather than being unwrapped into their
 * rendered HTML output (which has no `key`).
 */
const collectChildrenShallow = (node: ReactElement): unknown[] => {
  const expandShallow = (n: unknown): unknown[] => {
    if (!isValidElement(n)) return [n];
    const el = n as ReactElement;
    if (el.type === Fragment) {
      return Children.toArray((el.props as { children?: ReactNode }).children).flatMap(expandShallow);
    }
    return [n];
  };
  return Children.toArray(
    isValidElement(node) ? (node.props as { children?: ReactNode }).children : [],
  ).flatMap(expandShallow);
};

function createHelpers(): { helpers: CompileHelpers; getBreadcrumbs: () => readonly DslBreadcrumb[] } {
  const stack: DslBreadcrumb[] = [];

  const helpers: CompileHelpers = {
    compileChildren: (node, api) => {
      const crumb = buildBreadcrumb(node);
      stack.push(crumb);
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
      stack.pop();
    },

    compileChildrenSeparated: (node, api): ReactNode[] => {
      const crumb = buildBreadcrumb(node);
      stack.push(crumb);
      // Use shallow collection so non-registered function components (e.g. <TextBox>)
      // are preserved with their key props rather than being pre-expanded to keyless HTML.
      const children = collectChildrenShallow(node);
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
          // After Children.toArray, developer-supplied keys are prefixed with '.$'.
          // A key NOT starting with '.$' means the element had no key in the source.
          if (process.env.NODE_ENV !== 'production' && !childEl.key?.startsWith('.$')) {
            api.pushWarning({
              code: 'MISSING_KEY',
              message:
                `An overlay element <${getComponentName(childEl)}> has no key. ` +
                'Add a key prop to prevent React reconciliation warnings. ' +
                `Ancestry: ${formatBreadcrumbChain([...stack])}`,
              sceneIndex: api.context.sceneIndex,
            });
          }
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
          } else {
            // No DSL output (HTML-only expansion or no yield at all):
            // Preserve the original element so its key prop survives to the render phase.
            // React will call the component normally when EngineOverlayHost renders it.
            // After Children.toArray, developer-supplied keys are prefixed with '.$'.
            // A key NOT starting with '.$' means the element had no key in the source.
            if (process.env.NODE_ENV !== 'production' && !childEl.key?.startsWith('.$')) {
              api.pushWarning({
                code: 'MISSING_KEY',
                message:
                  `An overlay element <${getComponentName(childEl)}> has no key. ` +
                  'Add a key prop to prevent React reconciliation warnings. ' +
                  `Ancestry: ${formatBreadcrumbChain([...stack])}`,
                sceneIndex: api.context.sceneIndex,
              });
            }
            overlayNodes.push(childEl);
          }
        }
      }

      stack.pop();
      return overlayNodes;
    },

    resolveValue,
    resolveObjectValues,
    stripUndefinedDeep,
    collectChildren,
  };

  return { helpers, getBreadcrumbs: () => [...stack] };
}

const createApi = (
  context: SceneSnapshotContext,
  pushWarning?: (warning: CompileWarning) => void,
  getBreadcrumbs?: () => readonly DslBreadcrumb[],
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
      const enriched: CompileWarning = getBreadcrumbs
        ? { ...warning, elementAncestry: getBreadcrumbs() }
        : warning;
      pushWarning?.(enriched);
    },
    // Default composeBounds is identity — returns localRect unchanged.
    composeBounds: (localRect) => localRect,
    // Default composeZ is identity — returns localZ unchanged.
    composeZ: (localZ) => localZ,
    // Default composeOpacity is identity — returns localOpacity unchanged.
    composeOpacity: (localOpacity) => localOpacity,
  };
};

/**
 * Creates a child CompileApi that delegates to the parent but overrides composeBounds
 * to compose local coordinates into the given parentContentBounds, and composeZ
 * to accumulate Z offsets from parent views/layouts.
 *
 * Used by viewHandler to create scoped compilation contexts for view children.
 */
export function createChildApi(
  parentApi: CompileApi,
  parentContentBounds: NVSRect,
  zOffset: number = 0,
  opacityScale: number = 1,
): CompileApi {
  return {
    ...parentApi,
    composeBounds: (localRect: NVSRect): NVSRect => {
      const composed = composeBoundsIntoParent(localRect, parentContentBounds);
      return parentApi.composeBounds(composed);
    },
    composeZ: (localZ: number): number => {
      return parentApi.composeZ(localZ + zOffset);
    },
    composeOpacity: (localOpacity: number): number => {
      return parentApi.composeOpacity(localOpacity * opacityScale);
    },
  };
}

/**
 * Discriminated union for <Scene> transition control props.
 *
 * Branch 1 (dissolve/default):
 *   transition?: 'dissolve'  — can be omitted; both resolve to dissolve-through-black.
 *   exitStart?: number       — blockProgress where the scene starts fading. Default: 0.8.
 *                              Higher = scene stays opaque longer. Range: [0, 0.99].
 *
 * Branch 2 (crossfade or raw window):
 *   transition: 'crossfade' | TransitionWindow  — required in this branch.
 *   exitStart?: never        — TypeScript compile error if exitStart is provided here.
 *                              exitStart is meaningless for crossfade and raw windows.
 *
 * Examples:
 *   <Scene id="s1" />                                       // dissolve, exitStart=0.8
 *   <Scene id="s1" exitStart={0.9} />                       // dissolve, exitStart=0.9
 *   <Scene id="s1" transition="dissolve" exitStart={0.7} /> // explicit dissolve
 *   <Scene id="s1" transition="crossfade" />                // crossfade
 *   <Scene id="s1" transition={{ exit:[0.7,1.0], enter:[0.0,0.3] }} />  // raw escape hatch
 */
type SceneTransitionProps =
  | { transition?: 'dissolve'; exitStart?: number }
  | { transition: 'crossfade' | TransitionWindow; exitStart?: never };

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
  children?: React.ReactNode;
} & SceneTransitionProps): null => {
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
    transition?: SceneTransitionProp;
    exitStart?: number;
  };
  // Children.toArray() prefixes keys with ".$" (e.g. "arch-auto" -> ".$arch-auto").
  // Strip the prefix defensively for any direct-element fallback path.
  const rawKey = typeof node.key === 'string' && node.key.startsWith('.$')
    ? node.key.slice(2)
    : node.key;
  const sceneId = props.id ?? rawKey ?? null;
  if (sceneId === null) {
    console.warn(
      '[EngineProvider] A <Scene> element has no id. ' +
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
  if (props.transition !== undefined || props.exitStart !== undefined) {
    api.state.transitionWindow = resolveSceneTransition(props.transition, props.exitStart);
  }

  // Warn when exitStart is declared on the last scene — it has no effect because there
  // is no outgoing transition block from the final scene.
  if (props.exitStart !== undefined && api.context.sceneIndex === api.context.numScenes - 1) {
    const lastSceneId = String(sceneId ?? 'unknown');
    api.pushWarning({
      code: 'TRANSITION_TIMING',
      message:
        `exitStart on the last scene ("${lastSceneId}") has no effect. ` +
        'There is no outgoing transition from the final scene.',
      sceneIndex: api.context.sceneIndex,
    });
  }

  // Compile DSL children. DSL nodes are processed into api.state; non-DSL JSX
  // (HTML elements, <TextBox>, etc.) is returned as overlay content and stored
  // on sceneOverlay for EngineOverlayHost to render above the canvas.
  const overlayNodes = helpers.compileChildrenSeparated(node, api);
  if (overlayNodes.length > 0) {
    // Wrap in a Fragment so EngineOverlayHost renders a single ReactNode rather than a
    // bare array. A bare array requires every sibling to carry a key; the Fragment does not.
    api.state.sceneOverlay = React.createElement(Fragment, null, ...overlayNodes);
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
  _widgetRegistry: WidgetRegistry,
  pushWarning?: (warning: CompileWarning) => void,
): ResolvedScene => {
  // Ensure core handlers are registered before attempting DSL compilation.
  // This is a backward-compat fallback for tests and direct callers that don't
  // go through corePlugin().registerHandlers() or EngineProvider.
  // In production, plugins register handlers explicitly before compilation.
  ensureSceneRegistry();

  const { helpers, getBreadcrumbs } = createHelpers();

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
  const api = createApi(context, pushWarning, getBreadcrumbs);
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
