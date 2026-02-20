/**
 * Annotation default values.
 */

import type { AnnotationDefaults, AnnotationStyle } from './annotationTypes';

export const DEFAULT_ANNOTATION_STYLE: AnnotationStyle = {
  fontSize: 14,
  color: '#ffffff',
  backgroundColor: '#000000',
  borderRadius: 4,
  padding: '8px 12px',
  opacity: 1,
};

export const DEFAULT_ANNOTATION_DEFAULTS: AnnotationDefaults = {
  style: DEFAULT_ANNOTATION_STYLE,
};
