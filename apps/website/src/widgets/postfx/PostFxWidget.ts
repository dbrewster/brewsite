// Widget lifecycle and CUSTOM_NODE_HANDLER bridge for post-processing effects.

import { isValidElement } from 'react';
import type { PerspectiveCamera } from 'three';
import type { NodeHandler } from '@brewsite/core/compiler/sceneDslTypes';
import type { IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext } from '@brewsite/core/widget/types';
import { CUSTOM_NODE_HANDLER } from '@brewsite/core/widget/WidgetRegistry';
import { DEFAULT_POST_FX_STATE, postFxTransitionSpec } from './compile';
import type { PostFxProps } from './dsl';
import { PostFx } from './dsl';
import type { PostFxState } from './types';
import { PostFxRenderer } from './render';

/** Widget that applies post-processing effects (bloom, vignette, color grade). */
export class PostFxWidget
  implements
    ISceneElement<PostFxState>,
    IRenderable<PostFxState> {
  readonly widgetId = 'website-postfx';
  readonly defaultState: PostFxState = DEFAULT_POST_FX_STATE;
  readonly transitionSpec = postFxTransitionSpec;
  readonly DslComponent = PostFx;

  private renderer: PostFxRenderer | null = null;
  private camera: PerspectiveCamera | null = null;

  constructor() {
    (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (node, api, helpers) => {
      if (!isValidElement(node)) return;
      const props = helpers.resolveObjectValues(node.props as PostFxProps, api.context);
      const base = (api.state.widgets[this.widgetId] as PostFxState | undefined) ?? this.defaultState;

      const next: PostFxState = {
        ...base,
        enabled: props.enabled ?? base.enabled,
        bloomStrength: props.bloomStrength ?? base.bloomStrength,
        bloomRadius: props.bloomRadius ?? base.bloomRadius,
        bloomThreshold: props.bloomThreshold ?? base.bloomThreshold,
        vignetteStrength: props.vignetteStrength ?? base.vignetteStrength,
        gradeMix: props.gradeMix ?? base.gradeMix,
        quality: props.quality ?? base.quality,
      };
      api.setWidgetState(this.widgetId, next);
    };
  }

  initialize(context: WidgetInitContext): void {
    if (!context.renderer || !context.camera) {
      console.warn('[PostFxWidget] No renderer or camera available — post-processing disabled.');
      return;
    }
    this.camera = context.camera;
    this.renderer = new PostFxRenderer(context.renderer, context.scene, context.camera);
  }

  apply(state: PostFxState, _context: WidgetRenderContext): void {
    if (!this.renderer || !this.camera) return;
    if (!state.enabled || state.quality === 'off') return;
    this.renderer.render(state, this.camera);
  }

  dispose(): void {
    this.renderer?.dispose();
    this.renderer = null;
    this.camera = null;
  }
}
