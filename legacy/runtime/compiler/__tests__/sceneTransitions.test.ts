import {describe, expect, it} from 'vitest';
import {createAutoTransitionTransition} from '../sceneTransitions';
import {createBaseSceneState} from '../sceneDefaults';
import {createTestTimeline} from './compilerE2eUtils';
import type {SceneFrameContext, SceneFrameState} from '../sceneTypes';
import {createDefaultModelState, createDefaultPlayback} from '../../../model/sceneState';
import {applySceneTransition, buildTransitionContext} from '../transitions/sceneTransitionCoordinator';

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

describe('scene transitions', () => {
  it('blends shared items across full span', () => {
    const context = createContext({ progress: 0.4, sceneProgress: 0.4 });
    const base = createBaseSceneState(context);
    const current = withModelPosition(base, [0, 0, 0]);
    const nextState = withModelPosition(base, [10, 0, 0]);
    const transition = createAutoTransitionTransition({ exitStart: 0.2, exitEnd: 0.6, enterStart: 0.6, enterEnd: 1 }, context);
    const blended = transition.apply(current, { ...context, nextState }, 0.5);
    expect(blended.models?.[modelId]?.model.position[0]).toBeCloseTo(2.5);
  });

  it('fades old-only annotations during exit range', () => {
    const context = createContext({ progress: 0.4, sceneProgress: 0.4 });
    const base = createBaseSceneState(context);
    const from: SceneFrameState = {
      ...base,
      annotations: [
        {
          id: 'old',
          label: 'old',
          mode: 'world',
          target: { targetPoint: [0, 0, 0] },
          style: { lineOpacity: 1, labelOpacity: 1, css: { opacity: 1 } },
        },
      ],
    };
    const to: SceneFrameState = { ...base, annotations: [] };
    const transition = createAutoTransitionTransition({ exitStart: 0.2, exitEnd: 0.6, enterStart: 0.6, enterEnd: 1 }, context);
    const blended = transition.apply(from, { ...context, nextState: to }, 0.5);
    const style = blended.annotations?.[0]?.style;
    expect(style?.lineOpacity).toBeCloseTo(0.5);
    expect(style?.labelOpacity).toBeCloseTo(0.5);
    expect(style?.css?.opacity).toBeCloseTo(0.5);
  });

  it('fades new-only annotations during enter range', () => {
    const context = createContext({ progress: 0.8, sceneProgress: 0.8 });
    const base = createBaseSceneState(context);
    const from: SceneFrameState = { ...base, annotations: [] };
    const to: SceneFrameState = {
      ...base,
      annotations: [
        {
          id: 'new',
          label: 'new',
          mode: 'world',
          target: { targetPoint: [0, 0, 0] },
          style: { lineOpacity: 1, labelOpacity: 1, css: { opacity: 1 } },
        },
      ],
    };
    const transition = createAutoTransitionTransition({ exitStart: 0.2, exitEnd: 0.6, enterStart: 0.6, enterEnd: 1 }, context);
    const blended = transition.apply(from, { ...context, nextState: to }, 0.5);
    const style = blended.annotations?.[0]?.style;
    expect(style?.lineOpacity).toBeCloseTo(0.5);
    expect(style?.labelOpacity).toBeCloseTo(0.5);
    expect(style?.css?.opacity).toBeCloseTo(0.5);
  });

  it('transitions across all model ids', () => {
    const context = createContext({ progress: 0.5, sceneProgress: 0.5 });
    const base = createBaseSceneState(context);
    const from: SceneFrameState = {
      ...base,
      models: {
        a: { model: { ...createDefaultModelState(), scale: 1 }, playback: createDefaultPlayback() },
        b: { model: { ...createDefaultModelState(), scale: 1.2 }, playback: createDefaultPlayback() },
      },
    };
    const to: SceneFrameState = {
      ...base,
      models: {
        b: { model: { ...createDefaultModelState(), scale: 0.8 }, playback: createDefaultPlayback() },
        c: { model: { ...createDefaultModelState(), scale: 1.4 }, playback: createDefaultPlayback() },
      },
    };
    const transitionContext = buildTransitionContext({
      progress: 0.5,
      exitStart: 0,
      exitEnd: 1,
      enterStart: 0,
      enterEnd: 1,
    });
    const blended = applySceneTransition(from, to, transitionContext);
    const ids = Object.keys(blended.models ?? {}).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('scales models down and disables them when transitioning out', () => {
    const context = createContext({ progress: 1, sceneProgress: 1 });
    const base = createBaseSceneState(context);
    const from: SceneFrameState = {
      ...base,
      models: {
        a: { model: { ...createDefaultModelState(), scale: 1 }, playback: createDefaultPlayback() },
      },
    };
    const to: SceneFrameState = { ...base, models: {} };
    const transitionContext = buildTransitionContext({
      progress: 1,
      exitStart: 0,
      exitEnd: 1,
      enterStart: 0,
      enterEnd: 1,
    });
    const blended = applySceneTransition(from, to, transitionContext);
    const model = blended.models?.a?.model;
    expect(blended.models?.a?.model.enabled ?? true).toBe(false);
    expect(model?.scale ?? 1).toBeLessThan(0.01);
  });

  it('scales models up and enables them when transitioning in', () => {
    const context = createContext({ progress: 1, sceneProgress: 1 });
    const base = createBaseSceneState(context);
    const from: SceneFrameState = { ...base, models: {} };
    const to: SceneFrameState = {
      ...base,
      models: {
        a: { model: { ...createDefaultModelState(), scale: 1 }, playback: createDefaultPlayback() },
      },
    };
    const transitionContext = buildTransitionContext({
      progress: 1,
      exitStart: 0,
      exitEnd: 1,
      enterStart: 0,
      enterEnd: 1,
    });
    const blended = applySceneTransition(from, to, transitionContext);
    const model = blended.models?.a?.model;
    expect(blended.models?.a?.model.enabled ?? false).toBe(true);
    expect(model?.scale ?? 0).toBeCloseTo(1);
  });

  it('does not fade in ribbon when entering a disabled ribbon state', () => {
    const context = createContext({ progress: 0.8, sceneProgress: 0.8 });
    const base = createBaseSceneState(context);
    const baseRibbonConfig = base.ribbon.config;
    if (!baseRibbonConfig) {
      throw new Error('Expected base ribbon config to be defined for transition test.');
    }
    const from: SceneFrameState = {
      ...base,
      ribbon: { enabled: false, config: { ...baseRibbonConfig, opacity: 0.25 } },
    };
    const to: SceneFrameState = {
      ...base,
      ribbon: { enabled: false, config: { ...baseRibbonConfig, opacity: 0.25 } },
    };
    const transition = createAutoTransitionTransition({ exitStart: 0.2, exitEnd: 0.6, enterStart: 0.6, enterEnd: 1 }, context);
    const blended = transition.apply(from, { ...context, nextState: to }, 0.5);
    expect(blended.ribbon.enabled).toBe(false);
  });
});
