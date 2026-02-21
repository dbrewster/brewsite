import type { ReactElement } from 'react';
import { isValidElement } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {
  ISceneElement,
  IContainedModel,
  ILoadable,
  IDslComposite,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../../src/widget/types';
import { CUSTOM_NODE_HANDLER } from '../../../src/widget/WidgetRegistry';
import type { NodeHandler } from '../../../src/compiler/sceneDslTypes';
import type { ElementTransitionSpec } from '../../../src/compiler/transitions/transitionTypes';
import { blendOpacity, transitionT } from '../../../src/compiler/transitions/transitionTypes';
import type { AssetManifest } from '../../../src/elements/model/metadata';
import { Brain, Subpart } from './dsl';
import type { BrainProps, SubpartProps } from './dsl';
import type { BrainState, BrainSubpartState } from './types';

const DEFAULT_BRAIN_STATE: BrainState = {
  enabled: true,
  opacity: 1,
  subparts: {},
};

const applyBrainExit = (from: BrainState, t: number): BrainState => ({
  ...from,
  enabled: t < 1 && from.enabled,
  opacity: blendOpacity(from.opacity, 0, t) ?? from.opacity,
});

const applyBrainEnter = (to: BrainState, t: number): BrainState => ({
  ...to,
  enabled: t > 0 && to.enabled,
  opacity: blendOpacity(0, to.opacity, t) ?? to.opacity,
});

const applyBrainInterpolate = (from: BrainState, to: BrainState, t: number): BrainState => ({
  ...from,
  ...to,
  enabled: (from.enabled && t < 1) || (to.enabled && t > 0),
  opacity: blendOpacity(from.opacity, to.opacity, t) ?? to.opacity,
  subparts: to.subparts,
});

const brainTransitionSpec: ElementTransitionSpec<BrainState> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyBrainExit(fromState, t);
    }
  },
  enter: (frames, widgetId, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyBrainEnter(toState, t);
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyBrainInterpolate(fromState, toState, t);
    }
  },
};

export class BrainModelWidget
  implements
    ISceneElement<BrainState>,
    IContainedModel<BrainState>,
    ILoadable,
    IDslComposite {
  readonly widgetId = 'brain';
  readonly anchorModelId = 'primary';
  readonly anchorKey = 'head';

  readonly defaultState: BrainState = DEFAULT_BRAIN_STATE;
  readonly transitionSpec = brainTransitionSpec;
  readonly DslComponent = Brain;
  readonly childDslComponents = [
    { component: Subpart as React.ComponentType<unknown>, displayName: 'Subpart', topLevelError: false },
  ] as const;

  isLoaded = false;
  private group: THREE.Group | null = null;

  constructor() {
    (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (
      node,
      api,
      helpers,
    ) => {
      if (!isValidElement(node)) return;
      const props = helpers.resolveObjectValues(node.props as BrainProps, api.context);
      const base = (api.state.widgets[this.widgetId] as BrainState | undefined) ?? this.defaultState;
      const subparts: Record<string, BrainSubpartState> = { ...base.subparts };

      const children = helpers.collectChildren(node);
      for (const child of children) {
        if (!isValidElement(child)) continue;
        const el = child as ReactElement;
        if (el.type === Subpart) {
          const subProps = helpers.resolveObjectValues(el.props as SubpartProps, api.context);
          if (!subProps.id) continue;
          subparts[subProps.id] = {
            id: subProps.id,
            enabled: subProps.enabled,
            opacity: subProps.opacity,
          };
        }
      }

      const next: BrainState = {
        ...base,
        enabled: props.enabled ?? base.enabled,
        opacity: props.opacity ?? base.opacity,
        subparts,
      };

      api.setWidgetState(this.widgetId, next);
    };
  }

  initialize(ctx: WidgetInitContext): void {
    this.group = new THREE.Group();
    ctx.scene.add(this.group);
  }

  async load(manifest: AssetManifest | null): Promise<void> {
    if (!manifest) return;
    const meta = manifest.containedModels.find((model) => model.type === this.widgetId);
    if (!meta) {
      console.warn(`[BrainModelWidget] No contained model with id "${this.widgetId}" in manifest.`);
      return;
    }
    const loader = new GLTFLoader();
    const scene = await new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        meta.glb,
        (gltf) => resolve(gltf.scene),
        undefined,
        (error) => reject(error),
      );
    });
    if (this.group) {
      this.group.add(scene);
    }
    this.isLoaded = true;
  }

  apply(state: BrainState, _ctx: WidgetRenderContext): void {
    if (!this.group) return;
    this.group.visible = state.enabled;
    if (!state.enabled) return;

    const baseOpacity = state.opacity ?? 1;
    this.group.traverse((obj) => {
      const sub = state.subparts[obj.name];
      const enabled = sub?.enabled ?? true;
      const subOpacity = sub?.opacity ?? 1;
      obj.visible = enabled;
      if ('material' in obj) {
        const material = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
        const opacity = baseOpacity * subOpacity;
        if (Array.isArray(material)) {
          material.forEach((mat) => {
            mat.transparent = true;
            mat.opacity = opacity;
          });
        } else if (material) {
          material.transparent = true;
          material.opacity = opacity;
        }
      }
    });
  }

  dispose(): void {
    if (this.group) {
      this.group.traverse((obj) => {
        if ('geometry' in obj) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose?.();
          const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      this.group.removeFromParent();
      this.group = null;
    }
  }

  getObject3D(): THREE.Object3D | null {
    return this.group;
  }
}
