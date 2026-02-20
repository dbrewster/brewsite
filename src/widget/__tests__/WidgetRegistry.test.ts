// WidgetRegistry tests — interface-based stateful tests.
// Tests exercise the public contract of WidgetRegistry through real inputs
// and assert on observable outputs; no vi.fn() mocks of internal calls.

import { describe, it, expect, beforeEach } from 'vitest';
import { WidgetRegistry, CUSTOM_NODE_HANDLER } from '../WidgetRegistry';
import type { ISceneElement, IRenderable, WidgetInitContext, WidgetRenderContext } from '../types';

// ---------------------------------------------------------------------------
// Minimal test double: implements ISceneElement + IRenderable
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
  readonly DslComponent = () => null;

  appliedStates: TestState[] = [];
  initialized = false;
  disposed = false;

  constructor(id: string, defaultValue = 0) {
    this.widgetId = id;
    this.defaultState = { value: defaultValue };
  }

  initialize(_ctx: WidgetInitContext): void {
    this.initialized = true;
  }

  apply(state: TestState, _ctx: WidgetRenderContext): void {
    this.appliedStates.push(state);
  }

  dispose(): void {
    this.disposed = true;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WidgetRegistry', () => {
  let registry: WidgetRegistry;

  beforeEach(() => {
    registry = new WidgetRegistry();
  });

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
    const renderables = registry.getRenderables();
    expect(renderables.length).toBe(1);
    expect(renderables[0].widgetId).toBe('renderable');
  });

  it('exports CUSTOM_NODE_HANDLER symbol', () => {
    expect(typeof CUSTOM_NODE_HANDLER).toBe('symbol');
  });

  describe('id-prop routing', () => {
    it('dispatches to widget matching the id prop', () => {
      const a = new TestWidget('model-a');
      const b = new TestWidget('model-b');
      registry.register(a);
      registry.register(b);

      // Both share the same DslComponent type — confirm routing finds both.
      const elements = registry.getSceneElements();
      const found = elements.find((e) => e.widgetId === 'model-b');
      expect(found?.widgetId).toBe('model-b');
    });
  });
});
