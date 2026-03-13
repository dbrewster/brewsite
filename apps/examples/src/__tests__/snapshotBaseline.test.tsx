// Backward compatibility snapshot baseline for existing scenes.
// Compiles representative scenes from the examples app using compileSceneTrack()
// and snapshots the compiled widget state at each scene's midpoint.
//
// Any snapshot mismatch = regression introduced by the View/Region architecture
// refactor. Fix the regression or explicitly update snapshots with justification
// in the commit message.
//
// Run once to generate: pnpm --filter @brewsite/apps vitest run examples/src/__tests__/snapshotBaseline.test.ts
// Run to verify:        pnpm --filter @brewsite/apps test

import { describe, it, expect, beforeAll } from 'vitest';
import { compileSceneTrack } from '@brewsite/core/compiler/sceneTrackCompiler';
import { createSceneTrackSampler } from '@brewsite/core/compiler/sceneTrackSampler';
import { WidgetRegistry } from '@brewsite/core/widget/WidgetRegistry';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import type { SceneDefinition } from '@brewsite/core/compiler/sceneTypes';
import type { SceneTrack } from '@brewsite/core/compiler/sceneTrackTypes';

// Architecture scenes are functional components — instantiate inline for getFrame.
import {
  SceneCoreAngledArch,
  SceneCoreArch,
} from '../architecture/scenes/scene_core';
import {
  SceneDiagramAngledArch,
  SceneDiagramArch,
} from '../architecture/scenes/scene_diagram';

// ─── Custom snapshot serializer ───────────────────────────────────────────────
//
// Replaces functions with '[function]' and React elements with '[react]' for
// stable, deterministic snapshots that survive non-semantic changes like
// function identity shifts or JSX re-creation.

function serializeForSnapshot(widgets: Record<string, unknown>): unknown {
  return JSON.parse(
    JSON.stringify(widgets, (_key, value) => {
      if (typeof value === 'function') return '[function]';
      if (value !== null && typeof value === 'object') {
        if ('$$typeof' in (value as Record<string, unknown>)) return '[react]';
      }
      return value;
    }),
  );
}

// ─── Plugin + Registry setup ─────────────────────────────────────────────────

const coreP = corePlugin();
const diagP = diagramPlugin({ diagrams: ['arch-content'] });

// Registry is shared across all tests in this file — built once before all tests.
let sharedRegistry: WidgetRegistry;

beforeAll(() => {
  // Register DSL NodeHandlers (idempotent — safe across test runs).
  coreP.registerHandlers();
  diagP.registerHandlers();

  // Build the widget registry with core + diagram widgets.
  sharedRegistry = new WidgetRegistry();
  for (const w of coreP.createWidgets()) sharedRegistry.register(w);
  for (const w of diagP.createWidgets()) sharedRegistry.register(w);
  coreP.configureRegistry?.(sharedRegistry, null);
  diagP.configureRegistry?.(sharedRegistry, null);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compile a list of SceneDefinitions into a SceneTrack. */
function buildTrack(sceneDefs: SceneDefinition[]): SceneTrack {
  return compileSceneTrack({
    scenes: sceneDefs,
    widgetRegistry: sharedRegistry,
    blockSize: 4, // Small blockSize for fast test compilation.
  });
}

/** Sample each scene window at its midpoint and return the widgets map. */
function sampleAtMidpoints(track: SceneTrack): Array<{ sceneId: string; widgets: unknown }> {
  const sampler = createSceneTrackSampler(track);
  return track.sceneWindows.map((window) => {
    const midProgress = (window.start + window.end) / 2;
    const tick = sampler.sample(midProgress);
    return {
      sceneId: window.id,
      widgets: serializeForSnapshot(tick.state.widgets),
    };
  });
}

// ─── Architecture / Diagram scenes ───────────────────────────────────────────

describe('snapshotBaseline — architecture (core+diagram) scenes', () => {
  it('arch-core-angled scene widgets are stable', () => {
    const sceneDefs: SceneDefinition[] = [
      { id: 'arch-core-angled', getFrame: SceneCoreAngledArch },
      { id: 'arch-core', getFrame: SceneCoreArch },
    ];
    const track = buildTrack(sceneDefs);
    const samples = sampleAtMidpoints(track);

    for (const sample of samples) {
      expect(sample.widgets).toMatchSnapshot(`scene-${sample.sceneId}-widgets`);
    }
  });

  it('arch-diagram scenes widgets are stable', () => {
    const sceneDefs: SceneDefinition[] = [
      { id: 'arch-diagram-angled', getFrame: SceneDiagramAngledArch },
      { id: 'arch-diagram', getFrame: SceneDiagramArch },
    ];
    const track = buildTrack(sceneDefs);
    const samples = sampleAtMidpoints(track);

    for (const sample of samples) {
      expect(sample.widgets).toMatchSnapshot(`scene-${sample.sceneId}-widgets`);
    }
  });

  it('all four arch scenes together — transitions between scenes are stable', () => {
    const sceneDefs: SceneDefinition[] = [
      { id: 'arch-core-angled', getFrame: SceneCoreAngledArch },
      { id: 'arch-core', getFrame: SceneCoreArch },
      { id: 'arch-diagram-angled', getFrame: SceneDiagramAngledArch },
      { id: 'arch-diagram', getFrame: SceneDiagramArch },
    ];
    const track = buildTrack(sceneDefs);

    // Sample beginning, middle, and end of each scene window.
    const sampler = createSceneTrackSampler(track);
    for (const window of track.sceneWindows) {
      const startProgress = window.start;
      const midProgress = (window.start + window.end) / 2;
      const endProgress = window.end;

      const startTick = sampler.sample(startProgress);
      const midTick = sampler.sample(midProgress);
      const endTick = sampler.sample(endProgress);

      expect(serializeForSnapshot(startTick.state.widgets)).toMatchSnapshot(
        `scene-${window.id}-start-widgets`,
      );
      expect(serializeForSnapshot(midTick.state.widgets)).toMatchSnapshot(
        `scene-${window.id}-mid-widgets`,
      );
      expect(serializeForSnapshot(endTick.state.widgets)).toMatchSnapshot(
        `scene-${window.id}-end-widgets`,
      );
    }
  });
});

// ─── ProgressManager regression ──────────────────────────────────────────────

describe('snapshotBaseline — ProgressManager profile is stable', () => {
  it('progressProfile scroll segments are stable across arch scenes', () => {
    const sceneDefs: SceneDefinition[] = [
      { id: 'arch-core-angled', getFrame: SceneCoreAngledArch },
      { id: 'arch-core', getFrame: SceneCoreArch },
      { id: 'arch-diagram-angled', getFrame: SceneDiagramAngledArch },
      { id: 'arch-diagram', getFrame: SceneDiagramArch },
    ];
    const track = buildTrack(sceneDefs);

    if (track.progressProfile) {
      // Snapshot scroll weights (scrollUnits) per scene.
      const segmentWeights = track.progressProfile.segments.map((seg) => ({
        sceneIndex: seg.sceneIndex,
        rawStart: seg.rawStart,
        rawEnd: seg.rawEnd,
      }));
      expect(segmentWeights).toMatchSnapshot('arch-progress-profile-segments');
    }
  });
});
