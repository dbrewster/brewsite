import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { SceneDefinition, SceneFrameContext, SceneTransition } from './sceneTypes';
import type { SceneFrame, SceneTrack, SceneTrackTick, SceneWindow, SceneFrameDelta, ClipMeta } from './sceneTrackTypes';
import { resolveSceneFromDsl } from './sceneDslCompiler';
import type { SceneTimeline } from '../timeline';
import { clamp01, invLerp, rangeProgress } from '../timeline/math';
import { applySceneTransitions } from './sceneUtils';
import { compileAnnotations } from './annotationCompiler';
import { compileLabels } from './labelCompiler';

export type CompileSceneTrackOptions = {
  scenes: SceneDefinition[];
  timeline: SceneTimeline;
  assetsReady: boolean;
  widgetRegistry: WidgetRegistry;
  /**
   * Clip metadata passed into CompileExtraContext for ISceneElement.compileExtra().
   * Derived from the manifest via clipMetaFromManifest(). Empty before manifest loads.
   */
  clipMeta: ClipMeta[];
  /** Provided by the engine layer (never read from window here). */
  prefersReducedMotion?: boolean;
};

type NormalizedScene = {
  id: string;
  index: number;
  entryLead?: number;
  entryStart?: number;
  resolve: (
    context: SceneFrameContext,
    widgetRegistry: WidgetRegistry,
  ) => { frame: SceneFrame; transitions: SceneTransition[] };
};

/**
 * Build scene context for a given progress range.
 */
const buildSceneContext = (options: {
  progress: number;
  assetsReady: boolean;
  timeline: SceneTimeline;
  start: number;
  end: number;
  baseState?: SceneFrame;
  baseStateRaw?: SceneFrame;
  nextState?: SceneFrame;
}): SceneFrameContext => {
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
    timeline: options.timeline,
    baseState: options.baseState,
    baseStateRaw: options.baseStateRaw,
    nextState: options.nextState,
  };
};

/**
 * Resolve the scene window (timing boundaries) for a scene.
 */
const resolveSceneWindow = (
  timeline: SceneTimeline,
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

/**
 * Find the active scene index at a given progress point.
 */
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

/**
 * Check if a value is a SceneFrame object.
 */
const isSceneFrame = (value: unknown): value is SceneFrame => {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return 'id' in obj && 'scrollProgress' in obj && 'widgets' in obj;
};

/**
 * Normalize scenes into a consistent internal format.
 */
const normalizeScenes = (scenes: SceneDefinition[], timeline: SceneTimeline): NormalizedScene[] => {
  return scenes.map((scene) => {
    return {
      id: scene.id,
      index: scene.index,
      entryLead: scene.entryLead,
      entryStart: scene.entryStart,
      resolve: (context, widgetRegistry) => {
        const frame = scene.getFrame(context);
        // Handle JSX-based scene definitions (React elements)
        if (frame && typeof frame === 'object' && !Array.isArray(frame) && '$$typeof' in frame) {
          // It's a React element - need to compile it
          const { frame: compiledFrame, transitions } = resolveSceneFromDsl(frame, context, widgetRegistry);
          return { frame: compiledFrame, transitions };
        }
        // It's a pre-compiled SceneFrame
        if (isSceneFrame(frame)) {
          return { frame, transitions: scene.transitions ?? [] };
        }
        throw new Error(`Scene "${scene.id}" getFrame must return a JSX element or SceneFrame object`);
      },
    };
  });
};

/**
 * Build next scene state for transition context.
 */
const buildNextState = (options: {
  scenes: NormalizedScene[];
  windows: SceneWindow[];
  index: number;
  progress: number;
  assetsReady: boolean;
  timeline: SceneTimeline;
  baseState?: SceneFrame;
  ignoreBaseState?: boolean;
  widgetRegistry: WidgetRegistry;
}): SceneFrame | undefined => {
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
  });
  return nextScene.resolve(context, options.widgetRegistry).frame;
};

/**
 * Serialize frame state for delta detection.
 */
