// WidgetRegistry tests — interface-based stateful tests.
// Tests exercise the public contract of WidgetRegistry through real inputs
// and assert on observable outputs; no vi.fn() mocks of internal calls.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WidgetRegistry, CUSTOM_NODE_HANDLER } from '../WidgetRegistry';
import {
  clearRegistry,
  getNodeHandler,
  registerNode,
} from '../../compiler/registry';
import type {
  IAnimationController,
  ISceneElement,
  IRenderable,
  IDslComposite,
  IRendererLifecycle,
  IRenderContributor,
  IContainedRenderable,
  IAttachmentHost,
  WidgetInitContext,
  WidgetRenderContext,
} from '../types';
import type { IWidget } from '../types';
import {
  isRendererLifecycle,
  isCameraActionTarget,
  isRenderContributor,
  isContainedRenderable,
  isAttachmentHost,
  isCameraFocusTarget,
  isLightingOverride,
} from '../WidgetRegistry';
import type { ICameraFocusTarget, ILightingOverride } from '../types';
import type { CompileApi } from '../../compiler/sceneDslTypes';
import type { NodeHandler } from '../../compiler/sceneDslTypes';
import type { ElementTransitionSpec } from '../../compiler/transitions/transitionTypes';

// ---------------------------------------------------------------------------
// Minimal test doubles
// ---------------------------------------------------------------------------

type TestState = { value: number };

const makeNoopSpec = <T,>(): ElementTransitionSpec<T> => ({
  exit: (frames, widgetId, fromState) => {
    for (const frame of frames) {
      frame.state.widgets[widgetId] = fromState;
    }
  },
  enter: (frames, widgetId, toState) => {
    for (const frame of frames) {
      frame.state.widgets[widgetId] = toState;
    }
  },
  interpolate: (frames, widgetId, _fromState, toState) => {
    for (const frame of frames) {
      frame.state.widgets[widgetId] = toState;
    }
  },
});

class TestWidget implements ISceneElement<TestState>, IRenderable<TestState> {
  readonly widgetId: string;
  readonly defaultState: TestState;
  readonly transitionSpec = makeNoopSpec<TestState>();
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
    pushHudItem: () => {},
    setWidgetState: (id, s) => { widgetStates[id] = s; },
    setSceneMeta: () => {},
    pushWarning: () => {},
  };
};

