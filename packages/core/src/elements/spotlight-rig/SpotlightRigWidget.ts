// SpotlightRigWidget — IDslComposite + ISceneElement + IRenderable + IAnimationController for rotating spotlights.

import { isValidElement } from 'react';
import type * as React from 'react';
import type * as THREE from 'three';
import type {
  ISceneElement,
  IRenderable,
  IAnimationController,
  IDslComposite,
  WidgetInitContext,
  WidgetRenderContext,
  AnimationTickContext,
} from '../../widget/types';
import type { IHasCustomDslHandler } from '../../widget/index';
import { CUSTOM_NODE_HANDLER } from '../../widget/index';
import type { NodeHandler } from '../../compiler/sceneDslTypes';
import type { SpotlightRigState, OrbitFn } from './types';
import type { SpotlightRigProps, SpotlightProps } from './dsl';
import {
  DEFAULT_SPOTLIGHT_RIG_STATE,
  spotlightRigTransitionSpec,
  resolveSpotlightRig,
} from './compile';
import {
  getOrCreateCache,
  disposeCache,
  applySpotlightRig,
} from './render';
import type { SpotlightRigRefs } from './render';

// ─── DSL Stub Components ──────────────────────────────────────────────────────

/** DSL stub — renders null; all output is Three.js via onTick(). */
export const SpotlightRig = (_props: SpotlightRigProps): null => null;
SpotlightRig.displayName = 'SpotlightRig';

/** DSL stub — child of <SpotlightRig>; must not be used at the top level. */
export const Spotlight = (_props: SpotlightProps): null => null;
Spotlight.displayName = 'Spotlight';

// ─── Orbit Function Store ─────────────────────────────────────────────────────

/** Scene-indexed orbit function store. Populated by CUSTOM_NODE_HANDLER at compile time. */
type OrbitFnStore = Map<number, Map<number, OrbitFn>>;

// ─── Widget Class ─────────────────────────────────────────────────────────────

/**
 * SpotlightRigWidget — manages N autonomous rotating spotlights with optional beam cones
 * and ground halos, driven by wall-clock time via IAnimationController.onTick().
 *
 * Implements IDslComposite to declare <Spotlight> as a child component.
 * Orbit functions are stored on the widget instance (keyed by sceneIndex → lightIndex)
 * because they cannot be serialized into SceneTrack.
 *
 * Registration: included in corePlugin(). disableWhenAbsent=true means absent scenes
 * receive enabled=false and onTick() exits immediately — zero GPU work.
 */
