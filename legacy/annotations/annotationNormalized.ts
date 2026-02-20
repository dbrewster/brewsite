import type {
  AnnotationContentEntry,
  AnnotationDefaults,
  AnnotationDefinition,
  AnnotationLabelAnchor,
  AnnotationMode,
  AnnotationStyle,
  AnnotationTarget,
  AnnotationVisibility,
} from './annotationTypes';

export type AnnotationResolved = {
  id: string;
  label: string;
  truncatedLabel: string;
  mode: AnnotationMode;
  target: AnnotationTarget | null;
  labelAnchor: AnnotationLabelAnchor;
  worldScale: number;
  style: AnnotationStyle;
  visibility: AnnotationVisibility;
  enabled: boolean;
  contentId?: string;
  content?: AnnotationContentEntry;
};

export type AnnotationSet = {
  version: string;
  defaults: AnnotationDefaults;
  annotations: AnnotationResolved[];
};

export type AnnotationValidationIssue = {
  annotationId?: string;
  field: string;
  reasonCode:
    | 'missing_target'
    | 'invalid_label_position'
    | 'invalid_style'
    | 'duplicate_id'
    | 'invalid_config';
  message: string;
};

export type AnnotationValidationResult = {
  value: AnnotationSet | null;
  warnings: AnnotationValidationIssue[];
  errors: AnnotationValidationIssue[];
};

export type AnnotationNormalizationResult = {
  annotations: AnnotationResolved[];
  warnings: AnnotationValidationIssue[];
  errors: AnnotationValidationIssue[];
};

export type AnnotationNormalizationOptions = {
  defaults: AnnotationDefaults;
  allowEmpty?: boolean;
  version?: string;
  annotations?: AnnotationDefinition[];
};
