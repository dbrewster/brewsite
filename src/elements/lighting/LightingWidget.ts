// LightingWidget — ISceneElement + IRenderable + IDslComposite.
// Wraps compile.ts transition spec and render.ts Three.js logic into the widget SDK.

import type * as THREE from 'three';
import type {
  ISceneElement,
  IRenderable,
  IDslComposite,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../widget/types';
import type { SceneLighting } from './types';
import { DEFAULT_LIGHTING, lightingTransitionSpec } from './compile';
import {
  Lighting,
  Ambient,
  Directional,
  Point,
  Spot,
  Panel,
  type AmbientProps,
  type DirectionalProps,
  type PointProps,
  type SpotProps,
  type PanelProps,
  type LightingProps,
} from './dsl';
import { applyLighting } from './render';
import type * as React from 'react';
import { isValidElement } from 'react';
import { CUSTOM_NODE_HANDLER } from '../../widget/WidgetRegistry';
import type { NodeHandler } from '../../compiler/sceneDslTypes';

export class LightingWidget
  implements ISceneElement<SceneLighting>, IRenderable<SceneLighting>, IDslComposite
{
  readonly widgetId = 'lighting';
  readonly defaultState: SceneLighting = DEFAULT_LIGHTING;
  readonly transitionSpec = lightingTransitionSpec;
  // Cast: LightingProps.children is more restrictive than Partial<SceneLighting>.children?.
  readonly DslComponent = Lighting as React.ComponentType<Partial<SceneLighting> & { children?: React.ReactNode }>;

  // Pattern A: child components build up SceneLighting state — not independent widgets.
  readonly childDslComponents: IDslComposite['childDslComponents'] = [
    { component: Ambient as React.ComponentType<unknown>, displayName: 'Ambient', topLevelError: true },
    { component: Directional as React.ComponentType<unknown>, displayName: 'Directional', topLevelError: true },
    { component: Point as React.ComponentType<unknown>, displayName: 'Point', topLevelError: true },
    { component: Spot as React.ComponentType<unknown>, displayName: 'Spot', topLevelError: true },
    { component: Panel as React.ComponentType<unknown>, displayName: 'Panel', topLevelError: true },
  ];

  private threeScene: THREE.Scene | null = null;

  constructor() {
    // Register a custom node handler via the CUSTOM_NODE_HANDLER symbol.
    // WidgetRegistry routing will call this when it encounters <Lighting> in a scene.
    (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (node, api, helpers) => {
      const props = node.props as LightingProps;
      const children = helpers.collectChildren(node);

      const ambients: AmbientProps[] = [];
      const directionals: DirectionalProps[] = [];
      const points: PointProps[] = [];
      const spots: SpotProps[] = [];
      const panels: PanelProps[] = [];

      for (const child of children) {
        if (!isValidElement(child)) continue;
        const childEl = child as React.ReactElement;
        if (childEl.type === Ambient) {
          ambients.push(helpers.resolveObjectValues(childEl.props as AmbientProps, api.context));
        } else if (childEl.type === Directional) {
          directionals.push(helpers.resolveObjectValues(childEl.props as DirectionalProps, api.context));
        } else if (childEl.type === Point) {
          points.push(helpers.resolveObjectValues(childEl.props as PointProps, api.context));
        } else if (childEl.type === Spot) {
          spots.push(helpers.resolveObjectValues(childEl.props as SpotProps, api.context));
        } else if (childEl.type === Panel) {
          panels.push(helpers.resolveObjectValues(childEl.props as PanelProps, api.context));
        }
      }

      const base = (api.state.widgets[this.widgetId] as SceneLighting | undefined) ?? DEFAULT_LIGHTING;
      const compiled: SceneLighting = {
        ...base,
        ambient: ambients[0] ?? base.ambient,
        directional: directionals[0] ?? base.directional,
        points: points.length > 0 ? points : [],
        spots: spots.length > 0 ? spots : [],
        panels: panels.length > 0 ? panels : [],
        intensityScale: props.intensityScale ?? base.intensityScale,
        color: props.color ?? base.color,
      };
      api.setWidgetState(this.widgetId, compiled);
    };
  }

  initialize({ scene }: WidgetInitContext): void {
    // Cast — IRenderable.initialize receives scene as ThreeScene via the context type
    this.threeScene = scene as THREE.Scene;
  }

  apply(state: SceneLighting, _ctx: WidgetRenderContext): void {
    if (!this.threeScene) return;
    applyLighting(state, { scene: this.threeScene });
  }

  dispose(): void {
    // applyLighting removes all __managedByLightingElement lights on each apply();
    // nothing additional to dispose here.
    this.threeScene = null;
  }
}
