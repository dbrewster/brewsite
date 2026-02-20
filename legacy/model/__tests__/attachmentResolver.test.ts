import {describe, expect, it} from 'vitest';
import {resolveAttachments} from '../attachmentResolver';
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

describe('attachmentResolver', () => {
  it('excludes disabled parts', () => {
    const base = createBaseSceneState(buildContext());
    const modelId = 'model-a';
    const baseModel = createDefaultModelState();
    const basePlayback = createDefaultPlayback();
    const scene = {
      ...base,
      models: {
        [modelId]: {
          model: {
            ...baseModel,
            parts: {
              brain: {
                id: 'brain',
                anchor: 'head',
                enabled: false,
                position: [0, 0, 0] as [number, number, number],
                rotation: [0, 0, 0] as [number, number, number],
                scale: 1,
                modelId: 'brain',
              },
            },
          },
          playback: basePlayback,
        },
      },
    };

    const attachments = resolveAttachments(scene, modelId);
    expect(attachments.find((att) => att.id === 'brain')).toBeUndefined();
  });

  it('includes enabled parts and preserves transforms', () => {
    const base = createBaseSceneState(buildContext());
    const modelId = 'model-a';
    const baseModel = createDefaultModelState();
    const basePlayback = createDefaultPlayback();
    const scene = {
      ...base,
      models: {
        [modelId]: {
          model: {
            ...baseModel,
            parts: {
              brain: {
                id: 'brain',
                anchor: 'head',
                enabled: true,
                position: [9, 8, 7] as [number, number, number],
                rotation: [1, 2, 3] as [number, number, number],
                scale: 2,
                modelId: 'brain',
              },
            },
          },
          playback: basePlayback,
        },
      },
    };

    const attachments = resolveAttachments(scene, modelId);
    const brain = attachments.find((att) => att.id === 'brain');
    expect(brain).toBeTruthy();
    expect(brain?.payload.type).toBe('model');
    expect(brain?.position).toEqual([9, 8, 7]);
    expect(brain?.rotation).toEqual([1, 2, 3]);
    expect(brain?.scale).toBe(2);
  });

  it('passes subparts through render config', () => {
    const base = createBaseSceneState(buildContext());
    const modelId = 'model-a';
    const baseModel = createDefaultModelState();
    const basePlayback = createDefaultPlayback();
    const scene = {
      ...base,
      models: {
        [modelId]: {
          model: {
            ...baseModel,
            parts: {
              brain: {
                id: 'brain',
                anchor: 'head',
                enabled: true,
                position: [0, 0, 0] as [number, number, number],
                rotation: [0, 0, 0] as [number, number, number],
                scale: 1,
                modelId: 'brain',
                subparts: {
                  red: { id: 'red', opacity: 0.4 },
                },
              },
            },
          },
          playback: basePlayback,
        },
      },
    };

    const attachments = resolveAttachments(scene, modelId);
    const brain = attachments.find((att) => att.id === 'brain');
    expect(brain?.render.subparts?.red?.opacity).toBe(0.4);
  });
});
