import type { SceneFrame } from './sceneTrackTypes';
import type { AnnotationDefaults, AnnotationResolved } from '../annotations/annotationTypes';

/**
 * Compiles annotations from scene frame state.
 * Stub - implemented in Phase 4
 */
export const compileAnnotations = (
  state: SceneFrame,
  baseState?: SceneFrame,
  warnAnnotationOnce?: Set<string>,
): AnnotationResolved[] => {
  const warnOnce = warnAnnotationOnce ?? new Set<string>();

  // Stub: merge annotations from state and baseState
  const mergedAnnotations = (() => {
    if (state.annotations === undefined) return baseState?.annotations ?? [];
    if (state.annotations.length === 0) return [];
    const hasFullDefinition = state.annotations.some((annotation) =>
      typeof annotation.label === 'string' && annotation.label.trim().length > 0,
    );
    if (!baseState?.annotations || baseState.annotations.length === 0) {
      return state.annotations;
    }
    return hasFullDefinition ? state.annotations : [...baseState.annotations, ...state.annotations];
  })();

  // Return as-is for now
  return mergedAnnotations as AnnotationResolved[];
};
