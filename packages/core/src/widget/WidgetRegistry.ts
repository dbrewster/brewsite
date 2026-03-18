// Widget registry — manages registration and dispatch for the widget SDK.

import type {
  IWidget, ISceneElement, IRenderable, ILoadable, IDslComposite,
  IAnimationController, IVariableProvider,
  IRendererLifecycle, IRenderContributor, IContainedRenderable, IAttachmentHost,
  ISceneLifecycle, IInputDefaultProvider,
  ICameraFocusTarget, ILightingOverride, IExtraRenderPass,
  IViewChild,
} from './types';
import type { WebGLRenderer, Object3D } from 'three';
import type { ReactElement } from 'react';
import { registerNode, getNodeHandler } from '../compiler/registry';
import type { NodeHandler, CompileApi, CompileHelpers, NodeHandlerCategory } from '../compiler/sceneDslTypes';
import type { MaterialManifest } from './materialTypes';
import { MaterialLoader } from './MaterialLoader';

export type WidgetRegistryOptions = {
  /**
   * When true, duplicate widget IDs throw instead of warning/overwriting.
   * @default false
   */
  strict?: boolean;
};

/**
 * Symbol key for widgets that need custom DSL node handlers (e.g., LightingWidget,
 * ModelWidget). Set this on the widget instance before calling registry.register().
 * The routing handler installed by WidgetRegistry will call it when the widget's
 * DslComponent is encountered in a scene DSL tree.
 */
export const CUSTOM_NODE_HANDLER = Symbol('customNodeHandler');

/**
 * Interface implemented by widgets that override the default DSL node routing.
 * When a widget implements this interface, the WidgetRegistry invokes the widget's
 * [CUSTOM_NODE_HANDLER] method instead of the default shallow-merge path.
 *
 * @example
 * class CameraWidget implements ISceneElement<SceneCamera>, IHasCustomDslHandler {
 *   readonly [CUSTOM_NODE_HANDLER] = (node, api, helpers) => {
 *     // custom prop transformation logic
 *   };
 * }
 */
export interface IHasCustomDslHandler extends IWidget {
  readonly [CUSTOM_NODE_HANDLER]: NodeHandler;
}

/**
 * Type guard: returns true if the widget implements IHasCustomDslHandler.
 * Use this instead of manual symbol casts to check for custom DSL handling.
 */
export const hasCustomDslHandler = (widget: IWidget): widget is IHasCustomDslHandler =>
  CUSTOM_NODE_HANDLER in widget;

// Stable function identity: assigns a unique numeric ID to each function the first
// time it is seen, avoiding fn.toString() which is unstable under minification.
let nextCacheId = 0;
const fnIdMap = new WeakMap<Function, number>();
const stableFnId = (fn: Function): number => {
  let id = fnIdMap.get(fn);
  if (id === undefined) {
    id = nextCacheId++;
    fnIdMap.set(fn, id);
  }
  return id;
};

const buildFunctionalTransitionSignature = (spec: Record<string, unknown>): string => {
  const fnNames = ['exitFn', 'enterFn', 'interpolateFn'] as const;
  const fnIds = fnNames
    .map((name) => {
      const fn = spec[name];
      return typeof fn === 'function' ? `${name}:${stableFnId(fn)}` : `${name}:`;
    })
    .join('|');
  const defaultWindow = JSON.stringify(spec['defaultWindow'] ?? null);
  return `${fnIds}|defaultWindow:${defaultWindow}`;
};

export class WidgetRegistry {
  private widgets = new Map<string, IWidget>();
  private typeFactories = new Map<unknown, (props: Record<string, unknown>) => IWidget>();
  private readonly strict: boolean;
  private frozen = false;
  private widgetObjects = new Map<string, Object3D>();
  private materialManifest: MaterialManifest | null = null;
  private materialLoader: MaterialLoader | null = null;

  constructor(options: WidgetRegistryOptions = {}) {
    this.strict = options.strict ?? false;
  }

