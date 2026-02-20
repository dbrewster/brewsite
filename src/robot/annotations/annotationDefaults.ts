import type {AnnotationDefaults, AnnotationStyle, AnnotationVisibility} from './annotationTypes';

export const DEFAULT_ANNOTATION_STYLE: AnnotationStyle = {
  textColor: 'target-color',
  fontFamily: 'Space Grotesk',
  fontSize: 0.9,
  backgroundColor: '#121214',
  backgroundOpacity: 0.2,
  labelOpacity: 0.85,
  borderRadius: 0.08,
  paddingX: 0.35,
  paddingY: 0.2,
  lineColor: 'target-color',
  lineOpacity: 0.65,
  lineThickness: 0.1,
  billboard: false,
  depthTestLabel: false,
  depthTestLine: true,
  anchorX: 'center',
  anchorY: 'middle',
  allowRoll: false,
  maxWidth: 6.0,
  minWidth: 1.2,
  minHeight: 0.6,
  scaleWithDistance: false,
  minScale: 0.85,
  maxScale: 1.3,
  containerCss: {},
  css: {},
};

export const DEFAULT_ANNOTATION_VISIBILITY: AnnotationVisibility = {
  isVisible: true,
  minDistance: 0,
  maxDistance: Number.POSITIVE_INFINITY,
};

export const DEFAULT_ANNOTATION_DEFAULTS: AnnotationDefaults = {
  style: DEFAULT_ANNOTATION_STYLE,
  visibility: DEFAULT_ANNOTATION_VISIBILITY,
};
