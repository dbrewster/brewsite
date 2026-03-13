// SpotlightRigWidget — ISceneElement + IRenderable + IAnimationController for rotating spotlights.

import type * as React from 'react';
import type * as THREE from 'three';
import type {
  ISceneElement,
  IRenderable,
  IAnimationController,
  WidgetInitContext,
  WidgetRenderContext,
  AnimationTickContext,
} from '../../widget/types';
import type { IHasCustomDslHandler } from '../../widget/index';
import { CUSTOM_NODE_HANDLER } from '../../widget/index';
import type { NodeHandler } from '../../compiler/sceneDslTypes';
import type { SpotlightRigState } from './types';
import type { SpotlightRigProps } from './dsl';
import {
  DEFAULT_SPOTLIGHT_RIG_THEME,
  DEFAULT_SPOTLIGHT_RIG_COUNT,
  DEFAULT_SPOTLIGHT_RIG_CENTER,
  resolveSpotlightRigState,
  spotlightRigTransitionSpec,
} from './compile';
import {
  getOrCreateCache,
  disposeCache,
  applySpotlightRig,
} from './render';
import type { SpotlightRigRefs } from './render';

// Re-exported by index.ts — the DSL stub component for <SpotlightRig> authoring.
// The null return ensures no DOM output; all rendering is in Three.js via onTick().

/** DSL stub component for <SpotlightRig>. Renders null; all output is Three.js via onTick(). */
export const SpotlightRig = (_props: SpotlightRigProps): null => null;
SpotlightRig.displayName = 'SpotlightRig';

/**
 * SpotlightRig widget — manages N autonomous rotating spotlights with optional beam cones
 * and ground halos, driven by wall-clock time via IAnimationController.onTick().
 *
 * Registration: included in corePlugin(). disableWhenAbsent=true means absent scenes
 * receive enabled=false and onTick() exits immediately — zero GPU work.
 */
export class SpotlightRigWidget
  implements
    ISceneElement<SpotlightRigState>,
    IRenderable<SpotlightRigState>,
    IAnimationController,
    IHasCustomDslHandler
{
  readonly widgetId: string;

  // ── ISceneElement ───────────────────────────────────────────────────────────

  readonly defaultState: SpotlightRigState = {
    ...DEFAULT_SPOTLIGHT_RIG_THEME,
    center: DEFAULT_SPOTLIGHT_RIG_CENTER,
    target: null,
    count: DEFAULT_SPOTLIGHT_RIG_COUNT,
    showHelper: false,
    enabled: false,   // disabled by default — enabled by disableWhenAbsent machinery
  };

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
    return { ...prev, ...next };
  }

  // ── IAnimationController ────────────────────────────────────────────────────

  /** Run before default priority so lights are positioned before apply() calls. */
  readonly tickPriority = 10;

  // ── CUSTOM_NODE_HANDLER ─────────────────────────────────────────────────────

  /**
   * Custom DSL handler: resolves Resolvable<T> props and applies the theme priority chain
   * (DEFAULT → props.theme → individual overrides) via resolveSpotlightRigState().
   *
   * The default shallow-merge path is insufficient because it cannot apply the theme chain.
   */
  readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node, api, helpers) => {
    const props = node.props as SpotlightRigProps;
    const resolvedProps = helpers.resolveObjectValues(
      helpers.stripUndefinedDeep(props as Record<string, unknown>),
      api.context,
    ) as SpotlightRigProps;
    const state = resolveSpotlightRigState(resolvedProps, api.context);
    api.setWidgetState(this.widgetId, state);
  };

  // ── Constructor ─────────────────────────────────────────────────────────────

  constructor(widgetId = 'spotlight-rig') {
    this.widgetId = widgetId;
  }

  // ── IRenderable ─────────────────────────────────────────────────────────────

  private threeScene: THREE.Scene | null = null;
  private cache: ReturnType<typeof getOrCreateCache> | null = null;

  initialize({ scene }: WidgetInitContext): void {
    this.threeScene = scene as THREE.Scene;
    this.cache = getOrCreateCache(scene as THREE.Scene, this.widgetId);
  }

  /**
   * Intentionally empty.
   *
   * All Three.js mutations happen in onTick(), which fires before apply() each frame.
   * This is the correct pattern for time-driven procedural elements where compiled state
   * is configuration, not per-tick baked position.
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
  }

  // ── IAnimationController ────────────────────────────────────────────────────

  onTick(context: AnimationTickContext): void {
    if (!this.threeScene || !this.cache) return;
    // resolvedState is populated by RuntimeDriverImpl for FunctionalTransitionSpec widgets.
    const state = (context.resolvedState as SpotlightRigState | null) ?? this.defaultState;
    const refs: SpotlightRigRefs = { scene: this.threeScene, cache: this.cache };
    applySpotlightRig(state, refs, context.clock.wallTimeSeconds);
  }
}
