// sceneTrackCompiler tests — pure function contract tests.
// The compiler is a pure transformation: Scene DSL → SceneTrack.
// Tests pass real inputs and assert on real outputs; no mocks needed.

import { createElement } from 'react';
import { describe, it, expect } from 'vitest';
import { compileSceneTrack } from '../sceneTrackCompiler';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { createSceneTimeline } from '../../timeline';
import type { SceneDefinition } from '../sceneTypes';
import { Scene } from '../sceneDslCompiler';

// ---------------------------------------------------------------------------
// Minimal scene fixture
// ---------------------------------------------------------------------------

const makeScene = (id: string, index: number): SceneDefinition => ({
  id,
  index,
  // Return a minimal Scene DSL tree.
  getFrame: () => createElement(Scene, { id }),
  transitions: [],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compileSceneTrack', () => {
  it('produces a SceneTrack with correct tick count for a two-scene timeline', () => {
    const scenes = [makeScene('scene-0', 0), makeScene('scene-1', 1)];
    const timeline = createSceneTimeline(scenes);
    const registry = new WidgetRegistry();

    const track = compileSceneTrack({
      scenes,
      timeline,
      assetsReady: false,
      widgetRegistry: registry,
      clipMeta: [],
    });

    expect(track.ticks.length).toBeGreaterThan(0);
    expect(track.ticks[0].state).toBeDefined();
    expect(track.ticks[0].state.widgets).toBeDefined();
  });

  it('samples first tick at progress 0', () => {
    const scenes = [makeScene('a', 0), makeScene('b', 1)];
    const timeline = createSceneTimeline(scenes);
    const registry = new WidgetRegistry();

    const track = compileSceneTrack({
      scenes,
      timeline,
      assetsReady: false,
      widgetRegistry: registry,
      clipMeta: [],
    });

    const firstTick = track.ticks[0];
    expect(firstTick.progress).toBeCloseTo(0, 5);
  });

  it('samples last tick near progress 1', () => {
    const scenes = [makeScene('a', 0), makeScene('b', 1)];
    const timeline = createSceneTimeline(scenes);
    const registry = new WidgetRegistry();

    const track = compileSceneTrack({
      scenes,
      timeline,
      assetsReady: false,
      widgetRegistry: registry,
      clipMeta: [],
    });

    const lastTick = track.ticks[track.ticks.length - 1];
    expect(lastTick.progress).toBeCloseTo(1, 5);
  });
});
