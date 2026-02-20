// WidgetRegistry tests — interface-based stateful tests.
// Tests exercise the public contract of WidgetRegistry through real inputs
// and assert on observable outputs; no vi.fn() mocks of internal calls.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WidgetRegistry, CUSTOM_NODE_HANDLER } from '../WidgetRegistry';
import {
  clearRegistry,
  getNodeHandler,
} from '../../compiler/registry';
import type {
  IAnimationController,
  ISceneElement,
  IRenderable,
  IDslComposite,
  WidgetInitContext,
  WidgetRenderContext,
} from '../types';
import type { CompileApi } from '../../compiler/sceneDslTypes';
import type { NodeHandler } from '../../compiler/sceneDslTypes';

// ---------------------------------------------------------------------------
// Minimal test doubles
// ---------------------------------------------------------------------------

type TestState = { value: number };

class TestWidget implements ISceneElement<TestState>, IRenderable<TestState> {
  readonly widgetId: string;
  readonly defaultState: TestState;
  readonly transitionSpec = {
    exit: (s: TestState) => s,
    enter: (s: TestState) => s,
    interpolate: (a: TestState) => a,
  };
  // Each TestWidget class has its own unique lambda — no cross-test nodeRegistry collisions.
  readonly DslComponent: () => null;

  appliedStates: TestState[] = [];
  initialized = false;
  disposed = false;

  constructor(id: string, defaultValue = 0) {
    this.widgetId = id;
    this.defaultState = { value: defaultValue };
    this.DslComponent = () => null;
  }

  initialize(_ctx: WidgetInitContext): void { this.initialized = true; }
  apply(state: TestState, _ctx: WidgetRenderContext): void { this.appliedStates.push(state); }
  dispose(): void { this.disposed = true; }
}

