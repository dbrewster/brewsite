import { describe, it, expect } from 'vitest';
import { applyModelTransform } from '../render';
import type { SceneModel } from '../types';

describe('applyModelTransform', () => {
  it('applies position, rotation, and scale when enabled', () => {
    const state: SceneModel = {
      scale: 2,
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
      enabled: true,
    };
    const renderable = {
      localPosition: [0, 0, 0] as [number, number, number],
      localRotation: [0, 0, 0] as [number, number, number],
      localScale: [1, 1, 1] as [number, number, number],
    };
    applyModelTransform(state, renderable);
    expect(renderable.localPosition).toEqual([1, 2, 3]);
    expect(renderable.localRotation).toEqual([0.1, 0.2, 0.3]);
    expect(renderable.localScale).toEqual([2, 2, 2]);
  });

  it('hides model when enabled is false', () => {
    const state: SceneModel = {
      scale: 2,
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
      enabled: false,
    };
    const renderable = {
      localPosition: [0, 0, 0] as [number, number, number],
      localRotation: [0, 0, 0] as [number, number, number],
      localScale: [1, 1, 1] as [number, number, number],
    };
    applyModelTransform(state, renderable);
    expect(renderable.localScale).toEqual([0, 0, 0]);
  });
});
