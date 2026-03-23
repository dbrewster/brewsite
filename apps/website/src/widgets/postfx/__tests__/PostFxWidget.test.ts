// Tests for PostFxWidget lifecycle and CUSTOM_NODE_HANDLER behavior.

import { describe, it, expect } from 'vitest';
import { PostFxWidget } from '../PostFxWidget';
import { DEFAULT_POST_FX_STATE } from '../compile';

describe('PostFxWidget', () => {
  it('has correct widgetId', () => {
    const widget = new PostFxWidget();
    expect(widget.widgetId).toBe('website-postfx');
  });

  it('has default state matching compile defaults', () => {
    const widget = new PostFxWidget();
    expect(widget.defaultState).toEqual(DEFAULT_POST_FX_STATE);
  });

  it('has a DslComponent', () => {
    const widget = new PostFxWidget();
    expect(widget.DslComponent).toBeDefined();
    expect(typeof widget.DslComponent).toBe('function');
  });

  it('has a transition spec with all three functions', () => {
    const widget = new PostFxWidget();
    expect(typeof widget.transitionSpec.exitFn).toBe('function');
    expect(typeof widget.transitionSpec.enterFn).toBe('function');
    expect(typeof widget.transitionSpec.interpolateFn).toBe('function');
  });

  describe('initialize', () => {
    it('gracefully handles missing renderer', () => {
      const widget = new PostFxWidget();
      // Should not throw when renderer is missing
      widget.initialize({
        scene: {} as never,
        widgetId: widget.widgetId,
        renderer: undefined,
        camera: undefined,
      });
    });
  });

  describe('apply', () => {
    it('no-ops when not initialized', () => {
      const widget = new PostFxWidget();
      // Should not throw when renderer was never created
      widget.apply(
        { ...DEFAULT_POST_FX_STATE, enabled: true },
        { clock: { wallTimeSeconds: 0, deltaSeconds: 0 }, effectiveDeltaSeconds: 0, globalProgress: 0, variables: {} as never, extra: undefined, coords: {} as never },
      );
    });

    it('no-ops when disabled', () => {
      const widget = new PostFxWidget();
      // Should not throw when state is disabled
      widget.apply(
        { ...DEFAULT_POST_FX_STATE, enabled: false },
        { clock: { wallTimeSeconds: 0, deltaSeconds: 0 }, effectiveDeltaSeconds: 0, globalProgress: 0, variables: {} as never, extra: undefined, coords: {} as never },
      );
    });

    it('no-ops when quality is off', () => {
      const widget = new PostFxWidget();
      widget.apply(
        { ...DEFAULT_POST_FX_STATE, enabled: true, quality: 'off' },
        { clock: { wallTimeSeconds: 0, deltaSeconds: 0 }, effectiveDeltaSeconds: 0, globalProgress: 0, variables: {} as never, extra: undefined, coords: {} as never },
      );
    });
  });

  describe('dispose', () => {
    it('disposes cleanly without initialization', () => {
      const widget = new PostFxWidget();
      // Should not throw
      widget.dispose();
    });

    it('can be called multiple times safely', () => {
      const widget = new PostFxWidget();
      widget.dispose();
      widget.dispose();
    });
  });
});
