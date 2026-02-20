import {describe, expect, it} from 'vitest';
import {createAutoTransitionTransition} from '../sceneTransitions';
import {createBaseSceneState} from '../sceneDefaults';
import {createTestTimeline} from './compilerE2eUtils';
import type {SceneFrameContext, SceneFrameState} from '../sceneTypes';
import {createDefaultModelState, createDefaultPlayback} from '../../../model/sceneState';

const modelId = 'model-a';

const createContext = (overrides: Partial<SceneFrameContext> = {}): SceneFrameContext => {
  const timeline = createTestTimeline(['intro', 'robot']);
  return {
    progress: 0,
    sceneProgress: 0,
    globalProgress: 0,
    sceneStart: 0,
    sceneEnd: 1,
    assetsReady: true,
    timeline,
    ...overrides,
  };
};

const withModelPosition = (state: SceneFrameState, position: [number, number, number]) => {
  const baseModel = state.models?.[modelId]?.model ?? createDefaultModelState();
  const basePlayback = state.models?.[modelId]?.playback ?? createDefaultPlayback();
  return {
    ...state,
    models: {
      ...(state.models ?? {}),
      [modelId]: {
        enabled: true,
        model: { ...baseModel, position },
        playback: basePlayback,
      },
    },
  };
};

describe('scene transition coordinator', () => {
  it('blends multiple domains across the full span', () => {
    const context = createContext({ progress: 0.4, sceneProgress: 0.4 });
    const base = createBaseSceneState(context);
    const current = withModelPosition(base, [0, 0, 0]);
    const nextState = {
      ...withModelPosition(base, [10, 0, 0]),
      background: { imageUrl: 'next.png', opacity: 1 },
    };
    const transition = createAutoTransitionTransition({ exitStart: 0.2, exitEnd: 0.6, enterStart: 0.6, enterEnd: 1 }, context);
    const blended = transition.apply(current, { ...context, nextState }, 0.5);
    expect(blended.models?.[modelId]?.model.position[0]).toBeCloseTo(2.5);
    expect(blended.background.opacity).toBeGreaterThanOrEqual(0);
  });
});
