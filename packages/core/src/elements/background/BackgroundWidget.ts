// BackgroundWidget — ISceneElement + IRenderable + IHasCustomDslHandler.
// Implements CUSTOM_NODE_HANDLER for theme-aware DSL prop resolution.
// Manages a second overlay DOM element for overlayGradient/backdropFilter effects.

import type { ReactElement } from 'react';
import type {
  ISceneElement,
  IRenderable,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../widget/types';
import type { NodeHandler } from '../../compiler/sceneDslTypes';
import { CUSTOM_NODE_HANDLER, type IHasCustomDslHandler } from '../../widget/WidgetRegistry';
import type { SceneBackground } from './types';
import type { BackgroundProps } from './dsl';
import { DEFAULT_BACKGROUND, functionalBackgroundTransitionSpec } from './compile';
import { Background } from './dsl';
import { applyBackground } from './render';

export class BackgroundWidget
  implements ISceneElement<SceneBackground>, IRenderable<SceneBackground>, IHasCustomDslHandler
{
  readonly widgetId = 'background';
  readonly defaultState: SceneBackground = DEFAULT_BACKGROUND;
  readonly transitionSpec = functionalBackgroundTransitionSpec;
  readonly DslComponent = Background;
  readonly disableWhenAbsent = true;

  private domElement: HTMLElement | null = null;
  private overlayElement: HTMLElement | null = null;

  /**
   * Custom DSL node handler that resolves SceneTheme and explicit BackgroundProps
   * into a concrete SceneBackground state.
   *
   * Priority (highest wins):
   *   1. Explicit DSL props (color, gradient, imageUrl, cssFilter, etc.)
   *   2. theme.background.fill / theme.background.effects derived values
   *   3. DEFAULT_BACKGROUND defaults
   *
   * The 'theme' prop itself is NOT stored in SceneBackground — it is consumed
   * here at compile time only.
   */
  readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node: ReactElement, api, _helpers): void => {
    const props = node.props as BackgroundProps;
    const theme = props.theme;

    // Start from defaults
    const state: SceneBackground = { ...DEFAULT_BACKGROUND };

    // Step 1: Apply theme-derived values as base (lower priority)
    if (theme?.background?.fill) {
      const fill = theme.background.fill;
      switch (fill.kind) {
        case 'color':
          state.color = fill.value;
          break;
        case 'gradient':
          state.gradient = fill.value;
          break;
        case 'image':
          state.imageUrl = fill.url;
          if (fill.size)     state.cssSize = fill.size;
          if (fill.position) state.cssPosition = fill.position;
          break;
      }
    }
    if (theme?.background?.effects) {
      const fx = theme.background.effects;
      if (fx.cssFilter)       state.cssFilter = fx.cssFilter;
      if (fx.overlayGradient) state.overlayGradient = fx.overlayGradient;
      if (fx.backdropFilter)  state.backdropFilter = fx.backdropFilter;
      if (fx.opacity !== undefined) state.opacity = fx.opacity;
    }

    // Step 2: Apply explicit props as overrides (higher priority)
    // When gradient is set explicitly, clear color (they're mutually exclusive in the fill slot)
    if (props.gradient !== undefined) {
      state.gradient = props.gradient;
      state.color = undefined;
    }
    if (props.color !== undefined && props.gradient === undefined) {
      state.color = props.color;
      state.gradient = undefined;
    }
    if (props.imageUrl !== undefined)        state.imageUrl = props.imageUrl;
    if (props.opacity !== undefined)         state.opacity = props.opacity;
    if (props.cssPosition !== undefined)     state.cssPosition = String(props.cssPosition);
    if (props.cssSize !== undefined)         state.cssSize = String(props.cssSize);
    if (props.cssRepeat !== undefined)       state.cssRepeat = props.cssRepeat;
    if (props.cssFilter !== undefined)       state.cssFilter = props.cssFilter;
    if (props.overlayGradient !== undefined) state.overlayGradient = props.overlayGradient;
    if (props.backdropFilter !== undefined)  state.backdropFilter = props.backdropFilter;

    api.setWidgetState(this.widgetId, state);
  };

  mergeSnapshot(
    prev: SceneBackground | undefined,
    next: SceneBackground | undefined,
  ): SceneBackground | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev;
    return { ...prev, ...next } as SceneBackground;
  }

  initialize(_ctx: WidgetInitContext): void {
    // domElement and overlayElement are attached via setDomElement() by the engine layer.
  }

  /**
   * Attach the background DOM element.
   * Creates the overlay element as a sibling of `element` in the parent container,
   * positioned to cover the same area. The overlay element is inserted immediately
   * after `element` in the DOM.
   */
  setDomElement(element: HTMLElement | null): void {
    // Clean up previous overlay if present
    if (this.overlayElement && this.overlayElement.parentElement) {
      this.overlayElement.parentElement.removeChild(this.overlayElement);
    }
    this.overlayElement = null;
    this.domElement = element;

    if (element && element.parentElement) {
      const overlay = document.createElement('div');
      overlay.style.cssText =
        'position:absolute;inset:0;pointer-events:none;display:none;z-index:1;';
      // Insert immediately after the background element
      element.insertAdjacentElement('afterend', overlay);
      this.overlayElement = overlay;
    }
  }

  apply(state: SceneBackground, _ctx: WidgetRenderContext): void {
    if (!this.domElement) return;
    applyBackground(state, { element: this.domElement, overlayElement: this.overlayElement });
  }

  dispose(): void {
    if (this.overlayElement && this.overlayElement.parentElement) {
      this.overlayElement.parentElement.removeChild(this.overlayElement);
    }
    this.overlayElement = null;
    this.domElement = null;
  }
}
