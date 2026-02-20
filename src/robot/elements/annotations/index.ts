export type {
  AnnotationMode,
  AnnotationTarget,
  AnnotationScreenReferenceX,
  AnnotationScreenReferenceY,
  AnnotationLabelAnchorScreen,
  AnnotationLabelAnchorLegacy,
  AnnotationLabelAnchor,
  AnnotationContentEntry,
  AnnotationContentMap,
  AnnotationVisibility,
  AnnotationFontFamily,
  AnnotationCssStyle,
  AnnotationStyle,
  AnnotationDefinitionScreen,
  AnnotationDefinition,
  AnnotationDefaults,
  AnnotationConfig,
  AnnotationResolved,
} from './types';

export { Annotations, Annotation } from './dsl';
export type { AnnotationsProps, AnnotationProps } from './dsl';

export {
  annotationsTransitionSpec,
  annotationDefaultsTransitionSpec,
} from './compile';
// compileAnnotations is a compiler-layer utility — import from runtime/compiler/annotationCompiler.ts
