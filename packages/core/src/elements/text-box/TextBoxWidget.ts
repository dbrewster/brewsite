// TextBoxWidget — publishes TextBoxState to VariableStore for EngineOverlayHost.
// Implements ISceneElement + IRenderable<TextBoxState>. No Three.js scene presence.
// IRenderable is used solely for the apply(state, ctx) call path, which provides
// access to ctx.variables for writing layout state to the VariableStore.

import type React from 'react';
import { TextBox } from './dsl';
import { compileTextBox } from './compile';
import type { TextBoxProps } from './dsl';
import type { TextBoxState } from './types';
import type {
  ISceneElement,
  IRenderable,
  IWidget,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../widget/types';
import type { FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { blendNumber } from '../../compiler/transitions/transitionTypes';
import type { VariableStore } from '../../widget/VariableStore';

// TextBox NodeHandler registration is done in coreHandlers.ts (see A3).
// TextBox factory registration is done in corePlugin().configureRegistry() (see A3/plugins.ts).

/**
 * VariableStore namespace for all TextBox widget state.
 * Exported so EngineOverlayHost (A3) can import it without re-defining the constant.
 */
export const TEXTBOX_NAMESPACE = '__textbox';

/**
 * Functional transition spec for TextBox.
 * Only `opacity` is animated; layout (x, y, w, h) snaps immediately to toState.
 */
export const functionalTextBoxTransitionSpec: FunctionalTransitionSpec<TextBoxState> = {
  exitFn: (fromState) => (ctx) => ({
    ...fromState,
    opacity: fromState.opacity * (1 - ctx.t),
  }),
  enterFn: (toState) => (ctx) => ({
    ...toState,
    opacity: toState.opacity * ctx.t,
  }),
  interpolateFn: (fromState, toState) => (ctx) => ({
    ...toState,
    opacity: blendNumber(fromState.opacity, toState.opacity, ctx.t) ?? toState.opacity,
    // Layout props snap to toState immediately — no interpolation.
  }),
};

/**
 * Widget that bridges compiled TextBoxState to the VariableStore so that
 * EngineOverlayHost can read and render it as a positioned DOM overlay.
 *
 * React children cannot be stored in VariableStore (JsonPrimitive only).
 * Instead, all TextBoxWidget instances share a single Map<string, ReactNode>
 * created in corePlugin() and passed to each widget's constructor.
 */
export class TextBoxWidget implements ISceneElement<TextBoxState>, IRenderable<TextBoxState>, IWidget {
  readonly widgetId: string;
  readonly defaultState: TextBoxState;
  readonly transitionSpec = functionalTextBoxTransitionSpec;
  readonly DslComponent = TextBox;

  /**
   * Stores React children by widgetId. Cannot go in VariableStore (JsonPrimitive only).
   * Accessed by EngineOverlayHost via the shared childrenMap passed through
   * TextBoxChildrenContext. See EngineOverlayHost for the read path.
   */
  private readonly childrenMap: Map<string, React.ReactNode>;

  constructor(
    widgetId: string,
    childrenMap: Map<string, React.ReactNode>,
  ) {
    this.widgetId = widgetId;
    this.childrenMap = childrenMap;
    this.defaultState = compileTextBox({
      id: widgetId,
      children: null,
    } as TextBoxProps);
  }

  /** No-op initialize — TextBoxWidget has no Three.js scene setup. */
  initialize(_context: WidgetInitContext): void {}

  /**
   * Called every tick by RuntimeDriverImpl. Publishes serializable layout state
   * to the VariableStore.
   *
   * React children are NOT read from state here — they are stored in childrenMap
   * at compile time by the NodeHandler in corePlugin().configureRegistry(). This
   * decouples children storage from the SceneTrack pipeline, which cannot carry
   * non-JSON-primitive values across serialization boundaries.
   *
   * ctx.variables is typed as VariableStoreReader (read-only interface) but
   * is always a VariableStore instance at runtime. We cast to VariableStore
   * for write access. This is an internal contract between TextBoxWidget and
   * the engine infrastructure — the engine exclusively constructs VariableStore
   * instances and passes them through WidgetRenderContext.
   */
  apply(state: TextBoxState, ctx: WidgetRenderContext): void {
    // Cast to VariableStore for write access (see comment above).
    const store = ctx.variables as unknown as VariableStore;
    // Publish layout state fields as individual keys for reactive reads.
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.x`, state.x);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.y`, state.y);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.w`, state.w);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.h`, state.h);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.opacity`, state.opacity);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.anchor`, state.anchor);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.edge`, state.edge ?? null);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.inset`, state.inset ?? 0);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.overflow`, state.overflow);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.layer`, state.layer);
  }

  /**
   * Clears this widget's entry from the shared childrenMap.
   * No Three.js resources to release — TextBoxWidget has no scene presence.
   */
  dispose(): void {
    this.childrenMap.delete(this.widgetId);
  }
}
