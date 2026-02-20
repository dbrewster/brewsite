import type {AnnotationConfig, AnnotationDefaults, AnnotationDefinition, AnnotationLabelAnchor, AnnotationStyle, AnnotationTarget, AnnotationVisibility,} from './annotationTypes';
import {DEFAULT_ANNOTATION_DEFAULTS} from './annotationDefaults';
import type {
  AnnotationNormalizationOptions,
  AnnotationNormalizationResult,
  AnnotationResolved,
  AnnotationValidationIssue,
  AnnotationValidationResult,
} from './annotationNormalized';

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const clampLabel = (label: string, maxLength: number): { label: string; truncated: string } => {
  if (label.length <= maxLength) return { label, truncated: label };
  const trimmed = label.slice(0, Math.max(0, maxLength - 1));
  return { label, truncated: `${trimmed}…` };
};

const sanitizeVec3 = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);

const mergeStyle = (base: AnnotationStyle, override?: Partial<AnnotationStyle>): AnnotationStyle => ({
  ...base,
  ...(override ?? {}),
});

const mergeVisibility = (base: AnnotationVisibility, override?: Partial<AnnotationVisibility>): AnnotationVisibility => ({
  ...base,
  ...(override ?? {}),
});

const validateStyle = (
  style: AnnotationStyle,
  warnings: AnnotationValidationIssue[],
  annotationId?: string,
): AnnotationStyle => {
  const next: AnnotationStyle = { ...style };

  const numericFields: Array<keyof AnnotationStyle> = [
    'fontSize',
    'backgroundOpacity',
    'labelOpacity',
    'borderRadius',
    'paddingX',
    'paddingY',
    'lineOpacity',
    'lineThickness',
    'maxWidth',
    'minWidth',
    'minHeight',
    'minScale',
    'maxScale',
  ];

  for (const field of numericFields) {
    const value = next[field];
    if (!isFiniteNumber(value)) {
      warnings.push({
        annotationId,
        field: String(field),
        reasonCode: 'invalid_style',
        message: `Invalid numeric value for ${String(field)}. Falling back to default.`,
      });
      (next as Record<string, unknown>)[field] = DEFAULT_ANNOTATION_DEFAULTS.style[field];
    }
  }

  if (next.minWidth > next.maxWidth) {
    warnings.push({
      annotationId,
      field: 'minWidth',
      reasonCode: 'invalid_style',
      message: 'minWidth was greater than maxWidth. Swapping values.',
    });
    const temp = next.minWidth;
    next.minWidth = next.maxWidth;
    next.maxWidth = temp;
  }

  if (next.minScale > next.maxScale) {
    warnings.push({
      annotationId,
      field: 'minScale',
      reasonCode: 'invalid_style',
      message: 'minScale was greater than maxScale. Swapping values.',
    });
    const temp = next.minScale;
    next.minScale = next.maxScale;
    next.maxScale = temp;
  }

  if (next.containerCss && (typeof next.containerCss !== 'object' || Array.isArray(next.containerCss))) {
    warnings.push({
      annotationId,
      field: 'containerCss',
      reasonCode: 'invalid_style',
      message: 'Invalid containerCss style object. Falling back to empty object.',
    });
    next.containerCss = {};
  }

  if (next.css && (typeof next.css !== 'object' || Array.isArray(next.css))) {
    warnings.push({
      annotationId,
      field: 'css',
      reasonCode: 'invalid_style',
      message: 'Invalid css style object. Falling back to empty object.',
    });
    next.css = {};
  }

  return next;
};

