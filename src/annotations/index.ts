export type {
  AnnotationPlacement,
  AnnotationStyle,
  AnnotationContentEntry,
  AnnotationDefinition,
  AnnotationDefaults,
  AnnotationResolved,
} from './annotationTypes';
export { DEFAULT_ANNOTATION_DEFAULTS } from './annotationTypes';
export { DEFAULT_ANNOTATION_STYLE, DEFAULT_ANNOTATION_DEFAULTS as DEFAULT_ANNOTATION_DEFAULTS_FULL } from './annotationDefaults';
export { computeLabelSize, computeAnchorOffset, type LabelSize } from './annotationLayout';
export { computeLineIntersection2D, type LineIntersection2D } from './annotationLineMath';
export { type AnnotationTargetResolution, type AnnotationTargetProvider } from './annotationTargets';
export { DEFAULT_FONT_FAMILY, resolveAnnotationFont } from './annotationFonts';
export { AnnotationItem } from './AnnotationItem';
