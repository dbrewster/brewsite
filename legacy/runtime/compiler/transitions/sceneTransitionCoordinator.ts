import type {SceneFrameState} from '../sceneTypes';
import type {TransitionContext} from './transitionTypes';
import {blendOpacity, clamp01} from './transitionTypes';
import {annotationDefaultsTransitionSpec, annotationsTransitionSpec} from '../../../elements/annotations/index';
import {backgroundTransitionSpec} from '../../../elements/background/index';
import {environmentTransitionSpec} from '../../../elements/environment/index';
import {floorTransitionSpec} from '../../../elements/floor/index';
import {lightingTransitionSpec} from '../../../elements/lighting/index';
import {modelTransitionSpec, playbackTransitionSpec} from '../../../elements/model/index';
import {ribbonTransitionSpec} from '../../../elements/ribbon/index';

const computeT = (progress: number, start: number, end: number) => {
  if (start === end) return progress >= end ? 1 : 0;
  return clamp01((progress - start) / (end - start));
};

export const buildTransitionContext = (options: {
  progress: number;
  exitStart: number;
  exitEnd: number;
  enterStart: number;
  enterEnd: number;
}): TransitionContext => {
  const tExit = computeT(options.progress, options.exitStart, options.exitEnd);
  const tEnter = computeT(options.progress, options.enterStart, options.enterEnd);
  const tFull = computeT(options.progress, options.exitStart, options.enterEnd);
  return {
    tExit,
    tEnter,
    tFull,
    progress: options.progress,
    exitStart: options.exitStart,
    exitEnd: options.exitEnd,
    enterStart: options.enterStart,
    enterEnd: options.enterEnd,
  };
};

const blendModelInstances = (
  fromModels: SceneFrameState['models'] | undefined,
  toModels: SceneFrameState['models'] | undefined,
  context: TransitionContext,
) => {
  const ids = new Set<string>([
    ...Object.keys(fromModels ?? {}),
    ...Object.keys(toModels ?? {}),
  ]);
  if (ids.size === 0) return undefined;
  const blended: NonNullable<SceneFrameState['models']> = {};
  for (const id of ids) {
    const from = fromModels?.[id];
    const to = toModels?.[id];
    if (from && to) {
      blended[id] = {
        enabled: to.enabled ?? from.enabled,
        model: modelTransitionSpec.interpolate(from.model, to.model, context),
        playback: playbackTransitionSpec.interpolate(from.playback, to.playback, context),
      };
      continue;
    }
    if (from) {
      blended[id] = {
        enabled: from.enabled,
        model: modelTransitionSpec.exit(from.model, context),
        playback: playbackTransitionSpec.exit(from.playback, context),
      };
      continue;
    }
    if (to) {
      blended[id] = {
        enabled: to.enabled,
        model: modelTransitionSpec.enter(to.model, context),
        playback: playbackTransitionSpec.enter(to.playback, context),
      };
    }
  }
  return blended;
};

export const applySceneTransition = (from: SceneFrameState, to: SceneFrameState, context: TransitionContext): SceneFrameState => {
  const blendedModels = blendModelInstances(from.models, to.models, context);

  let ribbon =
    !from.ribbon.enabled && to.ribbon.enabled
      ? ribbonTransitionSpec.enter(to.ribbon, context)
      : from.ribbon.enabled && !to.ribbon.enabled
        ? ribbonTransitionSpec.exit(from.ribbon, context)
        : ribbonTransitionSpec.interpolate(from.ribbon, to.ribbon, context);

  if (!ribbon.enabled && to.ribbon.enabled) {
    const targetOpacity = to.ribbon.config?.opacity ?? 0;
    const opacity = blendOpacity(0, targetOpacity, context.tEnter);
    ribbon = {
      ...ribbon,
      enabled: context.tEnter > 0,
      config: ribbon.config
        ? { ...ribbon.config, opacity }
        : to.ribbon.config
          ? { ...to.ribbon.config, opacity }
          : ribbon.config,
    };
  }

  const environment =
    !from.environment.enabled && to.environment.enabled
      ? environmentTransitionSpec.enter(to.environment, context)
      : from.environment.enabled && !to.environment.enabled
        ? environmentTransitionSpec.exit(from.environment, context)
        : environmentTransitionSpec.interpolate(from.environment, to.environment, context);

  const floor =
    !from.floor.enabled && to.floor.enabled
      ? floorTransitionSpec.enter(to.floor, context)
      : from.floor.enabled && !to.floor.enabled
        ? floorTransitionSpec.exit(from.floor, context)
        : floorTransitionSpec.interpolate(from.floor, to.floor, context);

  return {
    ...from,
    id: from.id,
    scrollProgress: context.progress,
    lighting: lightingTransitionSpec.interpolate(from.lighting, to.lighting, context),
    environment,
    floor,
    background: backgroundTransitionSpec.interpolate(from.background, to.background, context),
    models: blendedModels,
    ribbon,
    annotations: annotationsTransitionSpec.interpolate(from.annotations ?? [], to.annotations ?? [], context),
    annotationDefaults: annotationDefaultsTransitionSpec.interpolate(from.annotationDefaults, to.annotationDefaults, context),
  };
};
