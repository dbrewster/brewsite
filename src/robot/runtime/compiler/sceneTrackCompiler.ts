import type {RobotTimeline} from '../../robotTimeline';
import {createSceneTimeline} from '../../robotTimeline';
import {clamp01, invLerp, rangeProgress} from '../../robotTimelineMath';
import type {ClipMeta} from '../../model/robotSceneTypes';
import {compileAnimation} from '../../elements/model/compile';
import {compileAnnotations} from './annotationCompiler';
import {applySceneTransitions} from './sceneUtils';
import type {SceneDefinition, SceneFrameContext, SceneFrameState, SceneSource, SceneSpec} from './sceneTypes';
import type {SceneFrameDelta, SceneTrack, SceneTrackTick, SceneWindow} from './sceneTrackTypes';
import {resolveSceneFromDsl} from './sceneDslCompiler';
import type {AssetManifest} from '../../elements/model/metadata';
import {clipMetaFromManifest} from '../../elements/model/metadata';
import type {ResourceRegistry} from '../../../resources/sceneResources.generated';

export type CompileSceneTrackOptions = {
  scenes: SceneSource[];
  timeline: RobotTimeline;
  assetsReady: boolean;
  /**
   * Preferred: supply a manifest (from robot-metadata.json) and let the compiler
   * derive clip metadata, anchor targets, and brain subpart validation from it.
   */
  manifest?: AssetManifest;
  /**
   * Legacy fallback: supply clip metadata directly when a manifest is not yet available.
   * Ignored when `manifest` is provided.
   */
  availableClips?: ClipMeta[];
  prefersReducedMotion: boolean;
  ui?: SceneFrameContext['ui'];
  resourceRegistry?: ResourceRegistry;
};

const resolveSceneWindow = (
  timeline: RobotTimeline,
  scene: NormalizedScene,
  nextScene: NormalizedScene | undefined,
): SceneWindow => {
  const start = timeline.tick(scene.index);
  const end = nextScene ? timeline.tick(nextScene.index) : 1;
  const entryLead = scene.entryLead ?? 0;
  const entryStartFromLead = start + entryLead * (end - start);
  const entryStart = scene.entryStart ?? entryStartFromLead;
  return {
    id: scene.id,
    index: scene.index,
    start,
    end,
    entryStart,
  };
};

const buildSceneContext = (options: {
  progress: number;
  assetsReady: boolean;
  timeline: RobotTimeline;
  start: number;
  end: number;
  baseState?: SceneFrameState;
  baseStateRaw?: SceneFrameState;
  nextState?: SceneFrameState;
  ui?: SceneFrameContext['ui'];
  resourceRegistry?: ResourceRegistry;
}): SceneFrameContext => {
  const sceneTimeline = createSceneTimeline(options.timeline, options.start, options.end);
  const sceneProgressRaw = invLerp(options.progress, options.start, options.end);
  const sceneProgress = clamp01(rangeProgress(options.progress, options.start, options.end));
  return {
    progress: sceneProgress,
    sceneProgress,
    sceneProgressRaw,
    globalProgress: options.progress,
    sceneStart: options.start,
    sceneEnd: options.end,
    assetsReady: options.assetsReady,
    timeline: sceneTimeline,
    baseState: options.baseState,
    baseStateRaw: options.baseStateRaw,
    nextState: options.nextState,
    resourceRegistry: options.resourceRegistry,
    ui: options.ui,
  };
};

const resolveActiveSceneIndex = (progress: number, windows: SceneWindow[]): number => {
  let activeIndex = 0;
  for (let i = 0; i < windows.length; i += 1) {
    const window = windows[i];
    if (!window) continue;
    if (progress >= window.entryStart) {
      activeIndex = i;
    }
  }
  return activeIndex;
};


type NormalizedScene = {
  id: string;
  index: number;
  entryLead?: number;
  entryStart?: number;
  resolve: (context: SceneFrameContext) => { frame: SceneFrameState; transitions: SceneDefinition['transitions'] };
};

