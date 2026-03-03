// Tests for IHasCustomDslHandler interface and hasCustomDslHandler type guard.
// Verifies WidgetRegistry routing invokes [CUSTOM_NODE_HANDLER] for implementing widgets.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WidgetRegistry,
  CUSTOM_NODE_HANDLER,
  hasCustomDslHandler,
  isSceneElement,
} from '../WidgetRegistry';
import type { IHasCustomDslHandler } from '../WidgetRegistry';
import type {
  ISceneElement,
  IRenderable,
  IWidget,
  WidgetInitContext,
  WidgetRenderContext,
} from '../types';
import type { NodeHandler } from '../../compiler/sceneDslTypes';
import type { CompileApi } from '../../compiler/sceneDslTypes';
import { clearRegistry, getNodeHandler } from '../../compiler/registry';
import type { ElementTransitionSpec } from '../../compiler/transitions/transitionTypes';

// ─── Test doubles ────────────────────────────────────────────────────────────

type SimpleState = { enabled: boolean };

const makeNoopSpec = <T,>(): ElementTransitionSpec<T> => ({
  exit: (frames, id, fromState) => { for (const f of frames) f.state.widgets[id] = fromState; },
  enter: (frames, id, toState) => { for (const f of frames) f.state.widgets[id] = toState; },
  interpolate: (frames, id, _f, toState) => { for (const f of frames) f.state.widgets[id] = toState; },
});

/**
 * Widget that does NOT implement IHasCustomDslHandler — uses default shallow-merge routing.
 */
class PlainWidget implements ISceneElement<SimpleState>, IRenderable<SimpleState> {
  readonly widgetId: string;
  readonly defaultState: SimpleState;
  readonly transitionSpec = makeNoopSpec<SimpleState>();
  readonly DslComponent: () => null;

  constructor(id: string) {
    this.widgetId = id;
    this.defaultState = { enabled: true };
    this.DslComponent = () => null;
  }

  initialize(_ctx: WidgetInitContext): void {}
  apply(_state: SimpleState, _ctx: WidgetRenderContext): void {}
  dispose(): void {}
}

/**
 * Widget that implements IHasCustomDslHandler via class property pattern.
 * Tracks calls to the handler so tests can assert on invocations.
 */
class CustomHandlerWidget
  implements ISceneElement<SimpleState>, IRenderable<SimpleState>, IHasCustomDslHandler
{
  readonly widgetId: string;
  readonly defaultState: SimpleState;
  readonly transitionSpec = makeNoopSpec<SimpleState>();
  readonly DslComponent: () => null;

  handlerCallCount = 0;
  lastNode: Parameters<NodeHandler>[0] | null = null;
  lastApi: CompileApi | null = null;

  readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node, api) => {
    this.handlerCallCount++;
    this.lastNode = node;
    this.lastApi = api;
    api.setWidgetState(this.widgetId, { enabled: false });
  };

  constructor(id: string) {
    this.widgetId = id;
    this.defaultState = { enabled: true };
    this.DslComponent = () => null;
  }

  initialize(_ctx: WidgetInitContext): void {}
  apply(_state: SimpleState, _ctx: WidgetRenderContext): void {}
  dispose(): void {}
}

/** Minimal real CompileApi double used to invoke registered node handlers. */
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

const makeFakeHelpers = () => ({
  collectChildren: () => [],
  resolveValue: (v: unknown) => v,
  resolveObjectValues: (v: unknown) => v,
} as Parameters<NodeHandler>[2]);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('hasCustomDslHandler type guard', () => {
  it('returns false for a plain IWidget', () => {
    const widget: IWidget = { widgetId: 'plain' };
    expect(hasCustomDslHandler(widget)).toBe(false);
  });

  it('returns false for a PlainWidget (no CUSTOM_NODE_HANDLER)', () => {
    const widget = new PlainWidget('no-handler');
    expect(hasCustomDslHandler(widget)).toBe(false);
  });

  it('returns true for a widget that implements IHasCustomDslHandler', () => {
    const widget = new CustomHandlerWidget('with-handler');
    expect(hasCustomDslHandler(widget)).toBe(true);
  });

  it('narrows type to IHasCustomDslHandler when true', () => {
    const widget = new CustomHandlerWidget('typed');
    if (hasCustomDslHandler(widget)) {
      // TypeScript accepts accessing [CUSTOM_NODE_HANDLER] here without cast
      const handler = widget[CUSTOM_NODE_HANDLER];
      expect(typeof handler).toBe('function');
    } else {
      throw new Error('Expected hasCustomDslHandler to return true');
    }
  });

  it('CUSTOM_NODE_HANDLER is a unique symbol', () => {
    expect(typeof CUSTOM_NODE_HANDLER).toBe('symbol');
    expect(CUSTOM_NODE_HANDLER.toString()).toContain('customNodeHandler');
  });
});

