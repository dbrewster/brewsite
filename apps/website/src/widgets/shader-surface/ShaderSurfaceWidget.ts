// Widget lifecycle and CUSTOM_NODE_HANDLER bridge for the shader surface.

import { isValidElement } from 'react';
import type { NodeHandler } from '@brewsite/core/compiler/sceneDslTypes';
import type { IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext } from '@brewsite/core/widget/types';
import { CUSTOM_NODE_HANDLER } from '@brewsite/core/widget/WidgetRegistry';
import { resolveToNVS } from '@brewsite/core/units/resolve';
import { DEFAULT_SHADER_SURFACE_STATE, shaderSurfaceTransitionSpec } from './compile';
import type { ShaderSurfaceProps } from './dsl';
import { ShaderSurface } from './dsl';
import type { ShaderSurfaceState } from './types';
import { ShaderSurfaceRenderer } from './render';

/** Widget that renders a shader-driven surface for glass, ribbons, and reveal planes. */
export class ShaderSurfaceWidget
  implements
    ISceneElement<ShaderSurfaceState>,
    IRenderable<ShaderSurfaceState> {
  readonly widgetId = 'website-shader-surface';
  readonly defaultState: ShaderSurfaceState = DEFAULT_SHADER_SURFACE_STATE;
  readonly transitionSpec = shaderSurfaceTransitionSpec;
  readonly DslComponent = ShaderSurface;

  private renderer: ShaderSurfaceRenderer | null = null;

  constructor() {
    (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (node, api, helpers) => {
      if (!isValidElement(node)) return;
      const props = helpers.resolveObjectValues(node.props as ShaderSurfaceProps, api.context);
      const base = (api.state.widgets[this.widgetId] as ShaderSurfaceState | undefined) ?? this.defaultState;

      const next: ShaderSurfaceState = {
        ...base,
        enabled: props.enabled ?? base.enabled,
        kind: props.kind ?? base.kind,
        x: props.x != null ? resolveToNVS(props.x) : base.x,
        y: props.y != null ? resolveToNVS(props.y) : base.y,
        w: props.w != null ? resolveToNVS(props.w) : base.w,
        h: props.h != null ? resolveToNVS(props.h) : base.h,
        z: props.z ?? base.z,
        opacity: props.opacity ?? base.opacity,
        palette: props.palette ?? base.palette,
        edgeGlow: props.edgeGlow ?? base.edgeGlow,
        distortion: props.distortion ?? base.distortion,
        scanStrength: props.scanStrength ?? base.scanStrength,
        reveal: props.reveal ?? base.reveal,
      };
      api.setWidgetState(this.widgetId, next);
    };
  }

  initialize(context: WidgetInitContext): void {
    this.renderer = new ShaderSurfaceRenderer(context.scene);
  }

  apply(state: ShaderSurfaceState, context: WidgetRenderContext): void {
    this.renderer?.update(state, context.clock.wallTimeSeconds, context.coords);
  }

  dispose(): void {
    this.renderer?.dispose();
    this.renderer = null;
  }
}
