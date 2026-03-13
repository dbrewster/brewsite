// Tests for DiagramWidget NVS bounds: nvsBounds getter and viewportBounds validation.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { DiagramWidget } from '../widget';
import type { DiagramState, DiagramThemeRenderConfig } from '../types';
import { createNVSCoordService } from '@brewsite/core';
import type { WidgetRenderContext } from '@brewsite/core';

/** Minimal theme config that avoids asset loading in the test environment. */
const testThemeConfig: DiagramThemeRenderConfig = {
  envMapUrl: 'none',
  envMapIntensity: 1,
  skyColor: '#000000',
  horizonColor: '#000000',
  nodeEnvMapIntensity: 0.15,
  nodeGlowIntensity: 0,
  nodeGlowSpread: 2.2,
  nodeCornerRadius: 0,
  use3DArrows: false,
  edgeSmoothness: 0.5,
  edgeMetalness: 0.3,
  edgeRoughness: 0.7,
  edgeFlowSpeed: 0.7,
  edgeFlowWidth: 0.18,
  edgeTubeRadialSegments: 8,
  edgeFlowPulseIntensity: 0.9,
  groupBorderMetalness: 0.35,
  groupBorderRoughness: 0.45,
  groupBorderSideDarken: 0.40,
  groupBorderEdgeDarken: 0.45,
  nodeLabelFontSizeBase: 0.28,
  nodeSublabelFontSizeBase: 0.18,
  fontUrl: undefined,
};

function makeDefaultState(overrides: Partial<DiagramState> = {}): DiagramState {
  return {
    id: 'canvas',
    viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: [0, 0, 0],
    z: 0,
    scale: 1,
    contentAspect: 1.0,
    nodes: [],
    edges: [],
    groups: [],
    exit: undefined,
    enter: undefined,
    themeConfig: testThemeConfig,
    ...overrides,
  };
}

function makeRenderContext(): WidgetRenderContext {
  const cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.01, 100);
  cam.position.set(0, 0, 12.07);
  return {
    clock: {
      deltaSeconds: 0.016,
      wallTimeSeconds: 0,
    },
    effectiveDeltaSeconds: 0.016,
    globalProgress: 0,
    variables: {
      get: () => undefined,
      getNamespace: () => ({}),
    },
    extra: undefined,
    tick: null,
    coords: createNVSCoordService(cam, 1920, 1080),
  };
}

describe('DiagramWidget — nvsBounds getter', () => {
  it('returns defaultState.viewportBounds before any apply() call', () => {
    const defaultState = makeDefaultState({
      viewportBounds: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
    });
    const widget = new DiagramWidget('canvas', defaultState);
    expect(widget.nvsBounds).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  });

  it('returns viewportBounds from the last applied state after apply()', () => {
    const defaultState = makeDefaultState({ viewportBounds: { x: 0, y: 0, w: 1, h: 1 } });
    const widget = new DiagramWidget('canvas', defaultState);
    const scene = new THREE.Scene();
    widget.initialize({ scene, widgetId: 'canvas' });

    const appliedState = makeDefaultState({ viewportBounds: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } });
    widget.apply(appliedState, makeRenderContext());

    expect(widget.nvsBounds).toEqual({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    widget.dispose();
  });

  it('returns the fullscreen default { x:0, y:0, w:1, h:1 } when defaultState is fullscreen and no apply() has run', () => {
    const widget = new DiagramWidget('canvas', makeDefaultState());
    expect(widget.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});