const serialize = (value: unknown): string => {
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

/**
 * Build a delta between two frame states.
 */
const buildDelta = (prev: SceneFrame | undefined, next: SceneFrame): SceneFrameDelta => {
  if (!prev) {
    return {
      widgets: next.widgets,
      annotations: next.annotations,
      annotationDefaults: next.annotationDefaults,
      labels: next.labels,
    };
  }
  const delta: SceneFrameDelta = {};
  if (serialize(prev.widgets) !== serialize(next.widgets)) {
    delta.widgets = next.widgets;
  }
  if (serialize(prev.annotations) !== serialize(next.annotations)) {
    delta.annotations = next.annotations;
  }
  if (serialize(prev.annotationDefaults) !== serialize(next.annotationDefaults)) {
    delta.annotationDefaults = next.annotationDefaults;
  }
  if (serialize(prev.labels) !== serialize(next.labels)) {
    delta.labels = next.labels;
  }
  return delta;
};

export const compileSceneTrack = (options: CompileSceneTrackOptions): SceneTrack => {
  const perfEnabled =
    typeof window !== 'undefined' &&
    (window as unknown as { __robotRuntimeDebug?: { perf?: boolean } }).__robotRuntimeDebug?.perf;
  const perfLabel = perfEnabled
    ? `sceneTrack:${options.timeline.sceneCount}:${options.timeline.subTickCount}`
    : '';
  if (perfEnabled && typeof performance !== 'undefined' && performance.mark) {
    performance.mark(`${perfLabel}:start`);
  }

  const scenes = normalizeScenes(options.scenes, options.timeline);
  const windows = scenes.map((scene, index) => resolveSceneWindow(options.timeline, scene, scenes[index + 1]));
  const baseStateBefore: Array<SceneFrame | undefined> = [];
  const baseStateRawBefore: Array<SceneFrame | undefined> = [];
  let inheritedState: SceneFrame | undefined;
  let inheritedRawState: SceneFrame | undefined;

  // Pass 1: Base State Resolution
  // Compute end state for each scene to establish inheritance chain
  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const window = windows[i];
    if (!scene || !window) continue;
    baseStateBefore[i] = inheritedState;
    baseStateRawBefore[i] = inheritedRawState;

    if (window.start > window.end) {
      console.warn('[SceneTrackCompiler]', 'invalid.transition.window', {
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
    });

    const nextState = buildNextState({
      scenes,
      windows,
      index: i,
      progress: window.end,
      assetsReady: options.assetsReady,
      timeline: options.timeline,
      baseState: inheritedState,
      widgetRegistry: options.widgetRegistry,
    });

    const endContextWithNext = { ...endContext, nextState };
    const endResolved = scene.resolve(endContextWithNext, options.widgetRegistry);
    inheritedState = applySceneTransitions(endResolved.frame, endResolved.transitions, endContextWithNext, {
      phase: 'inherit',
    });
    inheritedRawState = endResolved.frame;
  }

  // Pass 2: Auto-Entry Detection
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
    });

    const nextState = buildNextState({
      scenes,
      windows,
      index: i,
      progress: window.start,
      assetsReady: options.assetsReady,
      timeline: options.timeline,
      baseState: baseStateBefore[i + 1],
      widgetRegistry: options.widgetRegistry,
    });

    const resolved = scene.resolve({ ...context, nextState }, options.widgetRegistry);
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

  // Pass 3: Tick Baking
  const subTickCount = Math.max(2, options.timeline.subTickCount);
  const tickStep = 1 / (subTickCount - 1);
  const ticks: SceneTrackTick[] = [];
  const warnOnce = new Set<string>();

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
    });

    const nextState = buildNextState({
      scenes,
      windows,
      index: activeIndex,
      progress,
      assetsReady: options.assetsReady,
      timeline: options.timeline,
      baseState: baseStateBefore[activeIndex + 1],
      widgetRegistry: options.widgetRegistry,
    });

    const contextWithNext = { ...context, nextState };
    const resolvedScene = scene.resolve(contextWithNext, options.widgetRegistry);
    const resolved = applySceneTransitions(resolvedScene.frame, resolvedScene.transitions, contextWithNext, {
      phase: 'active',
    });

    // Compile annotations
    const annotationPrimitives = compileAnnotations(resolved, baseState, warnOnce);

    // Compile labels
    const labelPrimitives = compileLabels(resolved.labels ?? [], context);

    // Collect widget extras via compileExtra() — engine passes prefersReducedMotion.
    const widgetExtras: Record<string, unknown> = {};
    for (const widget of options.widgetRegistry.getSceneElements()) {
      const widgetState = resolved.widgets[widget.widgetId];
      if (widget.compileExtra && widgetState !== undefined) {
        const compileExtraCtx = {
          sceneProgress: context.sceneProgress,
          globalProgress: context.globalProgress,
          clipMeta: options.clipMeta,
          prefersReducedMotion: options.prefersReducedMotion ?? false,
        };
        widgetExtras[widget.widgetId] = widget.compileExtra(widgetState, compileExtraCtx);
      }
    }

    ticks.push({
      index: i,
      progress,
      sceneId: scene.id,
      sceneIndex: scene.index,
      sceneProgress: context.sceneProgress,
      state: resolved,
      annotationPrimitives,
      labelPrimitives,
      deltaForward: {},
      deltaBackward: {},
      widgetExtras: Object.keys(widgetExtras).length > 0 ? widgetExtras : undefined,
    });
  }

  // Compute forward/backward deltas
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
  };

  if (perfEnabled && typeof performance !== 'undefined' && performance.mark && performance.measure) {
    performance.mark(`${perfLabel}:end`);
    performance.measure(`${perfLabel}:duration`, `${perfLabel}:start`, `${perfLabel}:end`);
  }

  return result;
};
