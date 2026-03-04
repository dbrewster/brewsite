// Widget registry — manages registration and dispatch for the widget SDK.

import type {
  IWidget, ISceneElement, IRenderable, ILoadable, IDslComposite,
  IAnimationController, IVariableProvider, ICameraActionTarget,
  IRendererLifecycle, IRenderContributor, IContainedRenderable, IAttachmentHost,
  ISceneLifecycle, IInputDefaultProvider,
} from './types';
import type { WebGLRenderer } from 'three';
import { registerNode, getNodeHandler } from '../compiler/registry';
import type { NodeHandler } from '../compiler/sceneDslTypes';

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

export class WidgetRegistry {
  private widgets = new Map<string, IWidget>();
  private typeFactories = new Map<unknown, (props: Record<string, unknown>) => IWidget>();
  private readonly strict: boolean;

  constructor(options: WidgetRegistryOptions = {}) {
    this.strict = options.strict ?? false;
  }

  registerTypeFactory(
    component: unknown,
    factory: (props: Record<string, unknown>) => IWidget,
  ): this {
    this.typeFactories.set(component, factory);
    if (!getNodeHandler(component)) {
      const registry = this;
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
        if (hasCustomDslHandler(target)) {
          target[CUSTOM_NODE_HANDLER](node, api, helpers);
        } else {
          api.setWidgetState(target.widgetId, {
            ...(target.defaultState as object),
            ...props,
          });
        }
      });
    }
    return this;
  }

  register(widget: IWidget): this {
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
            if (hasCustomDslHandler(target)) {
              target[CUSTOM_NODE_HANDLER](node, api, helpers);
            } else {
              api.setWidgetState(target.widgetId, {
                ...(target.defaultState as object),
                ...props,
              });
            }
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

          // Prefer a CUSTOM_NODE_HANDLER registered on the widget for complex DSL
          if (hasCustomDslHandler(target)) {
            target[CUSTOM_NODE_HANDLER](node, api, helpers);
          } else {
            // Default: shallow-merge defaultState with props, set widget state
            api.setWidgetState(target.widgetId, {
              ...(target.defaultState as object),
              ...props,
            });
          }
        });
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
  }

  buildCacheKey(): string {
    return Array.from(this.widgets.values())
      .map((w) => w.widgetId)
      .sort()
      .join('|');
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
export const isCameraActionTarget = (w: IWidget): w is ICameraActionTarget =>
  'applyOrbit' in w && 'applyDolly' in w && 'applyReset' in w;
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
