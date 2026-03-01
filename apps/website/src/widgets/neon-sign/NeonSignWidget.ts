import {isValidElement} from 'react';
import type {NodeHandler} from '@brewsite/core/compiler/sceneDslTypes';
import type {ILoadable, IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext,} from '@brewsite/core/widget/types';
import {CUSTOM_NODE_HANDLER} from '@brewsite/core/widget/WidgetRegistry';
import {DEFAULT_NEON_SIGN_STATE, neonSignTransitionSpec} from './compile';
import type {NeonSignProps} from './dsl';
import {NeonSign} from './dsl';
import type {NeonSignState} from './types';
import {NeonSignRenderer} from './render';

export class NeonSignWidget
  implements
    ISceneElement<NeonSignState>,
    ILoadable,
    IRenderable<NeonSignState> {
  readonly widgetId = 'website-neon-sign';
  readonly defaultState: NeonSignState = DEFAULT_NEON_SIGN_STATE;
  readonly transitionSpec = neonSignTransitionSpec;
  readonly DslComponent = NeonSign;

  isLoaded = false;
  private renderer: NeonSignRenderer | null = null;

  constructor() {
    (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (node, api, helpers) => {
      if (!isValidElement(node)) return;
      const props = helpers.resolveObjectValues(node.props as NeonSignProps, api.context);
      const base = (api.state.widgets[this.widgetId] as NeonSignState | undefined) ?? this.defaultState;

      const next: NeonSignState = {
        ...base,
        enabled: props.enabled ?? base.enabled,
        text: props.text ?? base.text,
        fontUrl: props.fontUrl ?? base.fontUrl,
        color: props.color ?? base.color,
        emissiveColor: props.emissiveColor ?? base.emissiveColor,
        intensity: props.intensity ?? base.intensity,
        opacity: props.opacity ?? base.opacity,
        position: props.position ?? base.position,
        rotation: props.rotation ?? base.rotation,
        scale: props.scale ?? base.scale,
      };
      api.setWidgetState(this.widgetId, next);
    };
  }

  initialize(context: WidgetInitContext): void {
    this.renderer = new NeonSignRenderer(context.scene);
  }

  async load(_manifest: { version: number; models: unknown[]; animations: unknown[] } | null): Promise<void> {
    if (!this.renderer) return;
    try {
      await this.renderer.loadFont(this.defaultState.fontUrl);
      this.isLoaded = true;
    } catch (error) {
      console.warn('[NeonSignWidget] Failed to load font.', error);
      this.isLoaded = true;
    }
  }

  apply(state: NeonSignState, context: WidgetRenderContext): void {
    this.renderer?.update(state, context.clock.wallTimeSeconds);
  }

  mergeSnapshot(
    prev: NeonSignState | undefined,
    next: NeonSignState | undefined,
  ): NeonSignState | undefined {
    if (!prev && !next) return undefined;
    // Widget absent from this scene — let exit transition animate it out.
    if (!next) return undefined;
    // Widget appearing for the first time — let enter transition animate it in.
    if (!prev) return next;
    // Both scenes declare the widget — next wins; prev fills any gaps.
    return { ...prev, ...next };
  }

  dispose(): void {
    this.renderer?.dispose();
    this.renderer = null;
    this.isLoaded = false;
  }
}