  /**
   * Finalises the widget list and makes registration immutable.
   *
   * Call immediately before RuntimeDriverImpl.initialize() to enforce the widget
   * registration ordering contract. Once frozen, any call to register() or
   * registerTypeFactory() throws a descriptive error.
   */
  freeze(): void {
    this.frozen = true;
  }

  /**
   * Dispatches a DSL node to the given widget.
   * Calls CUSTOM_NODE_HANDLER if present; otherwise shallow-merges props into widget state.
   * Extracted from the duplicated routing logic in register() and registerTypeFactory().
   */
  private dispatchToWidget(
    node: ReactElement,
    api: CompileApi,
    helpers: CompileHelpers,
    widget: IWidget,
  ): void {
    if (hasCustomDslHandler(widget)) {
      widget[CUSTOM_NODE_HANDLER](node, api, helpers);
      return;
    }
    // Default: shallow-merge DSL props into widget state slot.
    const props = node.props as Record<string, unknown>;
    const resolved = helpers.resolveObjectValues(
      helpers.stripUndefinedDeep(props),
      api.context,
    );
    api.setWidgetState(
      widget.widgetId,
      { ...(api.state.widgets[widget.widgetId] as object ?? {}), ...resolved },
    );
  }

  registerTypeFactory(
    component: unknown,
    factory: (props: Record<string, unknown>) => IWidget,
  ): this {
    if (this.frozen) {
      throw new Error(
        `[WidgetRegistry] Cannot registerTypeFactory after freeze() has been called.`,
      );
    }
    this.typeFactories.set(component, factory);
    if (!getNodeHandler(component)) {
      const registry = this;
      // No factory-registered components are ambient; category defaults to spatial.
      registerNode(component, (node, api, helpers) => {
        const props = node.props as Record<string, unknown>;
        const targetType = typeof props['type'] === 'string' ? props['type'] : undefined;
        const targetId = typeof props['id'] === 'string' ? props['id'] : undefined;
        if (!targetType) {
          throw new Error(`<Model> requires a string "type" prop.`);
        }
        if (!targetId) {
          throw new Error(`<Model> requires a string "id" prop.`);
        }
        let target = registry.get(targetId);
        if (!target) {
          target = factory(props);
          registry.register(target);
        }
        if (!target || !isSceneElement(target)) {
          throw new Error(
            `[WidgetRegistry] No widget found for DSL component with type="${targetType}" and id="${targetId}"`,
          );
        }
        registry.dispatchToWidget(node, api, helpers, target);
      });
    }
    return this;
  }

