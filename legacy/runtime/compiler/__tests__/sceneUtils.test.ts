import {describe, expect, it} from 'vitest';
import {applySceneTransitions, computeSceneProgress} from '../sceneUtils';
import {createBaseSceneState, createDefaultModelState, createDefaultPlayback} from '../../../model/sceneState';
import {testSceneGroup} from '../../__tests__/fixtures/testSceneFixtures';
import type {SceneFrameContext, SceneTransition} from '../sceneTypes';

const modelId = 'model-a';

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

describe('sceneUtils', () => {
  const updatePrimaryScale = (state: ReturnType<typeof createBaseSceneState>, scale: number) => {
    const baseModel = state.models?.[modelId]?.model ?? createDefaultModelState();
    const basePlayback = state.models?.[modelId]?.playback ?? createDefaultPlayback();
    return {
      ...state,
      models: {
        ...(state.models ?? {}),
        [modelId]: {
          enabled: true,
          model: { ...baseModel, scale },
          playback: basePlayback,
        },
      },
    };
  };

  it('computes scene progress with zero-length ranges', () => {
    expect(computeSceneProgress(0.1, 0.5, 0.5)).toBe(0);
    expect(computeSceneProgress(0.5, 0.5, 0.5)).toBe(1);
  });

  it('applies transitions across phases', () => {
    const context = buildContext({ progress: 0.9, sceneProgress: 0.9 });
    const base = updatePrimaryScale(createBaseSceneState(context), createDefaultModelState().scale);

    const transitions: SceneTransition[] = [
      {
        id: 'skip-before',
        start: 0.2,
        end: 0.4,
        apply: (state) => {
          const baseModel = state.models?.[modelId]?.model ?? createDefaultModelState();
          return updatePrimaryScale(state, baseModel.scale + 1);
        },
      },
      {
        id: 'inherit-cap',
        start: () => 0.5,
        end: () => 0.6,
        scope: 'persist',
        apply: (state, _ctx, t) => {
          const baseModel = state.models?.[modelId]?.model ?? createDefaultModelState();
          return updatePrimaryScale(state, baseModel.scale + t);
        },
      },
    ];

    const skipped = applySceneTransitions(base, [], context);
    expect(skipped.models?.[modelId]?.model.scale).toBe(base.models?.[modelId]?.model.scale);

    const active = applySceneTransitions(base, transitions, buildContext({ progress: 0.1 }));
    expect(active.models?.[modelId]?.model.scale).toBe(base.models?.[modelId]?.model.scale);

    const inherited = applySceneTransitions(base, transitions, context, { phase: 'inherit' });
    expect(inherited.models?.[modelId]?.model.scale).toBeGreaterThan(base.models?.[modelId]?.model.scale);
  });
});