const validateVisibility = (
  visibility: AnnotationVisibility,
  warnings: AnnotationValidationIssue[],
  annotationId?: string,
): AnnotationVisibility => {
  const next = { ...visibility };

  if (!isFiniteNumber(next.minDistance)) {
    warnings.push({
      annotationId,
      field: 'minDistance',
      reasonCode: 'invalid_style',
      message: 'Invalid minDistance. Falling back to default.',
    });
    next.minDistance = DEFAULT_ANNOTATION_DEFAULTS.visibility.minDistance;
  }
  const maxDistanceValid =
    typeof next.maxDistance === 'number' &&
    (Number.isFinite(next.maxDistance) || next.maxDistance === Number.POSITIVE_INFINITY);
  if (!maxDistanceValid) {
    warnings.push({
      annotationId,
      field: 'maxDistance',
      reasonCode: 'invalid_style',
      message: 'Invalid maxDistance. Falling back to default.',
    });
    next.maxDistance = DEFAULT_ANNOTATION_DEFAULTS.visibility.maxDistance;
  }
  if (next.minDistance > next.maxDistance) {
    warnings.push({
      annotationId,
      field: 'minDistance',
      reasonCode: 'invalid_style',
      message: 'minDistance was greater than maxDistance. Swapping values.',
    });
    const temp = next.minDistance;
    next.minDistance = next.maxDistance;
    next.maxDistance = temp;
  }

  return next;
};