  // DEBT: The typeFactory handler block inside register() partially duplicates registerTypeFactory() routing logic
  register(widget: IWidget): this {
    if (this.frozen) {
      throw new Error(
        `[WidgetRegistry] Cannot register widget "${widget.widgetId}" after freeze() ` +
        `has been called. Ensure all widgets are registered before compileSceneTrack().`,
      );
    }
    if (this.widgets.has(widget.widgetId)) {
      const msg =
        `[WidgetRegistry] Widget ID "${widget.widgetId}" is already registered. ` +
        `Duplicate widget IDs cause the first widget to be silently replaced. ` +
        `Ensure each widget has a unique widgetId.`;
      if (this.strict) {
        throw new Error(msg);
      }
      console.warn(msg);
    }
    this.widgets.set(widget.widgetId, widget);

    if (isSceneElement(widget)) {
      if (!getNodeHandler(widget.DslComponent)) {
        // First widget with this DslComponent — install a routing handler.
        // Routing handler dispatches to the correct widget by the 'id' prop,
        // falling back to any widget sharing this DslComponent.
        const registry = this;
        // Duck-type read the optional nodeHandlerCategory from the widget class.
        // Ambient widgets (Camera, Lighting, etc.) declare this as 'ambient' to exempt
        // them from the Scene view constraint enforcement. Defaults to 'spatial' if absent.
        const widgetCategory: NodeHandlerCategory | undefined =
          'nodeHandlerCategory' in widget
            ? (widget as { nodeHandlerCategory: NodeHandlerCategory }).nodeHandlerCategory
            : undefined;
        registerNode(widget.DslComponent, (node, api, helpers) => {
          const props = node.props as Record<string, unknown>;
          const targetType = typeof props['type'] === 'string' ? props['type'] : undefined;
          const targetId = typeof props['id'] === 'string' ? props['id'] : undefined;
          const factory = registry.typeFactories.get(widget.DslComponent);

          // Validate requiresTypeProp (§7.3): widgets that require a type prop for routing
          const sceneElement = widget as ISceneElement<unknown>;
          const displayName = widget.DslComponent.displayName ?? widget.widgetId;
          if (sceneElement.requiresTypeProp && !props['type']) {
            console.error(
              `[WidgetRegistry] DSL component <${displayName}> requires a "type" prop. ` +
              `Found: <${displayName} id="${props['id'] ?? '?'}" /> without type. ` +
              `Provide type="..." to identify the target widget instance.`,
            );
            return; // Skip compilation for this node
          }

          if (factory) {
            if (!targetType) {
              throw new Error(
                `<${widget.DslComponent.displayName ?? 'Model'}> requires a string "type" prop.`,
              );
            }
            if (!targetId) {
              throw new Error(
                `<${widget.DslComponent.displayName ?? 'Model'}> requires a string "id" prop.`,
              );
            }
            let target = registry.get(targetId);
            if (!target) {
              target = factory(props);
              registry.register(target);
            }
            if (!target || !isSceneElement(target)) {
              throw new Error(
                `[WidgetRegistry] No widget found for DSL component with type="${targetType}" and id="${targetId}"`,
              );
            }
            registry.dispatchToWidget(node, api, helpers, target);
            return;
          }

          const target =
            targetId
              ? registry.get(targetId)
              : Array.from(registry.widgets.values()).find(
                  (w) =>
                    isSceneElement(w) &&
                    (w as ISceneElement<unknown>).DslComponent === widget.DslComponent,
                );

          if (!target || !isSceneElement(target)) {
            api.pushWarning({
              code: 'MISSING_WIDGET',
              message:
                `No registered widget found for DSL element with id="${targetId ?? 'unset'}". ` +
                `Ensure a widget with this ID is registered in widgetSetup.ts before this scene compiles.`,
              widgetId: targetId ?? undefined,
              sceneIndex: api.context.sceneIndex,
            });
            return;
          }

          registry.dispatchToWidget(node, api, helpers, target);
        }, widgetCategory ? { category: widgetCategory } : undefined);
      }
      // else: routing handler already installed for this DslComponent — nothing to do.
      // The routing handler will look up the target widget by id prop at call time.
    }

    // Register protective top-level handlers for IDslComposite child components
    if (isDslComposite(widget)) {
      for (const { component, displayName, topLevelError } of widget.childDslComponents) {
        if (getNodeHandler(component)) continue;
        if (topLevelError) {
          const parentName = (isSceneElement(widget) ? widget.DslComponent?.displayName : undefined) ?? widget.widgetId;
          registerNode(component, () => {
            throw new Error(
              `<${displayName}> must be used inside <${parentName}>. ` +
                `It cannot appear at the top level of a scene.`,
            );
          });
        } else {
          registerNode(component, () => {}); // noop — silently ignored at top level
        }
      }
    }

    return this;
  }

  getAll(): IWidget[] { return Array.from(this.widgets.values()); }
  get(id: string): IWidget | undefined { return this.widgets.get(id); }

  /**
   * Returns all registered widgets as an iterable.
   * Used by RuntimeDriverImpl and plugin factories to resolve interface
   * implementors (e.g. ICameraFocusTarget, ILightingOverride) after construction.
   */
  getAllWidgets(): IterableIterator<IWidget> {
    return this.widgets.values();
  }

