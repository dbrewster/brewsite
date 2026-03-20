/**
 * Full pipeline test: compiles TWO diagrams with the SAME id but different
 * node content (soft vs dramatic lighting) through compileDiagram →
 * compileSceneTrack. Verifies the transition closure returns the correct
 * scene's content at each block progress value.
 *
 * Reproduces the core-showcase LightingSoft/LightingDramatic scene pair where
 * the second scene's diagram (dramatic) appeared during the first scene's slot.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WidgetRegistry } from '@brewsite/core';
import { compileSceneTrack } from '../../../../../core/src/compiler/sceneTrackCompiler';
import type { SceneDefinition } from '../../../../../core/src/compiler/sceneTypes';
import type { SceneFrame } from '../../../../../core/src/compiler/sceneTrackTypes';
import type { DiagramDSL, DiagramState } from '../types';
import { compileDiagram } from '../compile';
import { DiagramWidget } from '../widget';

// ─── Diagram DSL: Scene 1 (LightingSoftScene) ──────────────────────────────
const softDiagramDsl: DiagramDSL = {
  id: 'cs-lighting-diagram',
  layout: { kind: 'manual' },
  childrenOrder: [],
  nodes: [
    { id: 'lt-ambient', label: 'Ambient', sublabel: '0.8 intensity · #d7e8ff',
      icon: 'ui:light-bulb', position: [0.2, 0.35, 0], size: [0.16, 0.14] },
    { id: 'lt-directional-1', label: 'Directional A', sublabel: '0.9 intensity · #ffffff · [4, 10, 6]',
      icon: 'ui:bolt', position: [0.5, 0.35, 0], size: [0.16, 0.14] },
    { id: 'lt-directional-2', label: 'Directional B', sublabel: '0.4 intensity · #b0ccff · [-6, 4, 8]',
      icon: 'ui:bolt', position: [0.8, 0.35, 0], size: [0.16, 0.14] },
    { id: 'lt-result', label: 'Soft Result', sublabel: 'Professional presentation lighting',
      icon: 'ui:light-bulb', position: [0.5, 0.72, 0], size: [0.22, 0.14],
      color: '#1a3060', glow: { intensity: 0.1 } },
  ],
  edges: [
    { from: 'lt-ambient', to: 'lt-result', flow: 'forward', style: 'dashed' },
    { from: 'lt-directional-1', to: 'lt-result', flow: 'forward' },
    { from: 'lt-directional-2', to: 'lt-result', flow: 'forward', style: 'dashed' },
  ],
  groups: [],
};

// ─── Diagram DSL: Scene 2 (LightingDramaticScene) ──────────────────────────
const dramaticDiagramDsl: DiagramDSL = {
  id: 'cs-lighting-diagram', // SAME diagram ID
  layout: { kind: 'manual' },
  childrenOrder: [],
  nodes: [
    { id: 'lt-ambient', label: 'Ambient', sublabel: '0.15 intensity · #0a0a20',
      icon: 'ui:light-bulb', position: [0.2, 0.35, 0], size: [0.16, 0.14] },
    { id: 'lt-directional-1', label: 'Directional A', sublabel: '2.0 intensity · #ff6030 · warm key',
      icon: 'ui:bolt', position: [0.5, 0.35, 0], size: [0.16, 0.14], color: '#3a1808' },
    { id: 'lt-directional-2', label: 'Directional B', sublabel: '0.8 intensity · #3060ff · cool fill',
      icon: 'ui:bolt', position: [0.8, 0.35, 0], size: [0.16, 0.14], color: '#0a1840' },
    { id: 'lt-result', label: 'Dramatic Result', sublabel: 'Cinematic warm/cool bi-tone + GlowPoint sprites',
      icon: 'ui:light-bulb', position: [0.5, 0.72, 0], size: [0.22, 0.14],
      color: '#301020', glow: { intensity: 0.3 } },
  ],
  edges: [
    { from: 'lt-ambient', to: 'lt-result', flow: 'forward', style: 'dashed' },
    { from: 'lt-directional-1', to: 'lt-result', flow: 'forward' },
    { from: 'lt-directional-2', to: 'lt-result', flow: 'forward' },
  ],
  groups: [],
};

const DIAGRAM_ID = 'cs-lighting-diagram';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('lighting diagram transition — same ID, different content per scene', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildTrack() {
    const softState = compileDiagram(softDiagramDsl);
    const dramaticState = compileDiagram(dramaticDiagramDsl);

    const defaultState = compileDiagram({
      id: DIAGRAM_ID, layout: { kind: 'manual' }, childrenOrder: [],
      nodes: [], edges: [], groups: [],
    });
    const widget = new DiagramWidget(DIAGRAM_ID, defaultState);
    const registry = new WidgetRegistry().register(widget);

    const scenes: SceneDefinition[] = [
      {
        id: 'cs-lighting-soft',
        getFrame: (): SceneFrame => ({
          id: 'cs-lighting-soft',
          scrollProgress: 0,
          widgets: { [DIAGRAM_ID]: softState },
        }),
      },
      {
        id: 'cs-lighting-dramatic',
        getFrame: (): SceneFrame => ({
          id: 'cs-lighting-dramatic',
          scrollProgress: 0,
          widgets: { [DIAGRAM_ID]: dramaticState },
        }),
      },
    ];

    return { track: compileSceneTrack({ scenes, widgetRegistry: registry, blockSize: 10 }), softState, dramaticState };
  }

  it('produces an interpolate transition block', () => {
    const { track } = buildTrack();
    const fn = track.transitionBlocks?.[0]?.widgetFns[DIAGRAM_ID];
    expect(fn?.kind).toBe('interpolate');
  });

  // ─── The critical test: which scene's content is displayed at each bp ─────

  it('bp=0: lt-result label is "Soft Result" (Scene 1)', () => {
    const { track } = buildTrack();
    const fn = track.transitionBlocks![0]!.widgetFns[DIAGRAM_ID]!.fn;
    const state = fn(0) as DiagramState;

    const resultNode = state.nodes.find((n) => n.id === 'lt-result');
    expect(resultNode).toBeDefined();
    expect(
      resultNode!.label,
      `At bp=0, lt-result should be "Soft Result" (Scene 1). Got: "${resultNode!.label}"`,
    ).toBe('Soft Result');
  });

  it('bp=0.49: still "Soft Result" (base=from before t=0.5 flip)', () => {
    const { track } = buildTrack();
    const fn = track.transitionBlocks![0]!.widgetFns[DIAGRAM_ID]!.fn;
    const state = fn(0.49) as DiagramState;

    const resultNode = state.nodes.find((n) => n.id === 'lt-result');
    expect(
      resultNode!.label,
      `At bp=0.49, lt-result should be "Soft Result" (base=from). Got: "${resultNode!.label}"`,
    ).toBe('Soft Result');
  });

  it('bp=1.0: lt-result label is "Dramatic Result" (Scene 2)', () => {
    const { track } = buildTrack();
    const fn = track.transitionBlocks![0]!.widgetFns[DIAGRAM_ID]!.fn;
    const state = fn(1.0) as DiagramState;

    const resultNode = state.nodes.find((n) => n.id === 'lt-result');
    expect(
      resultNode!.label,
      `At bp=1.0, lt-result should be "Dramatic Result" (Scene 2). Got: "${resultNode!.label}"`,
    ).toBe('Dramatic Result');
  });

  // ─── Node sublabel check (more granular) ──────────────────────────────────

  it('bp=0: lt-ambient sublabel has "0.8 intensity" (soft)', () => {
    const { track } = buildTrack();
    const fn = track.transitionBlocks![0]!.widgetFns[DIAGRAM_ID]!.fn;
    const state = fn(0) as DiagramState;
    const ambient = state.nodes.find((n) => n.id === 'lt-ambient');
    expect(ambient!.sublabel).toContain('0.8 intensity');
  });

  it('bp=1.0: lt-ambient sublabel has "0.15 intensity" (dramatic)', () => {
    const { track } = buildTrack();
    const fn = track.transitionBlocks![0]!.widgetFns[DIAGRAM_ID]!.fn;
    const state = fn(1.0) as DiagramState;
    const ambient = state.nodes.find((n) => n.id === 'lt-ambient');
    expect(ambient!.sublabel).toContain('0.15 intensity');
  });

  // ─── Diagnostic: dump full state at each bp ───────────────────────────────

  it('DIAGNOSTIC: dump node labels and colors at key bp values', () => {
    const { track } = buildTrack();
    const fn = track.transitionBlocks![0]!.widgetFns[DIAGRAM_ID]!.fn;

    for (const bp of [0, 0.1, 0.3, 0.5, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0]) {
      const state = fn(bp) as DiagramState;
      const result = state.nodes.find((n) => n.id === 'lt-result');
      const ambient = state.nodes.find((n) => n.id === 'lt-ambient');
      console.log(
        `bp=${bp.toFixed(2)} | result="${result?.label}" sublabel="${result?.sublabel?.substring(0, 25)}" | ` +
        `ambient="${ambient?.sublabel?.substring(0, 20)}" | tilt=${state.tiltRotation[0].toFixed(3)}`,
      );
    }
    expect(true).toBe(true);
  });
});
