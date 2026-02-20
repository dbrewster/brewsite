// Annotation compilation utility — belongs in the compiler layer because it takes SceneFrameState,
// which is a compiler-layer type. Element transition specs (annotationsTransitionSpec,
// annotationDefaultsTransitionSpec) remain in elements/annotations/compile.ts.
import type { AnnotationDefaults } from '../../elements/annotations/types';
import { DEFAULT_ANNOTATION_DEFAULTS } from '../../annotations/annotationDefaults';
import { normalizeAnnotationDefinitions } from '../../annotations/annotationValidation';
import { logAnnotationError, logAnnotationWarning } from '../../annotations/annotationTelemetry';
import type { SceneFrameState } from './sceneTypes';

export const compileAnnotations = (
  state: SceneFrameState,
  baseState?: SceneFrameState,
  warnAnnotationOnce?: Set<string>,
) => {
  const modelScale = 1;
  const warnOnce = warnAnnotationOnce ?? new Set<string>();

  const mergedAnnotations = (() => {
    if (state.annotations === undefined) return baseState?.annotations ?? [];
    if (state.annotations.length === 0) return [];
    const hasFullDefinition = state.annotations.some((annotation) =>
      typeof annotation.label === 'string' && annotation.label.trim().length > 0,
    );
    if (!baseState?.annotations || baseState.annotations.length === 0) {
      return state.annotations;
    }
    return hasFullDefinition
      ? state.annotations
      : [
        ...baseState.annotations,
        ...state.annotations,
      ];
  })();
  const annotations = mergedAnnotations.map((annotation) => ({
    ...annotation,
    worldScale: typeof annotation.worldScale === 'number' ? annotation.worldScale : modelScale,
  }));
  const mergedDefaults: AnnotationDefaults = {
    style: {
      ...DEFAULT_ANNOTATION_DEFAULTS.style,
      ...(baseState?.annotationDefaults?.style ?? {}),
      ...(state.annotationDefaults?.style ?? {}),
    },
    visibility: {
      ...DEFAULT_ANNOTATION_DEFAULTS.visibility,
      ...(baseState?.annotationDefaults?.visibility ?? {}),
      ...(state.annotationDefaults?.visibility ?? {}),
    },
  };
  const result = normalizeAnnotationDefinitions({
    defaults: mergedDefaults,
    annotations,
    allowEmpty: true,
  });
  for (const warning of result.warnings) {
    const key = `warn:${state.id}:${warning.annotationId ?? 'global'}:${warning.field}:${warning.reasonCode}`;
    if (warnOnce.has(key)) continue;
    warnOnce.add(key);
    logAnnotationWarning(warning.reasonCode, {
      sceneId: state.id,
      annotationId: warning.annotationId,
      field: warning.field,
      message: warning.message,
    });
  }
  for (const error of result.errors) {
    const key = `error:${state.id}:${error.annotationId ?? 'global'}:${error.field}:${error.reasonCode}`;
    if (warnOnce.has(key)) continue;
    warnOnce.add(key);
    logAnnotationError(error.reasonCode, {
      sceneId: state.id,
      annotationId: error.annotationId,
      field: error.field,
      message: error.message,
    });
  }
  return result.annotations;
};
