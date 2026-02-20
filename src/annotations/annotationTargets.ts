/**
 * Annotation target resolution.
 */

import type { AnnotationPlacement } from './annotationTypes';

export type AnnotationTargetResolution = {
  ok: boolean;
  targetPoint?: [number, number, number];
  targetMatrix?: number[];
  targetColor?: string;
  reason?: 'missing_target' | 'invalid_config';
};

export type AnnotationTargetProvider = {
  resolveTargetPoint: (placement: AnnotationPlacement) => AnnotationTargetResolution;
  listTargets: () => string[];
};