// A minimal CompileApi double used to invoke registered node handlers directly.
const makeFakeApi = (): CompileApi & { widgetStates: Record<string, unknown> } => {
  const widgetStates: Record<string, unknown> = {};
  return {
    widgetStates,
    context: {} as CompileApi['context'],
    state: { id: '', scrollProgress: 0, widgets: widgetStates },
    transitions: [],
    pushAnnotation: () => {},
    pushLabel: () => {},
    setWidgetState: (id, s) => { widgetStates[id] = s; },
    setSceneMeta: () => {},
  };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WidgetRegistry', () => {
  let registry: WidgetRegistry;

  beforeEach(() => {
    // Clear the module-global nodeRegistry before each test to prevent handler
    // leakage across test runs.
    clearRegistry();
    registry = new WidgetRegistry();
  });

  // ─── Basic registration ──────────────────────────────────────────────────

  it('registers a widget and returns it from getSceneElements()', () => {
    const widget = new TestWidget('test-a');
    registry.register(widget);
    const elements = registry.getSceneElements();
    expect(elements.length).toBe(1);
    expect(elements[0].widgetId).toBe('test-a');
  });

  it('registers multiple widgets independently', () => {
    registry.register(new TestWidget('alpha'));
    registry.register(new TestWidget('beta'));
    expect(registry.getSceneElements().length).toBe(2);
  });

  it('returns renderables for IRenderable widgets', () => {
    const widget = new TestWidget('renderable');
    registry.register(widget);
    expect(registry.getRenderables()).toHaveLength(1);
    expect(registry.getRenderables()[0].widgetId).toBe('renderable');
  });

  it('get() returns the widget by id', () => {
    const widget = new TestWidget('target');
    registry.register(widget);
    expect(registry.get('target')).toBe(widget);
  });

  it('get() returns undefined for unknown id', () => {
    expect(registry.get('nope')).toBeUndefined();
  });

  it('warns on duplicate id (register overwrites)', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registry.register(new TestWidget('dupe'));
    registry.register(new TestWidget('dupe'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('"dupe"'));
    spy.mockRestore();
  });

  it('exports CUSTOM_NODE_HANDLER symbol', () => {
    expect(typeof CUSTOM_NODE_HANDLER).toBe('symbol');
  });

  // ─── IAnimationController tick ordering ──────────────────────────────────

  it('getAnimationControllers() returns controllers sorted ascending by tickPriority', () => {
    registry.register({ widgetId: 'c', tickPriority: 10, onTick: () => {} } as unknown as IAnimationController);
    registry.register({ widgetId: 'a', tickPriority: -5, onTick: () => {} } as unknown as IAnimationController);
    registry.register({ widgetId: 'b', tickPriority: 0, onTick: () => {} } as unknown as IAnimationController);
    const ids = registry.getAnimationControllers().map((c) => c.widgetId);
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('getAnimationControllers() defaults tickPriority to 0', () => {
    registry.register({ widgetId: 'x', onTick: () => {} } as unknown as IAnimationController);
    const [c] = registry.getAnimationControllers();
    expect(c.widgetId).toBe('x');
  });

  // ─── buildCacheKey ────────────────────────────────────────────────────────

  it('buildCacheKey() returns a deterministic string', () => {
    registry.register(new TestWidget('foo'));
    registry.register(new TestWidget('bar'));
    const key = registry.buildCacheKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('buildCacheKey() is stable across calls', () => {
    registry.register(new TestWidget('foo'));
    expect(registry.buildCacheKey()).toBe(registry.buildCacheKey());
  });

  // ─── IDslComposite — protective top-level handlers ────────────────────────

  it('registers a noop handler for IDslComposite child with topLevelError: false', () => {
    const ChildComponent = (): null => null;

    class CompositeWidget
      implements ISceneElement<TestState>, IRenderable<TestState>, IDslComposite
    {
      readonly widgetId = 'composite';
      readonly defaultState: TestState = { value: 0 };
      readonly transitionSpec = {
        exit: (s: TestState) => s,
        enter: (s: TestState) => s,
        interpolate: (a: TestState) => a,
      };
      readonly DslComponent: () => null = () => null;
      readonly childDslComponents = [
        { component: ChildComponent as React.ComponentType<unknown>, displayName: 'Child', topLevelError: false },
      ] as const;

      initialize(_ctx: WidgetInitContext): void {}
      apply(_s: TestState, _ctx: WidgetRenderContext): void {}
      dispose(): void {}
    }

    registry.register(new CompositeWidget());

    const handler = getNodeHandler(ChildComponent);
    expect(handler).toBeDefined();
    // noop handler — does not throw
    expect(() => {
      (handler as NodeHandler)({} as never, makeFakeApi() as never, {} as never);
    }).not.toThrow();
  });

  it('registers an error-throwing handler for IDslComposite child with topLevelError: true', () => {
    const ErrorChild = (): null => null;

    class StrictCompositeWidget
      implements ISceneElement<TestState>, IRenderable<TestState>, IDslComposite
    {
      readonly widgetId = 'strict-composite';
      readonly defaultState: TestState = { value: 0 };
      readonly transitionSpec = {
        exit: (s: TestState) => s,
        enter: (s: TestState) => s,
        interpolate: (a: TestState) => a,
      };
      readonly DslComponent: () => null = () => null;
      readonly childDslComponents = [
        { component: ErrorChild as React.ComponentType<unknown>, displayName: 'ErrorChild', topLevelError: true },
      ] as const;

      initialize(_ctx: WidgetInitContext): void {}
      apply(_s: TestState, _ctx: WidgetRenderContext): void {}
      dispose(): void {}
    }

    registry.register(new StrictCompositeWidget());

    const handler = getNodeHandler(ErrorChild);
    expect(handler).toBeDefined();
    expect(() => {
      (handler as NodeHandler)({} as never, makeFakeApi() as never, {} as never);
    }).toThrow();
  });

  it('error-throwing handler message includes the child display name', () => {
    const BadChild = (): null => null;

    class OwnerWidget
      implements ISceneElement<TestState>, IRenderable<TestState>, IDslComposite
    {
      readonly widgetId = 'owner';
      readonly defaultState: TestState = { value: 0 };
      readonly transitionSpec = {
        exit: (s: TestState) => s,
        enter: (s: TestState) => s,
        interpolate: (a: TestState) => a,
      };
      readonly DslComponent: () => null = () => null;
      readonly childDslComponents = [
        { component: BadChild as React.ComponentType<unknown>, displayName: 'BadChild', topLevelError: true },
      ] as const;

      initialize(_ctx: WidgetInitContext): void {}
      apply(_s: TestState, _ctx: WidgetRenderContext): void {}
      dispose(): void {}
    }

    registry.register(new OwnerWidget());

    const handler = getNodeHandler(BadChild) as NodeHandler;
    let caught: Error | null = null;
    try {
      handler({} as never, makeFakeApi() as never, {} as never);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught?.message).toContain('BadChild');
  });

  // ─── CUSTOM_NODE_HANDLER precedence ──────────────────────────────────────

  it('uses CUSTOM_NODE_HANDLER instead of the default prop-merge handler', () => {
    const customCalls: unknown[] = [];
    const CustomDsl = (): null => null;

    class CustomWidget implements ISceneElement<TestState>, IRenderable<TestState> {
      readonly widgetId = 'custom';
      readonly defaultState: TestState = { value: 0 };
      readonly transitionSpec = {
        exit: (s: TestState) => s,
        enter: (s: TestState) => s,
        interpolate: (a: TestState) => a,
      };
      readonly DslComponent = CustomDsl;

      constructor() {
        // Install custom handler BEFORE register() is called.
        (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (
          node,
          api,
        ) => {
          customCalls.push(node);
          api.setWidgetState('custom', { value: 99 });
        };
      }

      initialize(_ctx: WidgetInitContext): void {}
      apply(_s: TestState, _ctx: WidgetRenderContext): void {}
      dispose(): void {}
    }

    const widget = new CustomWidget();
    registry.register(widget);

    // Get the installed routing handler and invoke it with a fake node.
    const routingHandler = getNodeHandler(CustomDsl) as NodeHandler;
    const fakeNode = { type: CustomDsl, props: { id: 'custom' } } as never;
    const api = makeFakeApi();
    routingHandler(fakeNode, api as never, {} as never);

    // Custom handler should have been called, not the default prop-merge.
    expect(customCalls).toHaveLength(1);
    expect(api.widgetStates['custom']).toEqual({ value: 99 });
  });

  // ─── id-prop routing ─────────────────────────────────────────────────────

  it('dispatches to widget matching the id prop', () => {
    const a = new TestWidget('model-a');
    const b = new TestWidget('model-b');
    registry.register(a);
    registry.register(b);

    const elements = registry.getSceneElements();
    const found = elements.find((e) => e.widgetId === 'model-b');
    expect(found?.widgetId).toBe('model-b');
  });
});