export const normalizeAnnotationDefinitions = (options: AnnotationNormalizationOptions): AnnotationNormalizationResult => {
  const warnings: AnnotationValidationIssue[] = [];
  const errors: AnnotationValidationIssue[] = [];
  const annotations: AnnotationResolved[] = [];
  const defaults: AnnotationDefaults = options.defaults ?? DEFAULT_ANNOTATION_DEFAULTS;
  const source = options.annotations ?? [];

  if (!options.allowEmpty && source.length === 0) {
    errors.push({
      field: 'annotations',
      reasonCode: 'invalid_config',
      message: 'Annotations list is empty.',
    });
  }

  const byId = new Map<string, AnnotationDefinition>();
  for (const annotation of source) {
    if (!annotation || typeof annotation !== 'object') continue;
    const id = annotation.id;
    if (!id || typeof id !== 'string') {
      errors.push({
        annotationId: undefined,
        field: 'id',
        reasonCode: 'invalid_config',
        message: 'Annotation id is required.',
      });
      continue;
    }
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...annotation });
      continue;
    }

    const next: AnnotationDefinition = {
      id,
      label: annotation.label ?? existing.label,
      mode: annotation.mode ?? existing.mode,
      target: annotation.target ?? existing.target,
      labelAnchor: annotation.labelAnchor ?? existing.labelAnchor,
      worldScale: annotation.worldScale ?? existing.worldScale,
      enabled: annotation.enabled ?? existing.enabled,
      contentId: annotation.contentId ?? existing.contentId,
      style: { ...(existing.style ?? {}), ...(annotation.style ?? {}) },
      visibility: { ...(existing.visibility ?? {}), ...(annotation.visibility ?? {}) },
      content: { ...(existing.content ?? {}), ...(annotation.content ?? {}) },
    };

    byId.set(id, next);
  }

  for (const annotation of byId.values()) {
    const id = annotation.id;
    const labelValue = typeof annotation.label === 'string' && annotation.label.trim().length > 0
      ? annotation.label
      : undefined;

    if (!labelValue) {
      errors.push({
        annotationId: id,
        field: 'label',
        reasonCode: 'invalid_config',
        message: 'Annotation label is required.',
      });
      continue;
    }

    const { label, truncated } = clampLabel(labelValue, 80);
    if (label !== truncated) {
      warnings.push({
        annotationId: id,
        field: 'label',
        reasonCode: 'invalid_style',
        message: 'Label exceeded 80 characters and was truncated.',
      });
    }

    const mode = annotation.mode ?? 'screen';
    const target = annotation.target;
    const hasPart = target && 'targetPartId' in target && typeof target.targetPartId === 'string';
    const hasPoint = target && 'targetPoint' in target && sanitizeVec3(target.targetPoint);
    if (hasPart && hasPoint) {
      errors.push({
        annotationId: id,
        field: 'target',
        reasonCode: 'invalid_config',
        message: 'Exactly one of targetPartId or targetPoint is required.',
      });
      continue;
    }

    const labelAnchor = annotation.labelAnchor;
    const hasScreenAnchor =
      labelAnchor
      && 'reference' in labelAnchor
      && typeof labelAnchor.reference?.x === 'string'
      && typeof labelAnchor.reference?.y === 'string'
      && typeof labelAnchor.offset?.xPct === 'number'
      && Number.isFinite(labelAnchor.offset.xPct)
      && typeof labelAnchor.offset?.yPct === 'number'
      && Number.isFinite(labelAnchor.offset.yPct);
    const hasLegacyPosition =
      labelAnchor && 'labelPosition' in labelAnchor && sanitizeVec3(labelAnchor.labelPosition);
    const hasLegacyOffset =
      labelAnchor && 'labelOffset' in labelAnchor && sanitizeVec3(labelAnchor.labelOffset);

    if (!hasScreenAnchor && !hasLegacyPosition && !hasLegacyOffset) {
      errors.push({
        annotationId: id,
        field: 'labelAnchor',
        reasonCode: 'invalid_label_position',
        message: 'labelAnchor.reference + labelAnchor.offset are required.',
      });
      continue;
    }

    const needsTarget = Boolean(
      (hasScreenAnchor
        && 'reference' in (labelAnchor as { reference?: { x?: string; y?: string } })
        && ((labelAnchor as { reference: { x: string; y: string } }).reference.x === 'model'
          || (labelAnchor as { reference: { x: string; y: string } }).reference.y === 'model'))
      || hasLegacyOffset,
    );
    if (needsTarget && !(hasPart || hasPoint)) {
      errors.push({
        annotationId: id,
        field: 'target',
        reasonCode: 'missing_target',
        message: 'Target is required when referencing model.',
      });
      continue;
    }

    const mergedStyle = validateStyle(mergeStyle(defaults.style, annotation.style), warnings, id);
    const mergedVisibility = validateVisibility(
      mergeVisibility(defaults.visibility, annotation.visibility),
      warnings,
      id,
    );
    const worldScale = typeof annotation.worldScale === 'number' && Number.isFinite(annotation.worldScale)
      ? annotation.worldScale
      : 1;

    const anchoredTarget = (hasPart || hasPoint ? target : null) as AnnotationTarget | null;
    const anchoredLabelAnchor = annotation.labelAnchor as AnnotationLabelAnchor;

    annotations.push({
      id,
      label,
      truncatedLabel: truncated,
      mode: mode ?? 'screen',
      target: anchoredTarget,
      labelAnchor: anchoredLabelAnchor,
      worldScale,
      style: mergedStyle,
      visibility: mergedVisibility,
      enabled: annotation.enabled ?? true,
      contentId: annotation.contentId,
      content: annotation.content,
    });
  }

  return { annotations, warnings, errors };
};

export const normalizeAnnotationConfig = (config: AnnotationConfig): AnnotationValidationResult => {
  const warnings: AnnotationValidationIssue[] = [];
  const errors: AnnotationValidationIssue[] = [];

  if (!config || typeof config !== 'object') {
    return {
      value: null,
      warnings,
      errors: [
        {
          field: 'config',
          reasonCode: 'invalid_config',
          message: 'Annotation config is missing.',
        },
      ],
    };
  }

  if (!config.version || !/^\d+\.\d+\.\d+$/.test(config.version)) {
    errors.push({
      field: 'version',
      reasonCode: 'invalid_config',
      message: 'Version is required and must be semver (e.g., 1.0.0).',
    });
  }

  const defaults = config.defaults ?? DEFAULT_ANNOTATION_DEFAULTS;
  const normalized = normalizeAnnotationDefinitions({
    defaults,
    annotations: config.annotations,
    allowEmpty: false,
  });

  warnings.push(...normalized.warnings);
  errors.push(...normalized.errors);

  if (errors.length > 0) {
    return { value: null, warnings, errors };
  }

  return {
    value: {
      version: config.version,
      defaults,
      annotations: normalized.annotations,
    },
    warnings,
    errors,
  };
};
