// FloorWidget — ISceneElement + IRenderable (simple prop-only DSL, no children).
// Wraps compile.ts transition spec and render.ts Three.js logic into the widget SDK.

import type * as THREE from 'three';
import type {
  IDslComposite,
  ISceneElement,
  IRenderable,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../widget/types';
import type { FloorSurface, FloorSurfaceMirror, FloorSurfacePhysical, SceneFloor } from './types';
import { DEFAULT_FLOOR, floorTransitionSpec } from './compile';
import { Floor, FloorMirror, FloorPhysical, type FloorMirrorProps, type FloorPhysicalProps, type FloorProps } from './dsl';
import { applyFloor, disposeFloor } from './render';
import type * as React from 'react';
import { isValidElement } from 'react';
import { CUSTOM_NODE_HANDLER } from '../../widget/WidgetRegistry';
import type { NodeHandler } from '../../compiler/sceneDslTypes';

export class FloorWidget
  implements ISceneElement<SceneFloor>, IRenderable<SceneFloor>, IDslComposite
{
  readonly widgetId = 'floor';
  readonly defaultState: SceneFloor = DEFAULT_FLOOR;
  readonly transitionSpec = floorTransitionSpec;
  readonly DslComponent = Floor as React.ComponentType<Partial<SceneFloor> & { children?: React.ReactNode }>;
  readonly useDefaultStateWhenAbsent = false;
  readonly childDslComponents: IDslComposite['childDslComponents'] = [
    { component: FloorPhysical as React.ComponentType<unknown>, displayName: 'FloorPhysical', topLevelError: true },
    { component: FloorMirror as React.ComponentType<unknown>, displayName: 'FloorMirror', topLevelError: true },
  ];

  constructor() {
    (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (node, api, helpers) => {
      const props = node.props as FloorProps;
      const children = helpers.collectChildren(node);
      let surface: FloorSurface | undefined;

      for (const child of children) {
        if (!isValidElement(child)) continue;
        const childEl = child as React.ReactElement;
        if (childEl.type === FloorPhysical) {
          const resolved = helpers.resolveObjectValues(childEl.props as FloorPhysicalProps, api.context);
          surface = { type: 'physical', ...resolved } as FloorSurfacePhysical;
        } else if (childEl.type === FloorMirror) {
          const resolved = helpers.resolveObjectValues(childEl.props as FloorMirrorProps, api.context);
          surface = { type: 'mirror', ...resolved } as FloorSurfaceMirror;
        }
      }

      const base = (api.state.widgets[this.widgetId] as SceneFloor | undefined) ?? DEFAULT_FLOOR;
      const resolved: SceneFloor = {
        ...base,
        enabled: helpers.resolveValue(props.enabled, api.context) ?? base.enabled,
        position: helpers.resolveValue(props.position, api.context) ?? base.position,
        rotation: helpers.resolveValue(props.rotation, api.context) ?? base.rotation,
        scale: helpers.resolveValue(props.scale, api.context) ?? base.scale,
        surface: surface ?? base.surface,
      };

      api.setWidgetState(this.widgetId, resolved);
    };
  }

  mergeSnapshot(
    prev: SceneFloor | undefined,
    next: SceneFloor | undefined,
  ): SceneFloor | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev;
    const base = prev ?? DEFAULT_FLOOR;
    return {
      ...base,
      ...next,
      surface: next.surface ?? base.surface,
    } as SceneFloor;
  }

  private threeScene: THREE.Scene | null = null;

  initialize({ scene }: WidgetInitContext): void {
    this.threeScene = scene as THREE.Scene;
  }

  apply(state: SceneFloor, _ctx: WidgetRenderContext): void {
    if (!this.threeScene) return;
    applyFloor(state, { scene: this.threeScene });
  }

  dispose(): void {
    if (this.threeScene) {
      disposeFloor(this.threeScene as THREE.Scene);
    }
    this.threeScene = null;
  }
}
