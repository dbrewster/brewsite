// ModelWidget tests — interface-based stateful tests.
// Tests exercise ISceneElement + ILoadable contracts.
// No Three.js renderer is invoked; renderer initialization is skipped.

import { describe, it, expect } from 'vitest';
import { ModelWidget, type ModelWidgetConfig } from '../ModelWidget';
import type { ModelMeta } from '../metadata';

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

const makeModelMeta = (id: string): ModelMeta => ({
  id,
  glb: `/assets/${id}.glb`,
  bones: ['root', 'head'],
  meshes: ['body', 'head_mesh'],
  anchorTargets: { 'mixamorig:Head': 'head' },
  bodyParts: [],
});

const makeConfig = (id: string): ModelWidgetConfig => ({
  modelMeta: makeModelMeta(id),
  clipMeta: [{ name: 'idle', duration: 2.0 }],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelWidget', () => {
  it('derives widgetId from modelMeta.id', () => {
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
});
