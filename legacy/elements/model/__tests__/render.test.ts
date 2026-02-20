import { describe, expect, it } from 'vitest';
import { MockNode } from '../../../runtime/mocks/MockWorld';
import { applyModelTransform } from '../render';

describe('applyModelTransform', () => {
  it('sets localScale to [0,0,0] when model is disabled', () => {
    const root = new MockNode('root');
    root.localScale = [2, 2, 2];
    applyModelTransform({ enabled: false, position: [1, 2, 3], rotation: [0, 0, 0], scale: 1.5 }, root);
    expect(root.localScale).toEqual([0, 0, 0]);
  });

  it('does not apply position or rotation when disabled', () => {
    const root = new MockNode('root');
    root.localPosition = [0, 0, 0];
    root.localRotation = [0, 0, 0];
    applyModelTransform({ enabled: false, position: [5, 6, 7], rotation: [1, 2, 3], scale: 2 }, root);
    expect(root.localPosition).toEqual([0, 0, 0]);
    expect(root.localRotation).toEqual([0, 0, 0]);
  });

  it('applies position to root when enabled', () => {
    const root = new MockNode('root');
    applyModelTransform({ position: [3, -1, 2], rotation: [0, 0, 0], scale: 1 }, root);
    expect(root.localPosition).toEqual([3, -1, 2]);
  });

  it('applies rotation to root when enabled', () => {
    const root = new MockNode('root');
    applyModelTransform({ position: [0, 0, 0], rotation: [0.5, 1.0, -0.5], scale: 1 }, root);
    expect(root.localRotation).toEqual([0.5, 1.0, -0.5]);
  });

  it('applies uniform scale to all axes when enabled', () => {
    const root = new MockNode('root');
    applyModelTransform({ position: [0, 0, 0], rotation: [0, 0, 0], scale: 3.5 }, root);
    expect(root.localScale).toEqual([3.5, 3.5, 3.5]);
  });

  it('treats missing enabled as enabled (truthy path)', () => {
    const root = new MockNode('root');
    // enabled is optional — omitting it should NOT disable the model
    applyModelTransform({ position: [1, 2, 3], rotation: [0.1, 0.2, 0.3], scale: 0.8 }, root);
    expect(root.localPosition).toEqual([1, 2, 3]);
    expect(root.localScale).toEqual([0.8, 0.8, 0.8]);
  });

  it('applies all transform fields in a single call', () => {
    const root = new MockNode('root');
    applyModelTransform({ position: [10, 20, 30], rotation: [0.1, 0.2, 0.3], scale: 2 }, root);
    expect(root.localPosition).toEqual([10, 20, 30]);
    expect(root.localRotation).toEqual([0.1, 0.2, 0.3]);
    expect(root.localScale).toEqual([2, 2, 2]);
  });
});