const isSceneSpec = (scene: SceneSource): scene is SceneSpec =>
  'render' in scene;

const normalizeScenes = (scenes: SceneSource[], timeline: RobotTimeline): NormalizedScene[] => {
  const indexById = new Map(timeline.stops.map((stop, index) => [stop.id, index] as const));
  return scenes.map((scene, index) => {
    if (isSceneSpec(scene)) {
      return {
        id: scene.id,
        index: indexById.get(scene.id) ?? index,
        entryLead: scene.entryLead,
        entryStart: scene.entryStart,
        resolve: (context) => resolveSceneFromDsl(scene.render(context), context),
      };
    }
    return {
      id: scene.id,
      index: indexById.get(scene.id) ?? index,
      entryLead: scene.entryLead,
      entryStart: scene.entryStart,
      resolve: (context) => ({ frame: scene.getFrame(context), transitions: scene.transitions }),
    };
  });
};

const buildNextState = (options: {
  scenes: NormalizedScene[];
  windows: SceneWindow[];
  index: number;
  progress: number;
  assetsReady: boolean;
  timeline: RobotTimeline;
  baseState?: SceneFrameState;
  ignoreBaseState?: boolean;
  ui?: SceneFrameContext['ui'];
}) => {
  const nextScene = options.scenes[options.index + 1];
  const nextWindow = options.windows[options.index + 1];
  if (!nextScene || !nextWindow) return undefined;
  const context = buildSceneContext({
    progress: options.progress,
    assetsReady: options.assetsReady,
    timeline: options.timeline,
    start: nextWindow.start,
    end: nextWindow.end,
    baseState: options.ignoreBaseState ? undefined : options.baseState,
    ui: options.ui,
  });
  return nextScene.resolve(context).frame;
};

