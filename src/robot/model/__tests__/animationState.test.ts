import {describe, expect, it} from 'vitest';
import {resolveAnimationState} from '../animationState';
import type {SceneFrameContext} from '../sceneState';
import {createBaseSceneState, createDefaultModelState, createDefaultPlayback} from '../sceneState';
import {testSceneGroup} from '../../runtime/__tests__/fixtures/testSceneFixtures';

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

describe('animationState', () => {
  it('disables animation when prefers-reduced-motion is true', () => {
    const scene = createBaseSceneState(buildContext());
    const modelId = 'model-a';
    const primaryScene = {
      ...scene,
      models: { [modelId]: { model: createDefaultModelState(), playback: createDefaultPlayback() } },
    };
    const state = resolveAnimationState({ playback: primaryScene.models?.[modelId]?.playback, prefersReducedMotion: true });
    expect(state.clipEnabled).toBe(false);
    expect(state.hasAnimationRequest).toBe(false);
  });

  it('enables clip when clip exists', () => {
    const modelId = 'model-a';
    const playback = {
      ...createDefaultPlayback(),
      animation: { enabled: true, clipName: 'Idle' },
    };
    const scene = {
      ...createBaseSceneState(buildContext()),
      models: { [modelId]: { model: createDefaultModelState(), playback } },
    };
    const state = resolveAnimationState({
      playback: scene.models?.[modelId]?.playback,
      prefersReducedMotion: false,
      availableClips: [{ name: 'Idle', duration: 2 }],
    });
    expect(state.clipEnabled).toBe(true);
    expect(state.resolvedClipName).toBe('Idle');
  });

  it('disables clip when missing but keeps name for warning', () => {
    const modelId = 'model-a';
    const playback = {
      ...createDefaultPlayback(),
      animation: { enabled: true, clipName: 'Missing' },
    };
    const scene = {
      ...createBaseSceneState(buildContext()),
      models: { [modelId]: { model: createDefaultModelState(), playback } },
    };
    const state = resolveAnimationState({
      playback: scene.models?.[modelId]?.playback,
      prefersReducedMotion: false,
      availableClips: [{ name: 'Idle', duration: 2 }],
    });
    expect(state.clipEnabled).toBe(false);
    expect(state.hasAnimationRequest).toBe(true);
    expect(state.resolvedClipName).toBe('Missing');
  });

  it('does not enable clip when no animation request exists', () => {
    const modelId = 'model-a';
    const scene = createBaseSceneState(buildContext());
    const primaryScene = {
      ...scene,
      models: { [modelId]: { model: createDefaultModelState(), playback: createDefaultPlayback() } },
    };
    const state = resolveAnimationState({ playback: primaryScene.models?.[modelId]?.playback, prefersReducedMotion: false });
    expect(state.clipEnabled).toBe(false);
    expect(state.hasAnimationRequest).toBe(false);
  });
});
