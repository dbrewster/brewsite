import { describe, it, expect } from 'vitest';
import { buildEffectiveInputSpec } from '../effectiveInputSpec';
import type { SceneInputControllerSpec, InputActionSpec } from '../../input/types';
import type { IInputDefaultProvider } from '../../widget/types';

// A minimal IInputDefaultProvider test double.
const makeProvider = (actions: InputActionSpec[]): IInputDefaultProvider => ({
  widgetId: 'test-provider',
  getDefaultInputActions: () => actions,
});

const sampleAction: InputActionSpec = {
  id: 'test-move',
  type: 'diagram-canvas.move',
  canvasId: 'canvas-1',
  speed: 1,
  maps: [{ kind: 'pointer', event: 'drag', button: 'left', axis: 'xy' }],
};

const sampleSpec: SceneInputControllerSpec = {
  id: '__input_controller',
  scope: 'canvas',
  actions: [sampleAction],
};

describe('buildEffectiveInputSpec', () => {
  it('returns tick spec unchanged when explicit spec is present (explicit wins)', () => {
    const result = buildEffectiveInputSpec(sampleSpec, [makeProvider([sampleAction])]);
    expect(result).toBe(sampleSpec);
  });

  it('returns null when tickInputSpec is null and no providers', () => {
    expect(buildEffectiveInputSpec(null, [])).toBeNull();
  });

  it('returns null when tickInputSpec is undefined and no providers', () => {
    expect(buildEffectiveInputSpec(undefined, [])).toBeNull();
  });

  it('returns null when providers return no actions', () => {
    const result = buildEffectiveInputSpec(null, [makeProvider([])]);
    expect(result).toBeNull();
  });

  it('constructs a spec from provider actions when no tick spec', () => {
    const result = buildEffectiveInputSpec(null, [makeProvider([sampleAction])]);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('__input_controller');
    expect(result!.scope).toBe('canvas');
    expect(result!.actions).toEqual([sampleAction]);
  });

  it('aggregates actions from multiple providers', () => {
    const a1 = { ...sampleAction, id: 'a1' };
    const a2 = { ...sampleAction, id: 'a2' };
    const result = buildEffectiveInputSpec(null, [makeProvider([a1]), makeProvider([a2])]);
    expect(result!.actions).toHaveLength(2);
    expect(result!.actions[0]!.id).toBe('a1');
    expect(result!.actions[1]!.id).toBe('a2');
  });

  it('does not merge tick spec with provider actions — explicit wins entirely', () => {
    const tickAction = { ...sampleAction, id: 'tick-action' };
    const providerAction = { ...sampleAction, id: 'provider-action' };
    const tickSpec: SceneInputControllerSpec = {
      id: '__input_controller',
      scope: 'canvas',
      actions: [tickAction],
    };
    const result = buildEffectiveInputSpec(tickSpec, [makeProvider([providerAction])]);
    expect(result!.actions).toHaveLength(1);
    expect(result!.actions[0]!.id).toBe('tick-action');
  });
});