// Minimal CompileHelpers double — identity implementations of the helper methods.
const makeFakeHelpers = () => ({
  collectChildren: () => [],
  resolveValue: (v: unknown) => v,
  resolveObjectValues: <T>(v: T) => v,
  stripUndefinedDeep: <T>(v: T) => v,
} as Parameters<NodeHandler>[2]);

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

  it('throws on duplicate id when strict=true', () => {
    const strictRegistry = new WidgetRegistry({ strict: true });
    strictRegistry.register(new TestWidget('dupe'));
    expect(() => strictRegistry.register(new TestWidget('dupe'))).toThrow(/already registered/i);
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
      readonly transitionSpec = makeNoopSpec<TestState>();
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
      readonly transitionSpec = makeNoopSpec<TestState>();
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

  it('routes by id prop when multiple widgets share the same DslComponent', () => {
    const SharedComponent = (): null => null;

    class SharedWidget extends TestWidget {
      constructor(id: string) {
        super(id);
        // Override DslComponent to shared reference
        // @ts-expect-error test override
        this.DslComponent = SharedComponent;
      }
    }

    const alpha = new SharedWidget('alpha');
    const beta = new SharedWidget('beta');
    registry.register(alpha).register(beta);

    const handler = getNodeHandler(SharedComponent);
    const api = makeFakeApi();
    handler?.({ props: { id: 'beta', value: 42 } } as never, api as never, makeFakeHelpers());
    expect(api.widgetStates['beta']).toMatchObject({ value: 42, id: 'beta' });
  });

  it('uses CUSTOM_NODE_HANDLER when provided', () => {
    const widget = new TestWidget('custom');
    (widget as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (node, api) => {
      api.setWidgetState('custom', { value: 9, id: (node.props as { id?: string }).id });
    };
    registry.register(widget);
    const handler = getNodeHandler(widget.DslComponent);
    const api = makeFakeApi();
    handler?.({ props: { id: 'custom' } } as never, api as never, makeFakeHelpers());
    expect(api.widgetStates['custom']).toEqual({ value: 9, id: 'custom' });
  });

  it('does not override existing node handlers', () => {
    const Existing = (): null => null;
    const existingHandler: NodeHandler = (_node, api) => {
      api.setSceneMeta({ id: 'existing' });
    };
    registerNode(Existing, existingHandler);

    class WidgetWithExisting extends TestWidget {
      constructor(id: string) {
        super(id);
        // @ts-expect-error test override
        this.DslComponent = Existing;
      }
    }

    registry.register(new WidgetWithExisting('w'));
    expect(getNodeHandler(Existing)).toBe(existingHandler);
  });

  it('pushes MISSING_WIDGET warning when no widget is found for DSL component with id', () => {
    const widget = new TestWidget('only');
    registry.register(widget);
    const handler = getNodeHandler(widget.DslComponent);
    const api = makeFakeApi();
    const warnings: Array<{ code?: string }> = [];
    api.pushWarning = (warning) => {
      warnings.push(warning as { code?: string });
    };
    handler?.({ props: { id: 'missing' } } as never, api as never, makeFakeHelpers());
    expect(warnings[0]?.code).toBe('MISSING_WIDGET');
  });

  it('buildCacheKey includes widget ID in cache key', () => {
    const widget = new TestWidget('my-widget-id');
    registry.register(widget);
    const key = registry.buildCacheKey();
    expect(key).toContain('my-widget-id');
  });

  it('detects variable providers', () => {
    const provider = { widgetId: 'vars', variableNamespace: 'ns', variableKeys: ['a'] } as const;
    registry.register(provider);
    const all = registry.getAll();
    const found = all.find((w) => w.widgetId === 'vars');
    expect(found).toBeDefined();
    expect('variableNamespace' in (found as object)).toBe(true);
  });

  it('error-throwing handler message includes the child display name', () => {
    const BadChild = (): null => null;

    class OwnerWidget
      implements ISceneElement<TestState>, IRenderable<TestState>, IDslComposite
    {
      readonly widgetId = 'owner';
      readonly defaultState: TestState = { value: 0 };
      readonly transitionSpec = makeNoopSpec<TestState>();
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
      readonly transitionSpec = makeNoopSpec<TestState>();
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

  // ─── Phase 1 type guards ─────────────────────────────────────────────────

  it('isRendererLifecycle returns true only for widgets with both lifecycle methods', () => {
    const plain: IWidget = { widgetId: 'plain' };
    expect(isRendererLifecycle(plain)).toBe(false);

    const lifecycle: IWidget & IRendererLifecycle = {
      widgetId: 'lifecycle',
      onRendererCreated: () => {},
      onRendererDisposing: () => {},
    };
    expect(isRendererLifecycle(lifecycle)).toBe(true);
    expect(isRendererLifecycle({ widgetId: 'x', onRendererCreated: () => {} } as IWidget)).toBe(false);
  });

  it('isRenderContributor returns true only for widgets with contributeRenderData method', () => {
    const plain: IWidget = { widgetId: 'plain' };
    expect(isRenderContributor(plain)).toBe(false);

    const contributor: IWidget & IRenderContributor = {
      widgetId: 'contributor',
      contributeRenderData: () => ({ namedPositions: new Map(), targetColors: new Map() }),
    };
    expect(isRenderContributor(contributor)).toBe(true);
  });

  it('isCameraActionTarget returns true only for widgets with camera action methods', () => {
    const plain: IWidget = { widgetId: 'plain' };
    expect(isCameraActionTarget(plain)).toBe(false);

    const target = {
      widgetId: 'camera-target',
      applyOrbit: () => {},
      applyDolly: () => {},
      applyReset: () => {},
    } as IWidget;
    expect(isCameraActionTarget(target)).toBe(true);
    expect(isCameraActionTarget({ widgetId: 'x', applyOrbit: () => {}, applyDolly: () => {} } as IWidget)).toBe(false);
  });

  it('isContainedRenderable returns true only for widgets with anchorWidgetId, anchorKey, rootObject', () => {
    const plain: IWidget = { widgetId: 'plain' };
    expect(isContainedRenderable(plain)).toBe(false);

    const THREE = { Group: class { name = '' } };
    const contained: IWidget & IContainedRenderable = {
      widgetId: 'contained',
      anchorWidgetId: 'host',
      anchorKey: 'head',
      rootObject: {} as never,
    };
    expect(isContainedRenderable(contained)).toBe(true);
    // Missing rootObject — should return false
    expect(isContainedRenderable({ widgetId: 'x', anchorWidgetId: 'y', anchorKey: 'z' } as IWidget)).toBe(false);
  });

  it('isAttachmentHost returns true only for widgets with getAttachmentPoint method', () => {
    const plain: IWidget = { widgetId: 'plain' };
    expect(isAttachmentHost(plain)).toBe(false);

    const host: IWidget & IAttachmentHost = {
      widgetId: 'host',
      getAttachmentPoint: (_key: string) => null,
    };
    expect(isAttachmentHost(host)).toBe(true);
  });

  it('getContainedRenderables() returns only IContainedRenderable widgets', () => {
    const contained: IWidget & IContainedRenderable = {
      widgetId: 'contained',
      anchorWidgetId: 'host',
      anchorKey: 'head',
      rootObject: {} as never,
    };
    const plain = new TestWidget('plain');
    registry.register(plain);
    registry.register(contained);
    const result = registry.getContainedRenderables();
    expect(result).toHaveLength(1);
    expect(result[0]!.widgetId).toBe('contained');
  });

  it('getAttachmentHosts() returns only IAttachmentHost widgets', () => {
    const host: IWidget & IAttachmentHost = {
      widgetId: 'host',
      getAttachmentPoint: () => null,
    };
    const plain = new TestWidget('plain');
    registry.register(plain);
    registry.register(host);
    const result = registry.getAttachmentHosts();
    expect(result).toHaveLength(1);
    expect(result[0]!.widgetId).toBe('host');
  });

  it('notifyRendererCreated broadcasts to all IRendererLifecycle widgets', () => {
    const calls: string[] = [];
    const lifecycle: IWidget & IRendererLifecycle = {
      widgetId: 'lifecycle',
      onRendererCreated: () => { calls.push('created'); },
      onRendererDisposing: () => { calls.push('disposing'); },
    };
    const plain = new TestWidget('plain');
    registry.register(plain);
    registry.register(lifecycle);
    registry.notifyRendererCreated({} as never);
    expect(calls).toEqual(['created']);
    registry.notifyRendererDisposing({} as never);
    expect(calls).toEqual(['created', 'disposing']);
  });

  // ─── S4.3.A — freeze() ──────────────────────────────────────────────────

  it('freeze() → subsequent register() throws with descriptive message', () => {
    registry.register(new TestWidget('a'));
    registry.freeze();
    expect(() => registry.register(new TestWidget('b'))).toThrow(
      /Cannot register widget "b" after freeze\(\)/,
    );
  });

  it('freeze() → subsequent registerTypeFactory() throws', () => {
    registry.freeze();
    expect(() => registry.registerTypeFactory(() => null, () => ({ widgetId: 'x' }))).toThrow(
      /Cannot registerTypeFactory after freeze\(\)/,
    );
  });

  it('freeze() does not prevent reads after freezing', () => {
    registry.register(new TestWidget('readable'));
    registry.freeze();
    expect(registry.get('readable')).toBeDefined();
    expect(registry.getAll()).toHaveLength(1);
  });

  // ─── S4.3.B — dispatchToWidget() regression ─────────────────────────────

  it('dispatchToWidget() routes to CUSTOM_NODE_HANDLER when present', () => {
    const customCalls: unknown[] = [];
    const CustomDsl = (): null => null;

    class DispatchWidget implements ISceneElement<TestState> {
      readonly widgetId = 'dispatch-custom';
      readonly defaultState: TestState = { value: 0 };
      readonly transitionSpec = makeNoopSpec<TestState>();
      readonly DslComponent = CustomDsl;

      constructor() {
        (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (node, api) => {
          customCalls.push(node);
          api.setWidgetState('dispatch-custom', { value: 77 });
        };
      }
    }

    registry.register(new DispatchWidget());
    const handler = getNodeHandler(CustomDsl) as NodeHandler;
    const api = makeFakeApi();
    handler({ props: { id: 'dispatch-custom' } } as never, api as never, {} as never);
    expect(customCalls).toHaveLength(1);
    expect(api.widgetStates['dispatch-custom']).toEqual({ value: 77 });
  });

  it('dispatchToWidget() shallow-merges props into state when no CUSTOM_NODE_HANDLER', () => {
    const Dsl = (): null => null;
    class SimpleWidget implements ISceneElement<TestState> {
      readonly widgetId = 'dispatch-simple';
      readonly defaultState: TestState = { value: 0 };
      readonly transitionSpec = makeNoopSpec<TestState>();
      readonly DslComponent = Dsl;
    }
    registry.register(new SimpleWidget());
    const handler = getNodeHandler(Dsl) as NodeHandler;
    const api = makeFakeApi();
    const helpers = {
      resolveObjectValues: <T>(v: T) => v,
      stripUndefinedDeep: <T>(v: T) => v,
      collectChildren: () => [],
      resolveValue: (v: unknown) => v,
    };
    handler(
      { props: { id: 'dispatch-simple', value: 42 } } as never,
      api as never,
      helpers as never,
    );
    expect((api.widgetStates['dispatch-simple'] as TestState).value).toBe(42);
  });

  // ─── S4.3.C — isCameraFocusTarget / isLightingOverride type guards ───────

  it('isCameraFocusTarget returns true only for widgets with requestFocus method', () => {
    const plain: IWidget = { widgetId: 'plain' };
    expect(isCameraFocusTarget(plain)).toBe(false);

    const target: IWidget & ICameraFocusTarget = {
      widgetId: 'camera-focus',
      requestFocus: () => {},
    };
    expect(isCameraFocusTarget(target)).toBe(true);
  });

  it('isLightingOverride returns true only for widgets with getLightingOverride method', () => {
    const plain: IWidget = { widgetId: 'plain' };
    expect(isLightingOverride(plain)).toBe(false);

    const override: IWidget & ILightingOverride = {
      widgetId: 'lighting-override',
      getLightingOverride: () => null,
    };
    expect(isLightingOverride(override)).toBe(true);
  });

  // ─── S4.3.D — getAllWidgets() ────────────────────────────────────────────

  it('getAllWidgets() returns an iterable of all registered widgets', () => {
    registry.register(new TestWidget('w1'));
    registry.register(new TestWidget('w2'));
    const all = [...registry.getAllWidgets()];
    expect(all).toHaveLength(2);
    expect(all.map((w) => w.widgetId).sort()).toEqual(['w1', 'w2']);
  });

  it('getAllWidgets() can be filtered for interface implementors', () => {
    const override: IWidget & ILightingOverride = {
      widgetId: 'lo',
      getLightingOverride: () => ({ disableAll: true }),
    };
    registry.register(new TestWidget('plain'));
    registry.register(override);
    const overrides = [...registry.getAllWidgets()].filter(isLightingOverride);
    expect(overrides).toHaveLength(1);
    expect(overrides[0]!.widgetId).toBe('lo');
  });
});
