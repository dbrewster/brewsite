import type {AnnotationTarget} from './annotationTypes';

export type AnnotationTargetResolution = {
  ok: boolean;
  targetPoint?: [number, number, number];
  targetMatrix?: number[];
  targetColor?: string;
  reason?: 'missing_target' | 'invalid_config';
};

export type AnnotationTargetProvider = {
  resolveTargetPoint: (target: AnnotationTarget) => AnnotationTargetResolution;
  listTargets: () => string[];
};
