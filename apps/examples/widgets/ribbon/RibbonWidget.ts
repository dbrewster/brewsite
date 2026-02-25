import type { ReactElement } from 'react';
import { isValidElement } from 'react';
import type { NodeHandler } from '@brewsite/core/compiler/sceneDslTypes';
import type { ISceneElement, IRenderable, WidgetInitContext, WidgetRenderContext } from '@brewsite/core/widget/types';
import { CUSTOM_NODE_HANDLER } from '@brewsite/core/widget/WidgetRegistry';
import { ribbonTransitionSpec } from './compile';
import type { RibbonConfig, SceneRibbon } from './types';
import { Ribbon } from './dsl';
import { RibbonRenderer } from './render';

const DEFAULT_RIBBON_CONFIG: RibbonConfig = {
  strandCount: 8,
  spacing: 1,
  radius: 0.1,
  radiusTaper: 0.9,
  segments: 40,
  twistFrequency: 0,
  twistPhase: 0,
  opacity: 0.9,
  glowLightsEnabled: false,
  glowLightCount: 2,
  glowLightIntensity: 0.2,
  glowLightColor: '#ffffff',
  glowLightDistance: 10,
  glowLightDecay: 1,
  curve: {
    width: 40,
    yOffset: 0,
    z: 0,
    waveAmplitude: 0,
    waveFrequency: 1,
    depthAmplitude: 0,
    depthFrequency: 1,
    depthPhase: 0,
  },
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

export class RibbonWidget implements ISceneElement<SceneRibbon>, IRenderable<SceneRibbon> {
  readonly widgetId = 'ribbon';
  readonly defaultState: SceneRibbon = { enabled: false, config: DEFAULT_RIBBON_CONFIG };
  readonly transitionSpec = ribbonTransitionSpec;
  readonly DslComponent = Ribbon;

  private renderer: RibbonRenderer | null = null;

  constructor() {
    (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (
      node,
      api,
      helpers,
    ) => {
      if (!isValidElement(node)) return;
      const props = helpers.resolveObjectValues(node.props as { enabled?: boolean; config?: RibbonConfig }, api.context);
      const base = (api.state.widgets[this.widgetId] as SceneRibbon | undefined) ?? this.defaultState;
      const next: SceneRibbon = {
        ...base,
        enabled: props.enabled ?? base.enabled,
        config: props.config ?? base.config,
      };
      if (props.config && props.enabled === undefined) {
        next.enabled = true;
      }
      api.setWidgetState(this.widgetId, next);
    };
  }

  initialize(ctx: WidgetInitContext): void {
    this.renderer = new RibbonRenderer(ctx.scene);
  }

  apply(state: SceneRibbon, _ctx: WidgetRenderContext): void {
    this.renderer?.update(state);
  }

  dispose(): void {
    this.renderer?.dispose();
    this.renderer = null;
  }
}