export const compileSceneTrack = (options: CompileSceneTrackOptions): SceneTrack => {
  const perfEnabled =
    typeof window !== 'undefined' &&
    (window as unknown as { __robotRuntimeDebug?: { perf?: boolean } }).__robotRuntimeDebug?.perf;
  const perfLabel = perfEnabled ? `sceneTrack:${options.timeline.sceneCount}:${options.timeline.subTickCount}` : '';
  if (perfEnabled && typeof performance !== 'undefined' && performance.mark) {
    performance.mark(`${perfLabel}:start`);
  }
  const scenes = normalizeScenes(options.scenes, options.timeline);
  const windows = scenes.map((scene, index) => resolveSceneWindow(options.timeline, scene, scenes[index + 1]));
  const baseStateBefore: Array<SceneFrameState | undefined> = [];
  const baseStateRawBefore: Array<SceneFrameState | undefined> = [];
  let inheritedState: SceneFrameState | undefined;
  let inheritedRawState: SceneFrameState | undefined;

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const window = windows[i];
    if (!scene || !window) continue;
    baseStateBefore[i] = inheritedState;
    baseStateRawBefore[i] = inheritedRawState;

    if (window.start > window.end) {
      console.warn('[RobotSceneCompiler]', 'invalid.transition.window', {
        scene: scene.id,
        start: window.start,
        end: window.end,
      });
    }

    const endContext = buildSceneContext({
      progress: window.end,
      assetsReady: options.assetsReady,
      timeline: options.timeline,
      start: window.start,
      end: window.end,
      baseState: inheritedState,
      baseStateRaw: inheritedRawState,
      ui: options.ui,
      resourceRegistry: options.resourceRegistry,
    });
    const nextState = buildNextState({
      scenes,
      windows,
      index: i,
      progress: window.end,
      assetsReady: options.assetsReady,
      timeline: options.timeline,
      baseState: inheritedState,
      ui: options.ui,
    });
    const endContextWithNext = { ...endContext, nextState };
    const endResolved = scene.resolve(endContextWithNext);
    inheritedState = applySceneTransitions(endResolved.frame, endResolved.transitions, endContextWithNext, { phase: 'inherit' });
    inheritedRawState = endResolved.frame;
  }

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const window = windows[i];
    if (!scene || !window) continue;
    if (scene.entryStart !== undefined || scene.entryLead !== undefined) continue;
    const context = buildSceneContext({
      progress: window.start,
      assetsReady: options.assetsReady,
      timeline: options.timeline,
      start: window.start,
      end: window.end,
      baseState: baseStateBefore[i],
      baseStateRaw: baseStateRawBefore[i],
      ui: options.ui,
      resourceRegistry: options.resourceRegistry,
    });
    const nextState = buildNextState({
      scenes,
      windows,
      index: i,
      progress: window.start,
      assetsReady: options.assetsReady,
      timeline: options.timeline,
      baseState: baseStateBefore[i + 1],
      ui: options.ui,
    });
    const resolved = scene.resolve({ ...context, nextState });
    let minStart = 0;
    for (const transition of resolved.transitions ?? []) {
      const start = typeof transition.start === 'function' ? transition.start(context) : transition.start;
      if (start < minStart) minStart = start;
    }
    if (minStart < 0) {
      const autoEntryStart = window.start + minStart * (window.end - window.start);
      window.entryStart = Math.min(window.entryStart, autoEntryStart);
    }
  }

  // Resolve clip metadata: manifest takes precedence over the legacy availableClips array.
  const resolvedClips: ClipMeta[] = options.manifest
    ? clipMetaFromManifest(options.manifest)
    : (options.availableClips ?? []);

  const subTickCount = Math.max(2, options.timeline.subTickCount);
  const tickStep = 1 / (subTickCount - 1);
  const ticks: SceneTrackTick[] = [];
  const warnOnce = new Set<string>();
  const warnAnnotationOnce = new Set<string>();
  const serialize = (value: unknown) => {
    try {
      return JSON.stringify(value, (_key, next) => {
        if (typeof next === 'function') return '[function]';
        if (next && typeof next === 'object') {
          if ('content' in (next as Record<string, unknown>)) {
            const { content, ...rest } = next as Record<string, unknown>;
            return rest;
          }
          if ('$$typeof' in (next as Record<string, unknown>)) return '[react]';
        }
        return next;
      });
    } catch (error) {
      console.warn('[SceneTrack]', 'serialize.failed', error);
      return '';
    }
  };
  // NOTE: serialize uses JSON.stringify for structural comparison. JSON.stringify does not
  // guarantee key insertion order for plain objects, so two objects with the same keys/values
  // in different order would produce different serializations and generate a spurious delta.
  // In practice this does not occur because scene state objects are produced by the same
  // constructor paths, but a structural deep-equals would be more correct long-term.
  const buildDelta = (prev: SceneFrameState | undefined, next: SceneFrameState): SceneFrameDelta => {
    if (!prev) {
      return {
        id: next.id,
        scrollProgress: next.scrollProgress,
        isLightScene: next.isLightScene,
        lighting: next.lighting,
        environment: next.environment,
        floor: next.floor,
        background: next.background,
        ribbon: next.ribbon,
        models: next.models,
        annotations: next.annotations,
        annotationDefaults: next.annotationDefaults,
      };
    }
    const delta: SceneFrameDelta = {};
    if (prev.id !== next.id) delta.id = next.id;
    if (prev.scrollProgress !== next.scrollProgress) delta.scrollProgress = next.scrollProgress;
    if (prev.isLightScene !== next.isLightScene) delta.isLightScene = next.isLightScene;
    if (serialize(prev.lighting) !== serialize(next.lighting)) delta.lighting = next.lighting;
    if (serialize(prev.environment) !== serialize(next.environment)) delta.environment = next.environment;
    if (serialize(prev.floor) !== serialize(next.floor)) delta.floor = next.floor;
    if (serialize(prev.background) !== serialize(next.background)) delta.background = next.background;
    if (serialize(prev.ribbon) !== serialize(next.ribbon)) delta.ribbon = next.ribbon;
    if (serialize(prev.models) !== serialize(next.models)) delta.models = next.models;
    if (serialize(prev.annotations) !== serialize(next.annotations)) delta.annotations = next.annotations;
    if (serialize(prev.annotationDefaults) !== serialize(next.annotationDefaults)) {
      delta.annotationDefaults = next.annotationDefaults;
    }
    return delta;
  };

  for (let i = 0; i < subTickCount; i += 1) {
    const progress = clamp01(i * tickStep);
    const activeIndex = resolveActiveSceneIndex(progress, windows);
    const scene = scenes[activeIndex];
    const window = windows[activeIndex];
    if (!scene || !window) continue;
    const baseState = baseStateBefore[activeIndex];
    const context = buildSceneContext({
      progress,
      assetsReady: options.assetsReady,
      timeline: options.timeline,
      start: window.start,
      end: window.end,
      baseState,
      baseStateRaw: baseStateRawBefore[activeIndex],
      ui: options.ui,
      resourceRegistry: options.resourceRegistry,
    });

    const nextState = buildNextState({
      scenes,
      windows,
      index: activeIndex,
      progress,
      assetsReady: options.assetsReady,
      timeline: options.timeline,
      baseState: baseStateBefore[activeIndex + 1],
      ui: options.ui,
    });
    const contextWithNext = { ...context, nextState };
    const resolvedScene = scene.resolve(contextWithNext);
    const resolved = applySceneTransitions(resolvedScene.frame, resolvedScene.transitions, contextWithNext, { phase: 'active' });
    const annotationPrimitives = compileAnnotations(resolved, baseState);
    const registryModels = options.resourceRegistry?.models as Record<
      string,
      ResourceRegistry['models'][keyof ResourceRegistry['models']]
    > | undefined;
    const modelAnimations = resolved.models
      ? Object.fromEntries(
        Object.entries(resolved.models).map(([id, instance]) => {
          // Validate subpart IDs against the registry at compile time.
          // Catches typos and stale IDs before they become silent runtime no-ops.
          if (registryModels && instance.model.parts) {
            for (const part of Object.values(instance.model.parts)) {
              if (!part?.modelId || !part.subparts) continue;
              const knownSubparts = registryModels[part.modelId]?.subparts;
              if (!knownSubparts) continue;
              const knownSet = new Set(knownSubparts);
              for (const key of Object.keys(part.subparts)) {
                const warnKey = `subpart:${resolved.id}:${id}:${part.modelId}:${key}`;
                if (!knownSet.has(key) && !warnOnce.has(warnKey)) {
                  warnOnce.add(warnKey);
                  console.warn('[RobotSceneCompiler]', 'unknown.subpart', {
                    sceneId: resolved.id,
                    modelId: id,
                    partId: part.id,
                    containedModelId: part.modelId,
                    subpartId: key,
                    known: knownSubparts,
                  });
                }
              }
            }
          }
          return [
            id,
            compileAnimation({
              sceneId: resolved.id,
              playback: instance.playback,
              prefersReducedMotion: options.prefersReducedMotion,
              availableClips: resolvedClips,
              warnOnce,
            }),
          ];
        }),
      )
      : undefined;

    ticks.push({
      index: i,
      progress,
      sceneId: scene.id,
      sceneIndex: scene.index,
      sceneProgress: context.sceneProgress,
      state: resolved,
      annotationPrimitives,
      deltaForward: {},
      deltaBackward: {},
      modelAnimations,
    });
  }

  for (let i = 0; i < ticks.length; i += 1) {
    const tick = ticks[i];
    if (!tick) continue;
    const prev = ticks[i - 1];
    const next = ticks[i + 1];
    tick.deltaForward = buildDelta(prev?.state, tick.state);
    tick.deltaBackward = buildDelta(next?.state, tick.state);
  }

  const result: SceneTrack = {
    ticks,
    tickStep,
    subTickCount,
    sceneWindows: windows,
    anchorTargets: options.manifest?.robot.anchorTargets,
  };
  if (perfEnabled && typeof performance !== 'undefined' && performance.mark && performance.measure) {
    performance.mark(`${perfLabel}:end`);
    performance.measure(`${perfLabel}:duration`, `${perfLabel}:start`, `${perfLabel}:end`);
  }
  return result;
};