describe('WidgetRegistry CUSTOM_NODE_HANDLER routing', () => {
  let registry: WidgetRegistry;

  beforeEach(() => {
    clearRegistry();
    registry = new WidgetRegistry();
  });

  it('invokes [CUSTOM_NODE_HANDLER] instead of default prop-merge when widget implements IHasCustomDslHandler', () => {
    const widget = new CustomHandlerWidget('custom-w');
    registry.register(widget);

    const handler = getNodeHandler(widget.DslComponent);
    expect(handler).not.toBeNull();

    const api = makeFakeApi();
    const fakeNode = { type: widget.DslComponent, props: { id: 'custom-w' } };
    handler!(fakeNode as never, api, makeFakeHelpers());

    expect(widget.handlerCallCount).toBe(1);
    expect(api.widgetStates['custom-w']).toEqual({ enabled: false });
  });

  it('uses default shallow-merge for PlainWidget (no CUSTOM_NODE_HANDLER)', () => {
    const widget = new PlainWidget('plain-w');
    registry.register(widget);

    const handler = getNodeHandler(widget.DslComponent);
    expect(handler).not.toBeNull();

    const api = makeFakeApi();
    const fakeNode = { type: widget.DslComponent, props: { id: 'plain-w', enabled: false } };
    handler!(fakeNode as never, api, makeFakeHelpers());

    // Default path: shallow-merges defaultState + props
    expect(api.widgetStates['plain-w']).toMatchObject({ enabled: false });
  });

  it('IHasCustomDslHandler handler receives the correct node and api', () => {
    const widget = new CustomHandlerWidget('check-args');
    registry.register(widget);

    const handler = getNodeHandler(widget.DslComponent);
    const api = makeFakeApi();
    const fakeNode = { type: widget.DslComponent, props: { id: 'check-args', extra: 'data' } };
    handler!(fakeNode as never, api, makeFakeHelpers());

    expect(widget.lastNode).toBe(fakeNode);
    expect(widget.lastApi).toBe(api);
  });

  it('hasCustomDslHandler is consistent with WidgetRegistry routing decision', () => {
    // The type guard used by WidgetRegistry matches the type guard exported to consumers
    const withHandler = new CustomHandlerWidget('has');
    const withoutHandler = new PlainWidget('has-not');

    expect(hasCustomDslHandler(withHandler)).toBe(true);
    expect(hasCustomDslHandler(withoutHandler)).toBe(false);

    // Also verify via the registry's isSceneElement guard
    expect(isSceneElement(withHandler)).toBe(true);
    expect(isSceneElement(withoutHandler)).toBe(true);
  });
});

describe('IHasCustomDslHandler interface contract', () => {
  it('implementing class exposes [CUSTOM_NODE_HANDLER] on the instance', () => {
    const widget = new CustomHandlerWidget('contract-check');
    expect(CUSTOM_NODE_HANDLER in widget).toBe(true);
  });

  it('[CUSTOM_NODE_HANDLER] property is callable as a NodeHandler', () => {
    const widget = new CustomHandlerWidget('callable');
    const api = makeFakeApi();
    const fakeNode = { type: () => null, props: { id: 'callable' } };

    // Direct invocation (without going through WidgetRegistry)
    expect(() =>
      widget[CUSTOM_NODE_HANDLER](fakeNode as never, api, makeFakeHelpers()),
    ).not.toThrow();

    expect(widget.handlerCallCount).toBe(1);
  });
});
