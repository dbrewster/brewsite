// Tests for the requiresTypeProp guard in WidgetRegistry routing NodeHandler (§7.3).
// Verifies console.error fires when a DSL node lacks the required "type" prop.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WidgetRegistry } from '../WidgetRegistry';
import { clearRegistry, getNodeHandler } from '../../compiler/registry';
import type { ISceneElement, IRenderable, WidgetInitContext, WidgetRenderContext } from '../types';
import type { CompileApi } from '../../compiler/sceneDslTypes';
import type { NodeHandler } from '../../compiler/sceneDslTypes';
import type { FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';

// ─── Test doubles ─────────────────────────────────────────────────────────────

const makeNoopSpec = <T,>(): FunctionalTransitionSpec<T> => ({
  exitFn: (from) => () => from,
  enterFn: (to) => () => to,
  interpolateFn: (_from, to) => () => to,
});

type SimpleState = { enabled: boolean };

/**
 * Widget that declares requiresTypeProp = true.
 * Used to verify the guard fires when type prop is missing.
 */
class TypedWidget implements ISceneElement<SimpleState>, IRenderable<SimpleState> {
  readonly widgetId: string;
  readonly defaultState: SimpleState = { enabled: true };
  readonly transitionSpec = makeNoopSpec<SimpleState>();
  readonly requiresTypeProp = true as const;

  // Named function component so displayName is set
  readonly DslComponent: React.ComponentType<{ id?: string; type?: string }>;

  constructor(id: string) {
    this.widgetId = id;
    const comp = function TypedDslComponent() { return null; };
    this.DslComponent = comp;
  }

  initialize(_ctx: WidgetInitContext): void {}
  apply(_state: SimpleState, _ctx: WidgetRenderContext): void {}
  dispose(): void {}
}

/**
 * Widget WITHOUT requiresTypeProp.
 * Used to verify the guard does NOT fire for plain widgets.
 */
class PlainWidget implements ISceneElement<SimpleState>, IRenderable<SimpleState> {
  readonly widgetId: string;
  readonly defaultState: SimpleState = { enabled: true };
  readonly transitionSpec = makeNoopSpec<SimpleState>();

  readonly DslComponent: React.ComponentType<{ id?: string }>;

  constructor(id: string) {
    this.widgetId = id;
    const comp = function PlainDslComponent() { return null; };
    this.DslComponent = comp;
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
  stripUndefinedDeep: (v: unknown) => v,
} as Parameters<NodeHandler>[2]);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('requiresTypeProp guard in WidgetRegistry routing NodeHandler', () => {
  let registry: WidgetRegistry;

  beforeEach(() => {
    clearRegistry();
    registry = new WidgetRegistry();
  });

  it('fires console.error when type prop is missing on a requiresTypeProp widget', () => {
    const widget = new TypedWidget('typed-w');
    registry.register(widget);

    const handler = getNodeHandler(widget.DslComponent);
    expect(handler).not.toBeNull();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = makeFakeApi();
    const fakeNode = { type: widget.DslComponent, props: { id: 'typed-w' } }; // no 'type' prop

    handler!(fakeNode as never, api, makeFakeHelpers());

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]?.[0]).toContain('[WidgetRegistry]');
    expect(errorSpy.mock.calls[0]?.[0]).toContain('requires a "type" prop');

    errorSpy.mockRestore();
  });

  it('returns early (skips compilation) when type prop is missing', () => {
    const widget = new TypedWidget('typed-skip');
    registry.register(widget);

    const handler = getNodeHandler(widget.DslComponent);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = makeFakeApi();
    const fakeNode = { type: widget.DslComponent, props: { id: 'typed-skip' } }; // no 'type' prop

    handler!(fakeNode as never, api, makeFakeHelpers());

    // No widget state should have been set — compilation was skipped
    expect(api.widgetStates['typed-skip']).toBeUndefined();

    errorSpy.mockRestore();
  });

  it('does NOT fire console.error when type prop is present', () => {
    const widget = new TypedWidget('typed-present');
    registry.register(widget);

    const handler = getNodeHandler(widget.DslComponent);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = makeFakeApi();
    // Includes 'type' prop — guard should not fire
    const fakeNode = { type: widget.DslComponent, props: { id: 'typed-present', type: 'variant-a' } };

    handler!(fakeNode as never, api, makeFakeHelpers());

    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('does NOT fire console.error for a widget without requiresTypeProp', () => {
    const widget = new PlainWidget('plain-no-type');
    registry.register(widget);

    const handler = getNodeHandler(widget.DslComponent);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = makeFakeApi();
    // No 'type' prop — but widget doesn't require one
    const fakeNode = { type: widget.DslComponent, props: { id: 'plain-no-type' } };

    handler!(fakeNode as never, api, makeFakeHelpers());

    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('error message includes the widget displayName and the missing id', () => {
    const widget = new TypedWidget('typed-msg');
    registry.register(widget);

    const handler = getNodeHandler(widget.DslComponent);
    const errorMessages: string[] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errorMessages.push(String(args[0]));
    });

    const api = makeFakeApi();
    const fakeNode = { type: widget.DslComponent, props: { id: 'my-element-id' } }; // no type

    handler!(fakeNode as never, api, makeFakeHelpers());

    expect(errorMessages[0]).toContain('my-element-id');
    expect(errorMessages[0]).toContain('type="..."');

    errorSpy.mockRestore();
  });
});
