import { clamp01, rangeProgress } from '../timeline/math';
import type { SceneFrameContext, SceneTransition } from './sceneTypes';
import type { SceneFrame } from './sceneTrackTypes';

const transitionLogState = new Map<string, 'before' | 'active' | 'after'>();
const isBrowser = typeof window !== 'undefined';

/**
 * Logs transition status to console when __robotSceneDebug or __robotRuntimeDebug is enabled.
 * Stub - implemented in Phase 4
 */
const logTransitionStatus = (options: {
  stateId: string;
  transitionId: string;
  phase: 'active' | 'inherit';
  progress: number;
  globalProgress: number;
  start: number;
  end: number;
  t: number;
}): void => {
  if (!isBrowser) return;
  const debug = (window as unknown as { __robotSceneDebug?: boolean; __robotRuntimeDebug?: boolean });
  if (!debug.__robotSceneDebug && !debug.__robotRuntimeDebug) return;

  const key = `${options.stateId}:${options.transitionId}:${options.phase}`;
  const status =
    options.progress < options.start
      ? 'before'
      : options.progress > options.end
        ? 'after'
        : 'active';

  const last = transitionLogState.get(key);
  if (last === status) return;

  transitionLogState.set(key, status);
  console.log('[RobotScene][transition]', {
    id: options.transitionId,
    scene: options.stateId,
    phase: options.phase,
    status,
    progress: options.progress,
    globalProgress: options.globalProgress,
    start: options.start,
    end: options.end,
    t: options.t,
  });
};

/**
 * Computes progress within a range [start, end].
 * Stub - implemented in Phase 4
 */
export const computeSceneProgress = (progress: number, start: number, end: number): number => {
  if (start === end) return progress >= end ? 1 : 0;
  return clamp01(rangeProgress(progress, start, end));
};

/**
 * Applies a list of scene transitions to a frame state.
 * Stub - implemented in Phase 4
 */
export const applySceneTransitions = (
  state: SceneFrame,
  transitions: SceneTransition[] | undefined,
  context: SceneFrameContext,
  options: { phase?: 'active' | 'inherit' } = {},
): SceneFrame => {
  if (!transitions || transitions.length === 0) return state;

  const phase = options.phase ?? 'active';
  const progress =
    phase === 'inherit'
      ? context.sceneProgressRaw ?? context.progress
      : context.progress;

  let next = state;

  for (const transition of transitions) {
    const scope = transition.scope ?? 'active';

    if (phase === 'inherit' && scope !== 'persist') {
      const end = typeof transition.end === 'function'
        ? transition.end(context)
        : transition.end;
      if (progress < end) {
        continue;
      }
    }

    const start = typeof transition.start === 'function'
      ? transition.start(context)
      : transition.start;
    const end = typeof transition.end === 'function'
      ? transition.end(context)
      : transition.end;
    const t = computeSceneProgress(progress, start, end);

    logTransitionStatus({
      stateId: state.id ?? 'unknown',
      transitionId: transition.id ?? 'transition',
      phase,
      progress,
      globalProgress: context.globalProgress,
      start,
      end,
      t,
    });

    if (progress < start) continue;

    const resolvedProgress = phase === 'inherit' && progress > end ? end : progress;
    const resolvedT = computeSceneProgress(resolvedProgress, start, end);

    next = transition.apply(next, context, resolvedT);
  }

  return next;
};

/**
 * Converts hex color string to RGB string format.
 * Stub - implemented in Phase 4
 */
export const hexToRgb = (hex: string): string | null => {
  const raw = hex.replace('#', '');
  const value =
    raw.length === 3
      ? raw.split('').map((c) => c + c).join('')
      : raw;

  if (value.length !== 6) return null;

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return `${r} ${g} ${b}`;
};
