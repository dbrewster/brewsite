import {describe, expect, it} from 'vitest';
import {applySceneTransitions} from '../sceneUtils';
import {createBaseSceneState} from '../sceneDefaults';
import type {SceneFrameContext, SceneFrameState, SceneTransition} from '../sceneTypes';
import {applySceneTransition, buildTransitionContext} from '../transitions/sceneTransitionCoordinator';
import {compileSceneTrack} from '../sceneTrackCompiler';
import {createSceneTrackSampler} from '../sceneTrackSampler';
import {testSceneGroup} from '../../__tests__/fixtures/testSceneFixtures';
import {createDefaultModelState, createDefaultPlayback} from '../../../model/sceneState';

const buildContext = (overrides?: Partial<SceneFrameContext>): SceneFrameContext => ({
  progress: 0,
  sceneProgress: 0,
  globalProgress: 0,
  sceneStart: 0,
  sceneEnd: 1,
  assetsReady: true,
  timeline: testSceneGroup.timeline,
  baseState: undefined,
  ...overrides,
});

const applyTransitions = (state: SceneFrameState, transition: SceneTransition, phase: 'active' | 'inherit') =>
  applySceneTransitions(state, [transition], buildContext({ progress: 0.5 }), { phase });

describe('scene transitions', () => {
  it('skips active-scoped transitions during inherit phase', () => {
    const base = createBaseSceneState(buildContext());
    const transition: SceneTransition = {
      id: 'active-only',
      start: 0,
      end: 1,
      scope: 'active',
      apply: (state) => ({ ...state, background: { ...state.background, opacity: 1 } }),
    };
    const result = applyTransitions(base, transition, 'inherit');
    expect(result.background.opacity).toBe(base.background.opacity);
  });

  it('applies persist-scoped transitions during inherit phase', () => {
    const base = createBaseSceneState(buildContext());
    const transition: SceneTransition = {
      id: 'persist',
      start: 0,
      end: 1,
      scope: 'persist',
      apply: (state) => ({ ...state, background: { ...state.background, opacity: 1 } }),
    };
    const result = applyTransitions(base, transition, 'inherit');
    expect(result.background.opacity).toBe(1);
  });

  it('preserves model instances during transitions', () => {
    const base = createBaseSceneState(buildContext());
    const next = createBaseSceneState(buildContext());
    next.models = {
      secondary: {
        enabled: true,
        model: createDefaultModelState(),
        playback: createDefaultPlayback(),
      },
    };
    const context = buildTransitionContext({
      progress: 0.5,
      exitStart: 0,
      exitEnd: 0.5,
      enterStart: 0.5,
      enterEnd: 1,
    });
    const result = applySceneTransition(base, next, context);
    expect(result.models?.secondary).toBeTruthy();
  });
});

describe('scene compiler', () => {
  const buildSampler = () => {
    const track = compileSceneTrack({
      scenes: testSceneGroup.scenes,
      timeline: testSceneGroup.timeline,
      assetsReady: true,
      availableClips: [
        { name: 'retargeted_action', duration: 4 },
        { name: 'breathing-m', duration: 3 },
      ],
      prefersReducedMotion: false,
    });
    return { track, sampler: createSceneTrackSampler(track) };
  };

  it('uses the scene order for timeline stops', () => {
    const ids = testSceneGroup.scenes.map((scene) => scene.id);
    expect(testSceneGroup.timeline.stops.map((stop) => stop.id)).toEqual(ids);
  });

  it('enables the ribbon without opacity during the intro window', () => {
    const { track, sampler } = buildSampler();
    const introWindow = track.sceneWindows.find((window) => window.id === 'intro');
    expect(introWindow).toBeTruthy();
    if (!introWindow) return;
    const beforeProgress = introWindow.start + (introWindow.end - introWindow.start) * 0.1;
    const duringProgress = introWindow.start + (introWindow.end - introWindow.start) * 0.8;
    const beforeState = sampler.sample(beforeProgress).state;
    const duringState = sampler.sample(duringProgress).state;
    expect(beforeState.ribbon.enabled).toBe(false);
    expect(duringState.ribbon.enabled).toBe(true);
    expect(duringState.ribbon.config?.opacity ?? 0).toBeCloseTo(0, 5);
  });

  it('keeps brain enabled into detail scene', () => {
    const { track, sampler } = buildSampler();
    const detailWindow = track.sceneWindows.find((window) => window.id === 'detail');
    expect(detailWindow).toBeTruthy();
    if (!detailWindow) return;
    const progress = (detailWindow.start + detailWindow.end) / 2;
    const state = sampler.sample(progress).state;
    const modelId = Object.keys(state.models ?? {})[0];
    expect(state.models?.[modelId]?.model.parts?.brain?.enabled).toBe(true);
  });

  it('toggles brain across scenes 0 -> 1 -> 2 -> 1 -> 0', () => {
    const { track, sampler } = buildSampler();
    const progressAt = (index: number) => {
      const window = track.sceneWindows[index];
      expect(window).toBeTruthy();
      if (!window) return 0;
      return (window.start + window.end) / 2;
    };

    const sequence = [0, 1, 2, 1, 0];
    const expected = [true, true, true, true, true];
    const results = sequence.map((index) => {
      const state = sampler.sample(progressAt(index)).state;
      const modelId = Object.keys(state.models ?? {})[0];
      return state.models?.[modelId]?.model.parts?.brain?.enabled ?? false;
    });

    expect(results).toEqual(expected);
  });
});
