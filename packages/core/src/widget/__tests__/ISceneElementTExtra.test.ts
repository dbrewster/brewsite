// Tests that TExtra flows correctly through ISceneElement → compileExtra → WidgetRenderContext.
// Verifies the generics are wired correctly without any runtime Three.js or React dependencies.

import { describe, it, expect, vi } from 'vitest';
import type {
  ISceneElement,
  IRenderable,
  WidgetRenderContext,
  WidgetInitContext,
  CompileExtraContext,
} from '../types';
import type { ElementTransitionSpec } from '../../compiler/transitions/transitionTypes';

// ─── Test types ─────────────────────────────────────────────────────────────

type TestState = { value: number };
type TestExtra = { compiledFrames: number[]; label: string };

const makeNoopSpec = <T,>(): ElementTransitionSpec<T> => ({
  exit: (frames, widgetId, fromState) => {
    for (const frame of frames) frame.state.widgets[widgetId] = fromState;
  },
  enter: (frames, widgetId, toState) => {
    for (const frame of frames) frame.state.widgets[widgetId] = toState;
  },
  interpolate: (frames, widgetId, _from, toState) => {
    for (const frame of frames) frame.state.widgets[widgetId] = toState;
  },
});

// ─── Widget that uses TExtra ──────────────────────────────────────────────────

/**
 * Widget implementing both ISceneElement<TState, TExtra> and IRenderable<TState, TExtra>.
 * Captures the extra value passed to apply() so tests can assert on it.
 */
class ExtraWidget
  implements ISceneElement<TestState, TestExtra>, IRenderable<TestState, TestExtra>
{
  readonly widgetId = 'extra-widget';
  readonly defaultState: TestState = { value: 0 };
  readonly transitionSpec = makeNoopSpec<TestState>();
  readonly DslComponent = () => null as never;

  capturedExtra: TestExtra | null = null;
  capturedState: TestState | null = null;

  compileExtra(_state: TestState, _ctx: CompileExtraContext): TestExtra {
    return { compiledFrames: [1, 2, 3], label: 'test' };
  }

  initialize(_ctx: WidgetInitContext): void {}

  apply(state: TestState, ctx: WidgetRenderContext<TestExtra>): void {
    this.capturedState = state;
    // ctx.extra is typed as TestExtra — no cast needed
    this.capturedExtra = ctx.extra;
  }

  dispose(): void {}
}

// ─── Minimal WidgetRenderContext helper ───────────────────────────────────────

const makeRenderCtx = <TExtra>(extra: TExtra): WidgetRenderContext<TExtra> => ({
  clock: { wallTimeSeconds: 0, deltaSeconds: 0.016 },
  effectiveDeltaSeconds: 0.016,
  globalProgress: 0.5,
  variables: { get: () => null } as WidgetRenderContext<TExtra>['variables'],
  extra,
  tick: null,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ISceneElement TExtra generic', () => {
  it('compileExtra returns the typed extra value', () => {
    const widget = new ExtraWidget();
    const ctx: CompileExtraContext = {
      sceneProgress: 0.5,
      globalProgress: 0.5,
      prefersReducedMotion: false,
    };
    const extra = widget.compileExtra({ value: 42 }, ctx);
    expect(extra.compiledFrames).toEqual([1, 2, 3]);
    expect(extra.label).toBe('test');
  });

  it('apply() receives TExtra as typed extra — no cast needed', () => {
    const widget = new ExtraWidget();
    const extra: TestExtra = { compiledFrames: [10, 20], label: 'hello' };
    const ctx = makeRenderCtx(extra);

    widget.apply({ value: 7 }, ctx);

    expect(widget.capturedState).toEqual({ value: 7 });
    expect(widget.capturedExtra).toBe(extra);
    expect(widget.capturedExtra?.label).toBe('hello');
    expect(widget.capturedExtra?.compiledFrames).toEqual([10, 20]);
  });

  it('WidgetRenderContext<unknown> accepts any extra value', () => {
    // This verifies that the default generic (unknown) does not break existing callers
    const ctx: WidgetRenderContext<unknown> = makeRenderCtx({ arbitrary: true });
    expect(ctx.extra).toEqual({ arbitrary: true });
  });

  it('WidgetRenderContext default generic is unknown', () => {
    // WidgetRenderContext without explicit TExtra uses unknown
    const ctx: WidgetRenderContext = makeRenderCtx(undefined);
    // extra is unknown — accessing it requires an assertion in real code
    expect(ctx.extra).toBeUndefined();
  });

  it('IRenderable<TState, TExtra> apply is called with the typed context', () => {
    const widget = new ExtraWidget();
    const extra: TestExtra = { compiledFrames: [5], label: 'from-runtime' };

    // Simulate what RuntimeDriverImpl does: pass extra from compiled state
    const ctx = makeRenderCtx(extra);
    widget.apply({ value: 99 }, ctx);

    expect(widget.capturedExtra?.label).toBe('from-runtime');
  });

  it('widget with no TExtra uses default unknown generic', () => {
    // Widget without TExtra should still satisfy IRenderable<TState>
    class SimpleWidget implements IRenderable<TestState> {
      readonly widgetId = 'simple';
      initialize(_ctx: WidgetInitContext): void {}
      apply(state: TestState, ctx: WidgetRenderContext): void {
        // ctx.extra is unknown — this is the fallback for non-typed widgets
        void state;
        void ctx;
      }
      dispose(): void {}
    }

    const w = new SimpleWidget();
    const ctx = makeRenderCtx(undefined);
    // Should not throw — IRenderable<TState> defaults to WidgetRenderContext<unknown>
    expect(() => w.apply({ value: 0 }, ctx)).not.toThrow();
  });
});
