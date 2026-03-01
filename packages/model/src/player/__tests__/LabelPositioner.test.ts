// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { LabelPositioner } from '../LabelPositioner';
import { PerspectiveCamera } from 'three';
import type { LabelResolved } from '../../labels/types';

const makeCamera = (): PerspectiveCamera => {
  const camera = new PerspectiveCamera(70, 1, 0.1, 1000);
  camera.position.set(0, 0, 5);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
};

const makeLabel = (id: string, overrides?: Partial<LabelResolved>): LabelResolved => ({
  id,
  text: 'Test',
  targetPartId: 'bone_head',
  ...overrides,
});

describe('LabelPositioner', () => {
  it('does nothing when container size is zero', () => {
    const positioner = new LabelPositioner();
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    const label = makeLabel('l1');
    positioner.update(
      [label],
      makeCamera(),
      new Map([['bone_head', [0, 1, 0] as [number, number, number]]]),
    );
    // transform should not be set since containerWidth/Height are 0
    expect(el.style.transform).toBe('');
  });

  it('sets container size and applies transform after update', () => {
    const positioner = new LabelPositioner();
    positioner.setContainerSize(800, 600);
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    const camera = makeCamera();
    const bones = new Map<string, [number, number, number]>([['bone_head', [0, 0, 0]]]);
    positioner.update([makeLabel('l1')], camera, bones);
    expect(el.style.transform).toContain('translate');
  });

  it('hides element when enabled is false', () => {
    const positioner = new LabelPositioner();
    positioner.setContainerSize(800, 600);
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    positioner.update(
      [makeLabel('l1', { enabled: false })],
      makeCamera(),
      new Map([['bone_head', [0, 0, 0] as [number, number, number]]]),
    );
    expect(el.style.display).toBe('none');
  });

  it('warns once for missing bone target', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const positioner = new LabelPositioner();
    positioner.setContainerSize(800, 600);
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    positioner.update([makeLabel('l1')], makeCamera(), new Map()); // no bones
    positioner.update([makeLabel('l1')], makeCamera(), new Map()); // second call
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('unregisters element on null', () => {
    const positioner = new LabelPositioner();
    positioner.setContainerSize(800, 600);
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    positioner.registerElement('l1', null);
    // Should not throw with no registered element
    positioner.update(
      [makeLabel('l1')],
      makeCamera(),
      new Map([['bone_head', [0, 0, 0] as [number, number, number]]]),
    );
  });
});
