/**
 * E2E test: compiles TWO scenes through the full SceneTrack compiler and
 * verifies that each tick's diagram state comes from the correct scene.
 *
 * Reproduces a bug where Scene 2's diagram content (groups, non-interpolated
 * fields) appeared during Scene 1's slot because interpolateFn used `...to`
 * as the spread base. The fix uses `t < 0.5 ? from : to` to select the base.
 *
 * The test creates two DiagramState objects with different group labels and
 * different node sets, registers a DiagramWidget into WidgetRegistry, and
 * compiles via compileSceneTrack. It then evaluates the functional transition
 * closure at key blockProgress values and asserts the group label and node
 * content belong to the correct scene.
 */
import { describe, it, expect } from 'vitest';
import { WidgetRegistry } from '@brewsite/core';
import { compileSceneTrack } from '../../../../../core/src/compiler/sceneTrackCompiler';
import type { SceneDefinition } from '../../../../../core/src/compiler/sceneTypes';
import type { SceneFrame } from '../../../../../core/src/compiler/sceneTrackTypes';
import type { DiagramNodeState, DiagramState, DiagramGroupState, DiagramThemeRenderConfig } from '../types';
import { DiagramWidget } from '../widget';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeNode = (id: string, opts?: { label?: string; opacity?: number }): DiagramNodeState => ({
  id,
  label: opts?.label ?? id,
  sublabel: undefined,
  shape: 'flow:rect',
  position: [0.5, 0.5, 0],
  size: [0.1, 0.05],
  thickness: 0.02,
  color: '#2a2d3e',
  sideColor: '#1f2231',
  borderColor: '#3a3d4f',
  metalness: 0.15,
  roughness: 0.65,
  labelColor: '#ffffff',
  sublabelColor: '#a0a8c0',
  labelPadding: 0,
  opacity: opts?.opacity ?? 1,
  clickable: false,
  enabled: true,
  iconUrl: undefined,
  iconScale: 0.6,
  groupId: undefined,
});

const makeGroup = (id: string, label: string): DiagramGroupState => ({
  id,
  label,
  variant: 'boundary',
  orientation: 'horizontal',
  bounds: { x: 0, y: 0, w: 1, h: 1, padding: [0, 0, 0, 0], titleGap: 0 },
  color: '#1a1d2e80',
  borderColor: '#3a3d4f',
  borderWidth: 0.005,
  borderHeight: 0.01,
  borderStyle: 'solid',
  borderRadius: 0.01,
  labelColor: '#ffffff',
  labelFontSize: 0.03,
  opacity: 1,
});

const stubThemeConfig: DiagramThemeRenderConfig = {
  envMapIntensity: 0.5,
  glowEnabled: false,
  arrows3D: false,
} as DiagramThemeRenderConfig;

const makeDiagramState = (
  id: string,
  nodes: DiagramNodeState[],
  groups: DiagramGroupState[],
): DiagramState => ({
  id,
  nodes,
  edges: [],
  groups,
  viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
  tiltRotation: [0, 0, 0],
  z: 0,
  scale: 1,
  exit: undefined,
  enter: undefined,
  themeConfig: stubThemeConfig,
});

const WIDGET_ID = 'test-diagram';

