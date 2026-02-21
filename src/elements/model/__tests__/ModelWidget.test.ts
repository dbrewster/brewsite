// ModelWidget tests — interface-based stateful tests.
// Tests exercise ISceneElement + ILoadable contracts.
// No Three.js renderer is invoked; renderer initialization is skipped.

import { describe, it, expect } from 'vitest';
import { ModelWidget, type ModelWidgetConfig } from '../ModelWidget';
import type { ModelMeta } from '../metadata';
import type { SceneModelInstanceState } from '../types';

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

const makeIdentity = (): SceneModelInstanceState => ({
  model: {
    scale: 0.1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    enabled: true,
    bodyPartOverrides: {},
  },
  playback: {
    motion: { commands: [], scenes: [], customAnimations: [] },
    animation: { enabled: false },
  },
});

const makeModelMeta = (type: string): ModelMeta => ({
  type,
  glb: `/assets/${type}.glb`,
  bones: ['root', 'head'],
  meshes: ['body', 'head_mesh'],
  anchorTargets: { 'mixamorig:Head': 'head' },
  bodyParts: [],
  identity: makeIdentity(),
});

const makeConfig = (type: string): ModelWidgetConfig => ({
  modelMeta: makeModelMeta(type),
  clipMeta: [{ name: 'idle', duration: 2.0 }],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelWidget', () => {
  it('derives widgetId from modelMeta.type', () => {
    const widget = new ModelWidget(makeConfig('robot-main'));
    expect(widget.widgetId).toBe('robot-main');
  });

  it('creates a defaultState with the correct model id', () => {
    const widget = new ModelWidget(makeConfig('robot-arm'));
    expect(widget.defaultState).toBeDefined();
  });

  it('exposes clipMeta from config', () => {
    const widget = new ModelWidget(makeConfig('robot-head'));
    expect(widget.clipMeta).toHaveLength(1);
    expect(widget.clipMeta[0].name).toBe('idle');
  });

  it('starts with isLoaded = false', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    expect(widget.isLoaded).toBe(false);
  });

  it('transitionSpec is defined', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    expect(widget.transitionSpec).toBeDefined();
  });

  it('childDslComponents lists all expected child types', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const names = widget.childDslComponents.map((c) => c.displayName);
    expect(names).toContain('Playback');
    expect(names).toContain('Animation');
    expect(names).toContain('Motion');
    expect(names).toContain('BodyPart');
    expect(names).toContain('Pose');
  });

  it('mergeSnapshot persists body part overrides until reset', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const base = widget.defaultState;
    const prev: SceneModelInstanceState = {
      ...base,
      model: {
        ...base.model,
        bodyPartOverrides: {
          Head: {
            color: '#ff0000',
            opacity: 0.5,
            pose: { rotate: { yawPct: 0.1 } },
          },
        },
      },
    };
    const next: SceneModelInstanceState & { __authored?: unknown } = {
      ...base,
      model: {
        ...base.model,
        bodyPartOverrides: {
          Head: {
            opacity: 1,
          },
        },
      },
      playback: base.playback,
      __authored: {},
    };

    const merged = widget.mergeSnapshot(prev, next) as SceneModelInstanceState;
    const head = merged.model.bodyPartOverrides?.Head;
    expect(head?.color).toBe('#ff0000');
    expect(head?.opacity).toBe(1);
    expect(head?.pose?.rotate?.yawPct).toBeCloseTo(0.1);

    const resetNext: SceneModelInstanceState & { __authored?: unknown } = {
      ...base,
      model: {
        ...base.model,
        bodyPartOverrides: {
          Head: { reset: true },
        },
      },
      playback: base.playback,
      __authored: {},
    };
    const resetMerged = widget.mergeSnapshot(merged, resetNext) as SceneModelInstanceState;
    expect(resetMerged.model.bodyPartOverrides?.Head).toBeUndefined();
  });
});