export class SpotlightRigWidget
  implements
    ISceneElement<SpotlightRigState>,
    IRenderable<SpotlightRigState>,
    IAnimationController,
    IDslComposite,
    IHasCustomDslHandler
{
  // Ambient: SpotlightRig configures scene lighting globally. Not an NVS-bounded canvas element.
  readonly nodeHandlerCategory = 'ambient' as const;
  readonly widgetId: string;

  // ── ISceneElement ────────────────────────────────────────────────────────────

  readonly defaultState: SpotlightRigState = DEFAULT_SPOTLIGHT_RIG_STATE;
  readonly transitionSpec = spotlightRigTransitionSpec;

  /** Cast is safe: SpotlightRig accepts SpotlightRigProps and is typed as ComponentType<any> in the SDK. */
  readonly DslComponent = SpotlightRig as React.ComponentType<SpotlightRigProps>;

  /**
   * When true, absent scenes receive makeDisabledDefault(defaultState) with enabled=false.
   * onTick() checks state.enabled and returns early — no lights, no draw calls.
   */
  readonly disableWhenAbsent = true;

  /**
   * Carry-forward merge: if the current scene doesn't include <SpotlightRig>,
   * inherit the previous scene's state. This prevents spotlights from triggering
   * an exit transition every time a scene omits the DSL element.
   *
   * When next IS present, shallow merge lets the new scene override any fields
   * while inheriting non-overridden values from the previous scene.
   */
  mergeSnapshot(
    prev: SpotlightRigState | undefined,
    next: SpotlightRigState | undefined,
  ): SpotlightRigState | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev;
    if (!prev) return next;
    // Shallow-merge rig-level fields; replace lights[] entirely from next.
    return { ...prev, ...next };
  }

  // ── IDslComposite ────────────────────────────────────────────────────────────

  readonly childDslComponents: IDslComposite['childDslComponents'] = [
    {
      component: Spotlight as React.ComponentType<unknown>,
      displayName: 'Spotlight',
      topLevelError: true,   // <Spotlight> outside <SpotlightRig> is an error
    },
  ];

  // ── IAnimationController ─────────────────────────────────────────────────────

  /** Run before default priority so lights are positioned before apply() calls. */
  readonly tickPriority = 10;

  // ── Orbit function store ─────────────────────────────────────────────────────

  /**
   * Per-scene, per-light orbit function store.
   * Key: sceneIndex → Map<lightIndex, OrbitFn>.
   * Populated by CUSTOM_NODE_HANDLER during compilation.
   * Read by onTick() each frame.
   */
  private _orbitStore: OrbitFnStore = new Map();

  /**
   * Stores an orbit function for a specific scene and light index.
   * Called from CUSTOM_NODE_HANDLER.
   */
  storeOrbitFn(sceneIndex: number, lightIndex: number, fn: OrbitFn): void {
    let sceneMap = this._orbitStore.get(sceneIndex);
    if (!sceneMap) {
      sceneMap = new Map();
      this._orbitStore.set(sceneIndex, sceneMap);
    }
    sceneMap.set(lightIndex, fn);
  }

  /**
   * Returns the orbit functions for all lights in the given scene, as a sparse
   * array where index matches light index. Lights without a custom orbit function
   * have undefined at their index.
   */
  getOrbitFns(sceneIndex: number): (OrbitFn | undefined)[] {
    const sceneMap = this._orbitStore.get(sceneIndex);
    if (!sceneMap) return [];
    // Determine the maximum light index stored.
    let maxIndex = -1;
    for (const k of sceneMap.keys()) {
      if (k > maxIndex) maxIndex = k;
    }
    if (maxIndex < 0) return [];
    const result: (OrbitFn | undefined)[] = new Array(maxIndex + 1).fill(undefined);
    for (const [idx, fn] of sceneMap.entries()) {
      result[idx] = fn;
    }
    return result;
  }

  // ── CUSTOM_NODE_HANDLER ──────────────────────────────────────────────────────

  /**
   * Custom DSL handler: collects <Spotlight> children, extracts orbit functions before
   * serialization, resolves all Resolvable<T> props, and calls resolveSpotlightRig().
   *
   * orbit functions are extracted from child props BEFORE resolveObjectValues() because
   * they are plain functions (not Resolvable<T>) and must not be passed through the
   * resolver. They are stored on the widget instance keyed by sceneIndex → lightIndex.
   */
  readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node, api, helpers) => {
    const rigProps = node.props as SpotlightRigProps;
    const sceneIndex = api.context.sceneIndex;
    const children = helpers.collectChildren(node);

    const lightPropsList: SpotlightProps[] = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!isValidElement(child)) continue;
      const childEl = child as React.ReactElement;
      if (childEl.type !== Spotlight) continue;

      const rawLightProps = childEl.props as SpotlightProps;

      // Extract orbit function BEFORE resolveObjectValues — it is a function
      // that should NOT be resolved as a Resolvable<T> value.
      if (typeof rawLightProps.orbit === 'function') {
        this.storeOrbitFn(sceneIndex, i, rawLightProps.orbit);
      }

      // Resolve all Resolvable<T> props, excluding orbit (not serializable).
      const { orbit: _orbit, ...serializableLightProps } = rawLightProps;
      const resolved = helpers.resolveObjectValues(
        helpers.stripUndefinedDeep(serializableLightProps as Record<string, unknown>),
        api.context,
      ) as SpotlightProps;

      lightPropsList.push(resolved);
    }

    // Resolve rig-level props for theme chain and center/target.
    // Exclude children from resolution — they are JSX nodes, not serializable values.
    const { children: _children, ...rigPropsWithoutChildren } = rigProps as Record<string, unknown>;
    const resolvedRigProps = helpers.resolveObjectValues(
      helpers.stripUndefinedDeep(rigPropsWithoutChildren),
      api.context,
    ) as SpotlightRigProps;

    const state = resolveSpotlightRig(resolvedRigProps, lightPropsList, api.context);
    api.setWidgetState(this.widgetId, state);
  };

  // ── Constructor ──────────────────────────────────────────────────────────────

  constructor(widgetId = 'spotlight-rig') {
    this.widgetId = widgetId;
  }

  // ── IRenderable ──────────────────────────────────────────────────────────────

  private threeScene: THREE.Scene | null = null;
  private cache: ReturnType<typeof getOrCreateCache> | null = null;

  initialize({ scene }: WidgetInitContext): void {
    this.threeScene = scene as THREE.Scene;
    this.cache = getOrCreateCache(scene as THREE.Scene, this.widgetId);
  }

  /**
   * Intentionally empty.
   *
   * All Three.js mutations happen in onTick() which fires before apply() each frame.
   * SpotlightRig is entirely time-driven: compiled state is configuration, not position.
   */
  apply(_state: SpotlightRigState, _ctx: WidgetRenderContext): void {
    // Intentionally empty — see JSDoc above.
  }

  dispose(): void {
    if (this.threeScene && this.cache) {
      disposeCache(this.threeScene, this.cache);
    }
    this.threeScene = null;
    this.cache = null;
    this._orbitStore.clear();
  }

  // ── IAnimationController ─────────────────────────────────────────────────────

  onTick(context: AnimationTickContext): void {
    if (!this.threeScene || !this.cache) return;
    const state = (context.resolvedState as SpotlightRigState | null) ?? this.defaultState;
    // SceneTrackTick has sceneIndex as a direct field — use it when available.
    const sceneIndex = context.tick?.sceneIndex ?? 0;
    const orbitFns = this.getOrbitFns(sceneIndex);
    const refs: SpotlightRigRefs = { scene: this.threeScene, cache: this.cache };
    applySpotlightRig(state, refs, context.clock.wallTimeSeconds, orbitFns);
  }
}