const makeScene = (sceneId: string, diagramState: DiagramState): SceneDefinition => ({
  id: sceneId,
  getFrame: (): SceneFrame => ({
    id: sceneId,
    scrollProgress: 0,
    widgets: { [WIDGET_ID]: diagramState },
  }),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('scene transition diagram state — base spread correctness', () => {
  // Scene 1: group "Frontend Team" with nodes [web, mobile]
  const scene1Diagram = makeDiagramState(
    WIDGET_ID,
    [makeNode('web', { label: 'Web App' }), makeNode('mobile', { label: 'Mobile App' })],
    [makeGroup('grp-1', 'Frontend Team')],
  );

  // Scene 2: group "Backend Team" with nodes [api, db]
  const scene2Diagram = makeDiagramState(
    WIDGET_ID,
    [makeNode('api', { label: 'API Gateway' }), makeNode('db', { label: 'Database' })],
    [makeGroup('grp-2', 'Backend Team')],
  );

  const buildTrack = () => {
    const defaultState = makeDiagramState(WIDGET_ID, [], []);
    const widget = new DiagramWidget(WIDGET_ID, defaultState);
    const registry = new WidgetRegistry().register(widget);
    const scenes = [
      makeScene('scene-1', scene1Diagram),
      makeScene('scene-2', scene2Diagram),
    ];
    return compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 10 });
  };

  it('produces a functional transition block for the diagram widget', () => {
    const track = buildTrack();
    expect(track.transitionBlocks).toBeDefined();
    expect(track.transitionBlocks).toHaveLength(1);
    const fn = track.transitionBlocks?.[0]?.widgetFns[WIDGET_ID];
    expect(fn).toBeDefined();
    expect(fn?.kind).toBe('interpolate');
  });

  it('at bp=0 (first tick) — group label is Scene 1, nodes are Scene 1', () => {
    const track = buildTrack();
    const fn = track.transitionBlocks![0]!.widgetFns[WIDGET_ID]!.fn;
    const state = fn(0) as DiagramState;

    // Group label must come from Scene 1
    expect(state.groups).toHaveLength(1);
    expect(state.groups[0]!.label).toBe('Frontend Team');

    // Nodes must be Scene 1's nodes (web, mobile) — NOT Scene 2's (api, db)
    const nodeIds = state.nodes.map((n) => n.id);
    expect(nodeIds).toContain('web');
    expect(nodeIds).toContain('mobile');
  });

  it('at bp=0.49 — base is Scene 1 (before t=0.5 flip)', () => {
    const track = buildTrack();
    const fn = track.transitionBlocks![0]!.widgetFns[WIDGET_ID]!.fn;
    // Interpolation uses full block [0,1]. At t=0.49 < 0.5, base = from (Scene 1).
    const state = fn(0.49) as DiagramState;
    expect(state.groups[0]!.label).toBe('Frontend Team');
  });

  it('at bp=1.0 (last tick of block) — group label is Scene 2, nodes are Scene 2', () => {
    const track = buildTrack();
    const fn = track.transitionBlocks![0]!.widgetFns[WIDGET_ID]!.fn;
    const state = fn(1) as DiagramState;

    // Group label must come from Scene 2
    expect(state.groups).toHaveLength(1);
    expect(state.groups[0]!.label).toBe('Backend Team');

    // Scene 2 nodes should be fully visible
    const api = state.nodes.find((n) => n.id === 'api');
    expect(api).toBeDefined();
    expect(api!.opacity).toBeCloseTo(1);
  });

  it('terminal tick (last frame) has Scene 2 state baked discretely', () => {
    const track = buildTrack();
    const lastTick = track.ticks[track.ticks.length - 1]!;
    expect(lastTick.sceneIndex).toBe(1);

    const diagramState = lastTick.state.widgets[WIDGET_ID] as DiagramState;
    expect(diagramState).toBeDefined();
    expect(diagramState.groups[0]!.label).toBe('Backend Team');
    expect(diagramState.nodes.map((n) => n.id)).toContain('api');
  });

  it('non-interpolated fields flip at t=0.5 boundary — never Scene 2 before midpoint', () => {
    const track = buildTrack();
    const fn = track.transitionBlocks![0]!.widgetFns[WIDGET_ID]!.fn;

    // Check several points before t=0.5 in the transition window
    for (const bp of [0, 0.1, 0.2, 0.3, 0.49]) {
      const state = fn(bp) as DiagramState;
      expect(state.groups[0]!.label).toBe(
        'Frontend Team',
        // Template literal provides context on failure
      );
    }

    // Check that after the midpoint, Scene 2 non-interpolated fields appear
    // Note: the actual interpolation window is [0.8, 1.0], so at bp=0.9 the
    // resolved t = (0.9-0.8)/(1.0-0.8) = 0.5 — exactly the flip point.
    // At bp=0.95, t = 0.75 > 0.5 → base should be `to` (Scene 2).
    const stateAfterMid = fn(0.95) as DiagramState;
    expect(stateAfterMid.groups[0]!.label).toBe('Backend Team');
  });

  it('interpolated fields (z, scale, viewportBounds) blend correctly at transition midpoint', () => {
    // Use diagrams with different z values to verify numeric interpolation
    const s1 = { ...scene1Diagram, z: 0, scale: 1 };
    const s2 = { ...scene2Diagram, z: -10, scale: 2 };

    const defaultState = makeDiagramState(WIDGET_ID, [], []);
    const widget = new DiagramWidget(WIDGET_ID, defaultState);
    const registry = new WidgetRegistry().register(widget);
    const track = compileSceneTrack({
      scenes: [makeScene('s1', s1), makeScene('s2', s2)],
      widgetRegistry: registry,
      blockSize: 10,
    });

    const fn = track.transitionBlocks![0]!.widgetFns[WIDGET_ID]!.fn;

    // At bp=0.5, t = 0.5 → midpoint interpolation (full [0,1] range)
    const state = fn(0.5) as DiagramState;
    expect(state.z).toBeCloseTo(-5);
    expect(state.scale).toBeCloseTo(1.5);
  });
});