  getSceneElements(): Array<ISceneElement<unknown>> { return this.getAll().filter(isSceneElement); }
  getRenderables(): Array<IRenderable<unknown>> { return this.getAll().filter(isRenderable); }
  getAnimationControllers(): IAnimationController[] {
    return this.getAll()
      .filter(isAnimationController)
      .sort((a, b) => (a.tickPriority ?? 0) - (b.tickPriority ?? 0));
  }
  getLoadables(): ILoadable[] { return this.getAll().filter(isLoadable); }
  getDslComposites(): IDslComposite[] { return this.getAll().filter(isDslComposite); }

  /** Returns all widgets that implement ISceneLifecycle, in registration order. */
  getSceneLifecycleWidgets(): ISceneLifecycle[] {
    return this.getAll().filter(isSceneLifecycle);
  }

  /** Returns all widgets that implement IContainedRenderable. */
  getContainedRenderables(): IContainedRenderable[] {
    return this.getAll().filter(isContainedRenderable);
  }

  /** Returns all widgets that implement IAttachmentHost. */
  getAttachmentHosts(): IAttachmentHost[] {
    return this.getAll().filter(isAttachmentHost);
  }

  /** Returns all widgets that implement IInputDefaultProvider, in registration order. */
  getInputDefaultProviders(): IInputDefaultProvider[] {
    return this.getAll().filter(isInputDefaultProvider);
  }

  /**
   * Returns all registered widgets that implement IExtraRenderPass,
   * in registration order (which equals DSL declaration order).
   *
   * @debt Currently unused after DiagramCanvas removal (v2.x). Reserved
   * for future post-processing widgets. The IExtraRenderPass interface
   * and this method are kept in place so that any future widget that
   * needs a post-render pass can implement it without a breaking SDK change.
   */
  getExtraRenderPassWidgets(): IExtraRenderPass[] {
    return this.getAll().filter(isExtraRenderPass);
  }

  /**
   * Broadcasts onRendererCreated to all IRendererLifecycle widgets.
   * Call from useSceneEngine.ts when the WebGLRenderer is constructed.
   */
  notifyRendererCreated(renderer: WebGLRenderer): void {
    for (const widget of this.widgets.values()) {
      if (isRendererLifecycle(widget)) widget.onRendererCreated(renderer);
    }
  }

  /**
   * Broadcasts onRendererDisposing to all IRendererLifecycle widgets.
   * Call from useSceneEngine.ts cleanup effect, before renderer.dispose().
   */
  notifyRendererDisposing(renderer: WebGLRenderer): void {
    for (const widget of this.widgets.values()) {
      if (isRendererLifecycle(widget)) widget.onRendererDisposing(renderer);
    }
    if (this.materialLoader) {
      this.materialLoader.disposeForRenderer(renderer);
    }
  }

  /** Stores the root Object3D created during IRenderable.initialize(). Called by RuntimeDriverImpl. */
  setWidgetObject(widgetId: string, obj: Object3D): void {
    this.widgetObjects.set(widgetId, obj);
  }

  /** Returns the root Object3D for an initialized IRenderable widget, or undefined. */
  getWidgetObject(widgetId: string): Object3D | undefined {
    return this.widgetObjects.get(widgetId);
  }

  /** Clears widget object mapping. Called during widget dispose. */
  clearWidgetObject(widgetId: string): void {
    this.widgetObjects.delete(widgetId);
  }

  /** Called by texturesPlugin.configureRegistry(). */
  setMaterialManifest(manifest: MaterialManifest): void {
    this.materialManifest = manifest;
  }

  /** Returns the registered manifest, or null if @brewsite/textures is not installed. */
  getMaterialManifest(): MaterialManifest | null {
    return this.materialManifest;
  }

  /** Returns the shared MaterialLoader. Created lazily on first access. */
  getMaterialLoader(): MaterialLoader {
    if (!this.materialLoader) {
      this.materialLoader = new MaterialLoader();
    }
    return this.materialLoader;
  }

