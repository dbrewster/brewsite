// Tests for InputHud data model types and their relationship with the input spec.

import { describe, it, expect } from 'vitest';
import { createDefaultInputSpec } from '../../input/defaultInputSpec';
import { formatInputMap } from '../../input/platformKeys';
import type { InputHudHint, InputHudState } from '../inputHudTypes';

describe('InputHudHint', () => {
  it('has expected shape fields', () => {
    const hint: InputHudHint = {
      actionId: 'default-scene-next',
      actionType: 'scene.next',
      triggers: ['↓'],
      maps: [{ kind: 'key', key: 'ArrowDown' }],
    };

    expect(hint.actionId).toBe('default-scene-next');
    expect(hint.actionType).toBe('scene.next');
    expect(hint.triggers).toHaveLength(1);
    expect(hint.maps).toHaveLength(1);
  });

  it('supports multiple triggers and maps', () => {
    const hint: InputHudHint = {
      actionId: 'default-camera-pan',
      actionType: 'camera.pan',
      triggers: ['⇧Left Drag', 'Middle Drag'],
      maps: [
        { kind: 'pointer', event: 'drag', button: 'left', modifiers: ['shift'], axis: 'xy' },
        { kind: 'pointer', event: 'drag', button: 'middle', axis: 'xy' },
      ],
    };

    expect(hint.triggers).toHaveLength(2);
    expect(hint.maps).toHaveLength(2);
  });
});

describe('InputHudState', () => {
  it('has expected shape fields', () => {
    const state: InputHudState = {
      hints: [],
      platform: 'mac',
    };

    expect(state.hints).toEqual([]);
    expect(state.platform).toBe('mac');
  });

  it('accepts all platform values', () => {
    const platforms: InputHudState['platform'][] = ['mac', 'windows', 'linux', 'unknown'];
    for (const platform of platforms) {
      const state: InputHudState = { hints: [], platform };
      expect(state.platform).toBe(platform);
    }
  });
});

describe('InputHudState built from createDefaultInputSpec', () => {
  it('all actions produce non-empty trigger strings via formatInputMap', () => {
    const spec = createDefaultInputSpec();

    const hints: InputHudHint[] = spec.actions.map((action) => ({
      actionId: action.id,
      actionType: action.type,
      triggers: action.maps.map((map) => formatInputMap(map, 'mac')),
      maps: action.maps,
    }));

    const state: InputHudState = {
      hints,
      platform: 'mac',
    };

    expect(state.hints.length).toBeGreaterThan(0);

    for (const hint of state.hints) {
      expect(hint.triggers.length).toBeGreaterThan(0);
      for (const trigger of hint.triggers) {
        expect(trigger.length).toBeGreaterThan(0);
      }
    }
  });

  it('covers all expected action types from default spec', () => {
    const spec = createDefaultInputSpec();
    const actionTypes = spec.actions.map((a) => a.type);

    expect(actionTypes).toContain('scene.next');
    expect(actionTypes).toContain('scene.prev');
    expect(actionTypes).toContain('camera.orbit');
    expect(actionTypes).toContain('camera.zoom');
    expect(actionTypes).toContain('camera.pan');
    expect(actionTypes).toContain('camera.reset');
    expect(actionTypes).toContain('carousel.next');
    expect(actionTypes).toContain('carousel.prev');
  });
});
