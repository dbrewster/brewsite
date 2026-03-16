// Tests for inputSpecMerger — pure merge of scene input spec with defaults.

import { describe, it, expect } from 'vitest';
import { mergeInputSpecs } from '../inputSpecMerger';
import type { SceneInputControllerSpec } from '../types';

const makeSpec = (
  id: string,
  actions: Array<{ id: string; type: string }>,
  overrides?: Partial<SceneInputControllerSpec>,
): SceneInputControllerSpec => ({
  id,
  scope: 'canvas',
  actions: actions.map(a => ({ ...a, maps: [{ kind: 'key' as const, key: 'x' }] })),
  ...overrides,
});

describe('mergeInputSpecs', () => {
  it('returns scene spec as-is when mode is replace', () => {
    const defaults = makeSpec('defaults', [{ id: 'a', type: 'scene.next' }]);
    const scene = makeSpec('scene', [{ id: 'b', type: 'scene.prev' }]);
    const result = mergeInputSpecs(defaults, scene, 'replace');
    expect(result).toBe(scene);
  });

  it('preserves default actions not present in scene when mode is merge', () => {
    const defaults = makeSpec('defaults', [
      { id: 'default-orbit', type: 'camera.orbit' },
      { id: 'default-zoom', type: 'camera.zoom' },
    ]);
    const scene = makeSpec('scene', [
      { id: 'custom-action', type: 'scene.next' },
    ]);
    const result = mergeInputSpecs(defaults, scene, 'merge');
    expect(result.actions).toHaveLength(3);
    expect(result.actions.map(a => a.id)).toEqual([
      'default-orbit',
      'default-zoom',
      'custom-action',
    ]);
  });

  it('replaces default action when scene declares action with same id', () => {
    const defaults = makeSpec('defaults', [
      { id: 'default-orbit', type: 'camera.orbit' },
      { id: 'default-zoom', type: 'camera.zoom' },
    ]);
    const scene = makeSpec('scene', [
      { id: 'default-orbit', type: 'camera.orbit' },
    ]);
    // The scene's version of default-orbit should replace the default's
    const result = mergeInputSpecs(defaults, scene, 'merge');
    expect(result.actions).toHaveLength(2);
    const orbitAction = result.actions.find(a => a.id === 'default-orbit');
    expect(orbitAction).toBe(scene.actions[0]);
  });

  it('uses scene id and scope in merged result', () => {
    const defaults = makeSpec('defaults', [], { scope: 'canvas' });
    const scene = makeSpec('my-scene', [], { scope: 'window' });
    const result = mergeInputSpecs(defaults, scene, 'merge');
    expect(result.id).toBe('my-scene');
    expect(result.scope).toBe('window');
  });

  it('returns empty actions when both defaults and scene have no actions in merge mode', () => {
    const defaults = makeSpec('defaults', []);
    const scene = makeSpec('scene', []);
    const result = mergeInputSpecs(defaults, scene, 'merge');
    expect(result.actions).toEqual([]);
  });

  it('returns only scene actions when replace mode and scene has actions', () => {
    const defaults = makeSpec('defaults', [
      { id: 'a', type: 'scene.next' },
      { id: 'b', type: 'scene.prev' },
    ]);
    const scene = makeSpec('scene', [
      { id: 'c', type: 'camera.orbit' },
    ]);
    const result = mergeInputSpecs(defaults, scene, 'replace');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]!.id).toBe('c');
  });

  it('preserves order: defaults first, then scene actions', () => {
    const defaults = makeSpec('defaults', [
      { id: 'a', type: 'scene.next' },
      { id: 'b', type: 'scene.prev' },
    ]);
    const scene = makeSpec('scene', [
      { id: 'c', type: 'camera.orbit' },
      { id: 'd', type: 'camera.zoom' },
    ]);
    const result = mergeInputSpecs(defaults, scene, 'merge');
    expect(result.actions.map(a => a.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
