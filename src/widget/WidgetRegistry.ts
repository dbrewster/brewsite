// Widget registry — manages registration and dispatch for the widget SDK.

import type {
  IWidget, ISceneElement, IRenderable, ILoadable, IDslComposite,
  IContainedModel, IAnimationController, IVariableProvider,
} from './types';
import { registerNode, getNodeHandler } from '../compiler/registry';
import type { NodeHandler } from '../compiler/sceneDslTypes';

/**
 * Symbol key for widgets that need custom DSL node handlers (e.g., LightingWidget,
 * ModelWidget). Set this on the widget instance before calling registry.register().
 * The routing handler installed by WidgetRegistry will call it when the widget's
 * DslComponent is encountered in a scene DSL tree.
 */
export const CUSTOM_NODE_HANDLER = Symbol('customNodeHandler');

export class WidgetRegistry {
  private widgets = new Map<string, IWidget>();
  private typeFactories = new Map<unknown, (props: Record<string, unknown>) => IWidget>();

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
        const customHandler = (target as unknown as Record<symbol, NodeHandler | undefined>)[
          CUSTOM_NODE_HANDLER
        ];
        if (customHandler) {
          customHandler(node, api, helpers);
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
      console.warn(`[WidgetRegistry] "${widget.widgetId}" already registered. Overwriting.`);
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
            const customHandler = (target as unknown as Record<symbol, NodeHandler | undefined>)[
              CUSTOM_NODE_HANDLER
            ];
            if (customHandler) {
              customHandler(node, api, helpers);
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
            console.warn(
              `[WidgetRegistry] No widget found for DSL component with id="${targetId ?? 'unset'}"`,
            );
            return;
          }

          // Prefer a CUSTOM_NODE_HANDLER registered on the widget for complex DSL
          const customHandler = (target as unknown as Record<symbol, NodeHandler | undefined>)[
            CUSTOM_NODE_HANDLER
          ];
          if (customHandler) {
            customHandler(node, api, helpers);
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
  getContainedModels(): Array<IContainedModel<unknown>> { return this.getAll().filter(isContainedModel); }
  getDslComposites(): IDslComposite[] { return this.getAll().filter(isDslComposite); }

  buildCacheKey(): string {
    return Array.from(this.widgets.values())
      .map((w) => {
        const extra =
          'clipMeta' in w
            ? (w as { clipMeta: Array<{ name: string; duration: number }> }).clipMeta
                .map((c) => `${c.name}:${c.duration.toFixed(3)}`)
                .join(',')
            : '';
        return `${w.widgetId}:${extra}`;
      })
      .sort()
      .join('|');
  }
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export const isSceneElement = (w: IWidget): w is ISceneElement<unknown> =>
  'defaultState' in w && 'transitionSpec' in w && 'DslComponent' in w;
export const isRenderable = (w: IWidget): w is IRenderable<unknown> =>
  'initialize' in w && 'apply' in w && 'dispose' in w;
export const isLoadable = (w: IWidget): w is ILoadable =>
  'load' in w && 'isLoaded' in w;
export const isAnimationController = (w: IWidget): w is IAnimationController =>
  'onTick' in w;
export const isVariableProvider = (w: IWidget): w is IVariableProvider =>
  'variableNamespace' in w && 'variableKeys' in w;
export const isContainedModel = (w: IWidget): w is IContainedModel<unknown> =>
  isRenderable(w) && 'anchorModelId' in w && 'anchorKey' in w;
export const isDslComposite = (w: IWidget): w is IDslComposite =>
  'childDslComponents' in w && Array.isArray((w as IDslComposite).childDslComponents);
