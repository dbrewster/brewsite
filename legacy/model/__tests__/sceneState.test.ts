import {describe, expect, it} from 'vitest';
import type {SceneFrameContext} from '../sceneState';
import {createBaseSceneState, createDefaultModelState, mergeSceneState} from '../sceneState';
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

describe('sceneState', () => {
  it('merges model part overrides and preserves other fields', () => {
    const base = createBaseSceneState(buildContext());
    const modelId = 'model-a';
    const next = mergeSceneState(base, {
      models: {
        [modelId]: {
          model: {
            parts: {
              brain: {
                enabled: true,
                position: [1, 2, 3],
              },
            },
          },
        },
      },
    });

    const nextModel = next.models?.[modelId]?.model;
    expect(nextModel?.parts?.brain?.enabled).toBe(true);
    expect(nextModel?.parts?.brain?.position).toEqual([1, 2, 3]);
    expect(nextModel?.parts?.brain?.rotation).toBeUndefined();
    expect(nextModel?.parts?.brain?.scale).toBeUndefined();
  });

  it('deep clones vectors so base is not mutated', () => {
    const modelId = 'model-a';
    const base = mergeSceneState(createBaseSceneState(buildContext()), {
      models: {
        [modelId]: {
          model: {
            parts: {
              brain: { position: [0, 0, 0] },
            },
          },
        },
      },
    });
    const next = mergeSceneState(base, {
      models: {
        [modelId]: {
          model: {
            parts: {
              brain: { position: [4, 5, 6] },
            },
          },
        },
      },
    });

    const nextModel = next.models?.[modelId]?.model;
    const baseModel = base.models?.[modelId]?.model;
    if (!nextModel?.parts?.brain || !baseModel?.parts?.brain) throw new Error('Missing brain part');
    nextModel.parts.brain.position[0] = 999;
    expect(baseModel.parts.brain.position[0]).not.toBe(999);
  });

  it('preserves base state when provided in context', () => {
    const base = createBaseSceneState(buildContext());
    const modelId = 'model-a';
    const withBrain = mergeSceneState(base, {
      models: {
        [modelId]: {
          model: { parts: { brain: { enabled: true } } },
        },
      },
    });

    const merged = createBaseSceneState(buildContext({ baseState: withBrain }));
    expect(merged.models?.[modelId]?.model.parts?.brain?.enabled).toBe(true);
  });

  it('merges model instances and preserves base when omitted', () => {
    const base = createBaseSceneState(buildContext());
    const withInstance = mergeSceneState(base, {
      models: {
        secondary: {
          model: { scale: 0.3, position: [1, 2, 3] },
        },
      },
    });
    const next = mergeSceneState(withInstance, {
      models: {
        secondary: {
          model: { position: [4, 5, 6] },
        },
      },
    });
    expect(next.models?.secondary?.model.scale).toBe(0.3);
    expect(next.models?.secondary?.model.position).toEqual([4, 5, 6]);
    expect(withInstance.models?.secondary?.model.position).toEqual([1, 2, 3]);
  });
});
