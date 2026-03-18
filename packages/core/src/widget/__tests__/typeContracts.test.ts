// Compile-time checks for new S1 type contracts: ICameraFocusTarget, ILightingOverride,
// ISceneElement disableWhenAbsent/stateEquals, and RuntimeCameraOverride.

import { describe, it, expect } from 'vitest';
import type {
  ISceneElement,
  IRenderable,
  ICameraFocusTarget,
  ILightingOverride,
  RuntimeCameraOverride,
  WidgetInitContext,
  WidgetRenderContext,
  CompileExtraContext,
} from '../types';
import type { FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';

// ─── Shared helpers ──────────────────────────────────────────────────────────

type SimpleState = { enabled: boolean; value: number };

const makeNoopSpec = <T,>(): FunctionalTransitionSpec<T> => ({
  exitFn: (from) => () => from,
  enterFn: (to) => () => to,
  interpolateFn: (_from, to) => () => to,
});

// ─── ISceneElement with disableWhenAbsent and stateEquals ────────────────────

class FullSceneElement
  implements ISceneElement<SimpleState>, IRenderable<SimpleState>
{
  readonly widgetId = 'full-element';
  readonly defaultState: SimpleState = { enabled: true, value: 0 };
  readonly transitionSpec = makeNoopSpec<SimpleState>();
  readonly DslComponent = () => null as never;
  readonly disableWhenAbsent = true;

  stateEquals(a: SimpleState, b: SimpleState): boolean {
    return a.enabled === b.enabled && a.value === b.value;
  }

  initialize(_ctx: WidgetInitContext): void {}

  apply(_state: SimpleState, _ctx: WidgetRenderContext): void {}

  dispose(): void {}
}

// ─── ICameraFocusTarget implementor ──────────────────────────────────────────

class MockCameraFocusTarget implements ICameraFocusTarget {
  readonly widgetId = 'mock-camera';

  lastPosition: readonly [number, number, number] | null = null;
  lastTarget: readonly [number, number, number] | null = null;
  lastSmooth: boolean | undefined = undefined;

  requestFocus(
    position: readonly [number, number, number],
    target: readonly [number, number, number],
    smooth?: boolean,
  ): void {
    this.lastPosition = position;
    this.lastTarget = target;
    this.lastSmooth = smooth;
  }
}

// ─── ILightingOverride implementor ───────────────────────────────────────────

class MockLightingOverride implements ILightingOverride {
  readonly widgetId = 'mock-lighting';

  private _disableAll = false;
  private _setter: ((lightId: string, enabled: boolean) => void) | null = null;

  setDisableAll(v: boolean): void {
    this._disableAll = v;
  }

  getLightingOverride(): { readonly disableAll: boolean } | null {
    return this._disableAll ? { disableAll: true } : null;
  }

  receiveLightController(setter: (lightId: string, enabled: boolean) => void): void {
    this._setter = setter;
  }

  invokeSetterForTest(lightId: string, enabled: boolean): void {
    this._setter?.(lightId, enabled);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ISceneElement type contracts', () => {
  it('disableWhenAbsent is true on FullSceneElement', () => {
    const widget = new FullSceneElement();
    expect(widget.disableWhenAbsent).toBe(true);
  });

  it('stateEquals returns true for equivalent states', () => {
    const widget = new FullSceneElement();
    expect(widget.stateEquals({ enabled: true, value: 5 }, { enabled: true, value: 5 })).toBe(true);
  });

  it('stateEquals returns false for differing states', () => {
    const widget = new FullSceneElement();
    expect(widget.stateEquals({ enabled: true, value: 5 }, { enabled: false, value: 5 })).toBe(false);
  });

  it('widget satisfies ISceneElement without disableWhenAbsent', () => {
    class MinimalElement implements ISceneElement<SimpleState> {
      readonly widgetId = 'minimal';
      readonly defaultState: SimpleState = { enabled: false, value: 0 };
      readonly transitionSpec = makeNoopSpec<SimpleState>();
      readonly DslComponent = () => null as never;
    }
    const w = new MinimalElement();
    // disableWhenAbsent is optional — should be undefined when not declared
    expect(w.disableWhenAbsent).toBeUndefined();
  });
});

describe('ICameraFocusTarget type contract', () => {
  it('requestFocus stores position, target, and smooth flag', () => {
    const target = new MockCameraFocusTarget();
    target.requestFocus([1, 2, 3], [0, 0, 0], true);

    expect(target.lastPosition).toEqual([1, 2, 3]);
    expect(target.lastTarget).toEqual([0, 0, 0]);
    expect(target.lastSmooth).toBe(true);
  });

  it('requestFocus smooth parameter is optional', () => {
    const target = new MockCameraFocusTarget();
    target.requestFocus([0, 5, 10], [0, 0, 0]);

    expect(target.lastSmooth).toBeUndefined();
  });

  it('satisfies ICameraFocusTarget interface at compile time', () => {
    const target: ICameraFocusTarget = new MockCameraFocusTarget();
    expect(target.widgetId).toBe('mock-camera');
  });
});

describe('ILightingOverride type contract', () => {
  it('getLightingOverride returns null when not overriding', () => {
    const override = new MockLightingOverride();
    expect(override.getLightingOverride()).toBeNull();
  });

  it('getLightingOverride returns { disableAll: true } when active', () => {
    const override = new MockLightingOverride();
    override.setDisableAll(true);
    expect(override.getLightingOverride()).toEqual({ disableAll: true });
  });

  it('receiveLightController stores the setter for later use', () => {
    const override = new MockLightingOverride();
    const calls: Array<[string, boolean]> = [];
    override.receiveLightController((lightId, enabled) => calls.push([lightId, enabled]));

    override.invokeSetterForTest('sun', false);
    expect(calls).toEqual([['sun', false]]);
  });
});

describe('RuntimeCameraOverride type contract', () => {
  it('required fields are present', () => {
    const ov: RuntimeCameraOverride = {
      enabled: true,
      position: [0, 5, 10],
      target: [0, 0, 0],
    };
    expect(ov.enabled).toBe(true);
    expect(ov.position).toEqual([0, 5, 10]);
  });

  it('optional fields are omittable', () => {
    const ov: RuntimeCameraOverride = {
      enabled: false,
      position: [1, 2, 3],
      target: [4, 5, 6],
      fov: 45,
    };
    expect(ov.up).toBeUndefined();
    expect(ov.near).toBeUndefined();
    expect(ov.fov).toBe(45);
  });
});

describe('CompileExtraContext field rename', () => {
  it('blockProgress replaces sceneProgress', () => {
    const ctx: CompileExtraContext = {
      blockProgress: 0.75,
      globalProgress: 0.5,
      prefersReducedMotion: false,
    };
    expect(ctx.blockProgress).toBe(0.75);
  });
});