  buildCacheKey(): string {
    const widgetPart = Array.from(this.widgets.values())
      .map((w) => {
        // For widgets using FunctionalTransitionSpec, include a hash of transition
        // function sources so cache invalidation tracks real code changes, not length.
        if (isSceneElement(w)) {
          const spec = w.transitionSpec as Record<string, unknown>;
          if (typeof spec['interpolateFn'] === 'function') {
            const sig = buildFunctionalTransitionSignature(spec);
            return `${w.widgetId}:fsig${sig}`;
          }
        }
        return w.widgetId;
      })
      .sort()
      .join('|');
    // Include type factory count so registries with different lazy-widget
    // capabilities (e.g. manifest loaded vs not) produce different cache keys.
    const factoryPart = this.typeFactories.size > 0
      ? `tf:${this.typeFactories.size}`
      : '';
    return factoryPart ? `${widgetPart}::${factoryPart}` : widgetPart;
  }
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export const isSceneElement = (w: IWidget): w is ISceneElement<unknown> =>
  'defaultState' in w && 'transitionSpec' in w && 'DslComponent' in w;
export const isRenderable = (w: IWidget): w is IRenderable<unknown, unknown> =>
  'initialize' in w && 'apply' in w && 'dispose' in w;
export const isLoadable = (w: IWidget): w is ILoadable =>
  'load' in w && 'isLoaded' in w;
export const isAnimationController = (w: IWidget): w is IAnimationController =>
  'onTick' in w;
export const isVariableProvider = (w: IWidget): w is IVariableProvider =>
  'variableNamespace' in w && 'variableKeys' in w;
export const isDslComposite = (w: IWidget): w is IDslComposite =>
  'childDslComponents' in w && Array.isArray((w as IDslComposite).childDslComponents);

// ─── Phase 1 type guards ──────────────────────────────────────────────────────

export const isRendererLifecycle = (w: IWidget): w is IRendererLifecycle =>
  'onRendererCreated' in w && 'onRendererDisposing' in w;

// ─── Phase 5 type guards ──────────────────────────────────────────────────────

export const isSceneLifecycle = (widget: IWidget): widget is ISceneLifecycle =>
  typeof (widget as ISceneLifecycle).onSceneEnter === 'function' &&
  typeof (widget as ISceneLifecycle).onSceneExit === 'function';

export const isRenderContributor = (w: IWidget): w is IRenderContributor =>
  'contributeRenderData' in w && typeof (w as IRenderContributor).contributeRenderData === 'function';

export const isContainedRenderable = (w: IWidget): w is IContainedRenderable =>
  'anchorWidgetId' in w && 'anchorKey' in w && 'rootObject' in w;

export const isAttachmentHost = (w: IWidget): w is IAttachmentHost =>
  'getAttachmentPoint' in w && typeof (w as IAttachmentHost).getAttachmentPoint === 'function';

export const isInputDefaultProvider = (w: IWidget): w is IInputDefaultProvider =>
  'getDefaultInputActions' in w &&
  typeof (w as IInputDefaultProvider).getDefaultInputActions === 'function';

/** Type guard: returns true if widget implements ICameraFocusTarget. */
export const isCameraFocusTarget = (w: IWidget): w is ICameraFocusTarget =>
  typeof (w as ICameraFocusTarget).requestFocus === 'function';

/** Type guard: returns true if widget implements ILightingOverride. */
export const isLightingOverride = (w: IWidget): w is ILightingOverride =>
  typeof (w as ILightingOverride).getLightingOverride === 'function';

/** Type guard: returns true if widget implements IExtraRenderPass. */
export const isExtraRenderPass = (w: IWidget): w is IExtraRenderPass =>
  typeof (w as IExtraRenderPass).renderPass === 'function';

/** Type guard: widget implements IViewChild (view-level opacity delegation). */
export function isViewChild(widget: IWidget): widget is IViewChild {
  return 'applyViewOpacity' in widget && typeof (widget as IViewChild).applyViewOpacity === 'function';
}
