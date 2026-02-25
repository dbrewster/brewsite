// EnvironmentWidget — ISceneElement + IRenderable + ILoadable (HDRI async load).
// Wraps compile.ts transition spec and render.ts Three.js logic into the widget SDK.

import type * as THREE from 'three';
import type {
  IDslComposite,
  ISceneElement,
  IRenderable,
  ILoadable,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../widget/types';
import type { EnvironmentSource, SceneEnvironment } from './types';
import { DEFAULT_ENVIRONMENT, functionalEnvironmentTransitionSpec } from './compile';
import {
  Environment,
  EnvironmentCube,
  EnvironmentExr,
  EnvironmentHdri,
  type EnvironmentCubeProps,
  type EnvironmentExrProps,
  type EnvironmentHdriProps,
  type EnvironmentProps,
} from './dsl';
import { applyEnvironment } from './render';
import type { AssetManifest } from '../model/metadata';
import type * as React from 'react';
import { isValidElement } from 'react';
import { CUSTOM_NODE_HANDLER } from '../../widget/WidgetRegistry';
import type { NodeHandler } from '../../compiler/sceneDslTypes';

export class EnvironmentWidget
  implements ISceneElement<SceneEnvironment>, IRenderable<SceneEnvironment>, ILoadable, IDslComposite
{
  readonly widgetId = 'environment';
  readonly defaultState: SceneEnvironment = DEFAULT_ENVIRONMENT;
  readonly transitionSpec = functionalEnvironmentTransitionSpec;
  readonly DslComponent = Environment as React.ComponentType<Partial<SceneEnvironment> & { children?: React.ReactNode }>;
  readonly useDefaultStateWhenAbsent = false;
  readonly childDslComponents: IDslComposite['childDslComponents'] = [
    { component: EnvironmentHdri as React.ComponentType<unknown>, displayName: 'EnvironmentHdri', topLevelError: true },
    { component: EnvironmentExr as React.ComponentType<unknown>, displayName: 'EnvironmentExr', topLevelError: true },
    { component: EnvironmentCube as React.ComponentType<unknown>, displayName: 'EnvironmentCube', topLevelError: true },
  ];

  constructor() {
    (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (node, api, helpers) => {
      const props = node.props as EnvironmentProps;
      const children = helpers.collectChildren(node);

      let source: EnvironmentSource | undefined;
      for (const child of children) {
        if (!isValidElement(child)) continue;
        const childEl = child as React.ReactElement;
        if (childEl.type === EnvironmentHdri) {
          const resolved = helpers.resolveObjectValues(childEl.props as EnvironmentHdriProps, api.context);
          if (resolved.url) {
            source = { type: 'hdr', ...resolved };
          }
        } else if (childEl.type === EnvironmentExr) {
          const resolved = helpers.resolveObjectValues(childEl.props as EnvironmentExrProps, api.context);
          if (resolved.url) {
            source = { type: 'exr', ...resolved };
          }
        } else if (childEl.type === EnvironmentCube) {
          const resolved = helpers.resolveObjectValues(childEl.props as EnvironmentCubeProps, api.context);
          if (resolved.urls) {
            source = { type: 'cube', ...resolved };
          }
        }
      }

      const base = (api.state.widgets[this.widgetId] as SceneEnvironment | undefined) ?? DEFAULT_ENVIRONMENT;
      const resolved: SceneEnvironment = {
        ...base,
        enabled: helpers.resolveValue(props.enabled, api.context) ?? base.enabled,
        intensity: helpers.resolveValue(props.intensity, api.context) ?? base.intensity,
        source: source ?? base.source,
      };
      api.setWidgetState(this.widgetId, resolved);
    };
  }

  mergeSnapshot(
    prev: SceneEnvironment | undefined,
    next: SceneEnvironment | undefined,
  ): SceneEnvironment | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev;
    return { ...prev, ...next } as SceneEnvironment;
  }

  isLoaded = false;
  private threeScene: THREE.Scene | null = null;
  private renderer?: THREE.WebGLRenderer;

  initialize({ scene, renderer }: WidgetInitContext): void {
    this.threeScene = scene as THREE.Scene;
    this.renderer = renderer;
  }

  async load(_manifest: AssetManifest | null): Promise<void> {
    // HDRI loading stub — full implementation in a later phase.
    // When the environment has a url/preset, load the texture here.
    this.isLoaded = true;
  }

  apply(state: SceneEnvironment, _ctx: WidgetRenderContext): void {
    if (!this.threeScene) return;
    applyEnvironment(state, { scene: this.threeScene, renderer: this.renderer });
  }

  dispose(): void {
    this.threeScene = null;
    this.isLoaded = false;
    this.renderer = undefined;
  }
}
