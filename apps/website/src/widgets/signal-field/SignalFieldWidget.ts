// Widget lifecycle and CUSTOM_NODE_HANDLER bridge for the signal field.

import { isValidElement } from 'react';
import type { NodeHandler } from '@brewsite/core/compiler/sceneDslTypes';
import type { IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext } from '@brewsite/core/widget/types';
import { CUSTOM_NODE_HANDLER } from '@brewsite/core/widget/WidgetRegistry';
import { resolveToNVS } from '@brewsite/core/units/resolve';
import { DEFAULT_SIGNAL_FIELD_STATE, signalFieldTransitionSpec } from './compile';
import type { SignalFieldProps } from './dsl';
import { SignalField } from './dsl';
import type { SignalFieldState } from './types';
import { SignalFieldRenderer } from './render';

/** Widget that renders a directed narrative particle field in 3D space. */
export class SignalFieldWidget
  implements
    ISceneElement<SignalFieldState>,
    IRenderable<SignalFieldState> {
  readonly widgetId = 'website-signal-field';
  readonly defaultState: SignalFieldState = DEFAULT_SIGNAL_FIELD_STATE;
  readonly transitionSpec = signalFieldTransitionSpec;
  readonly DslComponent = SignalField;

  private renderer: SignalFieldRenderer | null = null;

  constructor() {
    (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (node, api, helpers) => {
      if (!isValidElement(node)) return;
      const props = helpers.resolveObjectValues(node.props as SignalFieldProps, api.context);
      const base = (api.state.widgets[this.widgetId] as SignalFieldState | undefined) ?? this.defaultState;

      const next: SignalFieldState = {
        ...base,
        enabled: props.enabled ?? base.enabled,
        x: props.x != null ? resolveToNVS(props.x) : base.x,
        y: props.y != null ? resolveToNVS(props.y) : base.y,
        w: props.w != null ? resolveToNVS(props.w) : base.w,
        h: props.h != null ? resolveToNVS(props.h) : base.h,
        z: props.z ?? base.z,
        count: props.count ?? base.count,
        opacity: props.opacity ?? base.opacity,
        size: props.size != null ? resolveToNVS(props.size) : base.size,
        speed: props.speed ?? base.speed,
        depth: props.depth != null ? resolveToNVS(props.depth) : base.depth,
        spread: props.spread != null ? resolveToNVS(props.spread) : base.spread,
        flow: props.flow ?? base.flow,
        palette: props.palette ?? base.palette,
        targetBias: props.targetBias ?? base.targetBias,
      };
      api.setWidgetState(this.widgetId, next);
    };
  }

  initialize(context: WidgetInitContext): void {
    this.renderer = new SignalFieldRenderer(context.scene);
  }

  apply(state: SignalFieldState, context: WidgetRenderContext): void {
    this.renderer?.update(state, context.clock.wallTimeSeconds, context.coords);
  }

  dispose(): void {
    this.renderer?.dispose();
    this.renderer = null;
  }
}
