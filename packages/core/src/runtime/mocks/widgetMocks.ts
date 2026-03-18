// Widget-SDK-aware test doubles for runtime and compiler tests.
// These implement the widget interfaces with observable state — no Three.js required.
// Use these instead of vi.fn() mocks of internals; test at the interface boundary.

import type {
  IAnimationController,
  IRenderable,
  ISceneElement,
  WidgetInitContext,
  WidgetRenderContext,
  AnimationTickContext,
} from '../../widget/types';
import type { FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';

// ─── MockRenderable ───────────────────────────────────────────────────────────

/** A mock IRenderable that records every apply() call for assertion. */
export type MockRenderable = IRenderable<unknown> & {
  readonly appliedStates: unknown[];
  readonly initializeCalled: boolean;
  readonly disposeCalled: boolean;
};

/**
 * Creates a minimal IRenderable test double.
 * Records every apply() call in appliedStates for assertion.
 * Does not require Three.js.
 */
export const createMockRenderable = (id: string): MockRenderable => {
  const appliedStates: unknown[] = [];
  let initializeCalled = false;
  let disposeCalled = false;

  return {
    widgetId: id,
    get appliedStates() { return appliedStates; },
    get initializeCalled() { return initializeCalled; },
    get disposeCalled() { return disposeCalled; },
    initialize(_ctx: WidgetInitContext): void { initializeCalled = true; },
    apply(state: unknown, _ctx: WidgetRenderContext): void { appliedStates.push(state); },
    dispose(): void { disposeCalled = true; },
  };
};

// ─── MockSceneElementWidget ───────────────────────────────────────────────────

/** A mock ISceneElement + IRenderable that records apply() calls. */
export type MockSceneElementWidget<TState> = ISceneElement<TState> & IRenderable<TState> & {
  readonly appliedStates: TState[];
};

/**
 * Creates a minimal ISceneElement + IRenderable test double with a given default state.
 * The transition spec is identity (no blending) — the "to" state is always returned.
 * Useful for testing compiler and runtime tick logic without element-specific behaviour.
 */
export const createMockSceneElementWidget = <TState>(
  id: string,
  defaultState: TState,
): MockSceneElementWidget<TState> => {
  const appliedStates: TState[] = [];
  const transitionSpec: FunctionalTransitionSpec<TState> = {
    exitFn: (from) => () => from,
    enterFn: (to) => () => to,
    interpolateFn: (_from, to) => () => to,
  };

  return {
    widgetId: id,
    defaultState,
    transitionSpec,
    DslComponent: () => null,
    get appliedStates() { return appliedStates; },
    initialize(_ctx: WidgetInitContext): void {},
    apply(state: TState, _ctx: WidgetRenderContext): void { appliedStates.push(state); },
    dispose(): void {},
  };
};

// ─── MockAnimationController ──────────────────────────────────────────────────

/** A mock IAnimationController that records every onTick() call. */
export type MockAnimationController = IAnimationController & {
  readonly tickCount: number;
  readonly lastCtx: AnimationTickContext | null;
};

/**
 * Creates a minimal IAnimationController test double.
 * Records the number of onTick() calls and the last AnimationTickContext received.
 */
export const createMockAnimationController = (
  id: string,
  tickPriority?: number,
): MockAnimationController => {
  let tickCount = 0;
  let lastCtx: AnimationTickContext | null = null;

  return {
    widgetId: id,
    tickPriority,
    get tickCount() { return tickCount; },
    get lastCtx() { return lastCtx; },
    onTick(ctx: AnimationTickContext): void {
      tickCount++;
      lastCtx = ctx;
    },
  };
};
