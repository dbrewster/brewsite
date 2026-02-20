import type {AnnotationDefaults, AnnotationDefinition, AnnotationLabelAnchor,} from './types';
import {DEFAULT_ANNOTATION_DEFAULTS} from '../../annotations/annotationDefaults';
import type {ElementTransitionSpec, TransitionContext} from '../../runtime/compiler/transitions/transitionTypes';
import {
  blendDistance,
  blendNumber,
  blendOpacity,
  blendStyleValues,
  blendStyleValuesPartial,
  mergeCssOpacity,
  resolveEnabledByOpacity,
  resolveTransitionOpacity,
} from '../../runtime/compiler/transitions/transitionTypes';

// ============================================================================
// Annotation transitions spec
// ============================================================================

const resolveStyle = (style?: AnnotationDefinition['style']) => ({
  ...DEFAULT_ANNOTATION_DEFAULTS.style,
  ...(style ?? {}),
});

const resolveVisibility = (visibility?: AnnotationDefinition['visibility']) => ({
  ...DEFAULT_ANNOTATION_DEFAULTS.visibility,
  ...(visibility ?? {}),
});

const blendLabelAnchor = (
  from?: AnnotationLabelAnchor,
  to?: AnnotationLabelAnchor,
  t = 0,
  mode: 'out' | 'in' | 'across' = 'across',
): AnnotationLabelAnchor | undefined => {
  if (!from && !to) return undefined;
  if (mode === 'out') return from ?? to;
  if (mode === 'in') return to ?? from;
  if (from && to && 'labelOffset' in from && 'labelOffset' in to && from.labelOffset && to.labelOffset) {
    return {
      labelOffset: [
        from.labelOffset[0] + (to.labelOffset[0] - from.labelOffset[0]) * t,
        from.labelOffset[1] + (to.labelOffset[1] - from.labelOffset[1]) * t,
        from.labelOffset[2] + (to.labelOffset[2] - from.labelOffset[2]) * t,
      ],
    };
  }
  if (from && to && 'labelPosition' in from && 'labelPosition' in to && from.labelPosition && to.labelPosition) {
    return {
      labelPosition: [
        from.labelPosition[0] + (to.labelPosition[0] - from.labelPosition[0]) * t,
        from.labelPosition[1] + (to.labelPosition[1] - from.labelPosition[1]) * t,
        from.labelPosition[2] + (to.labelPosition[2] - from.labelPosition[2]) * t,
      ],
    };
  }
  if (from && to && 'reference' in from && 'reference' in to) {
    return t < 0.5 ? from : to;
  }
  return t < 0.5 ? (from ?? to) : (to ?? from);
};

const blendAnnotation = (
  from: AnnotationDefinition | undefined,
  to: AnnotationDefinition | undefined,
  t: number,
  mode: 'out' | 'in' | 'across',
): AnnotationDefinition => {
  const base = (to ?? from) as AnnotationDefinition;
  const fromStyle = resolveStyle(from?.style);
  const toStyle = resolveStyle(to?.style);
  const fromVisibility = resolveVisibility(from?.visibility);
  const toVisibility = resolveVisibility(to?.visibility);
  const cssOpacityFrom = resolveTransitionOpacity(fromStyle.css?.opacity as number | undefined, from?.enabled);
  const cssOpacityTo = resolveTransitionOpacity(toStyle.css?.opacity as number | undefined, to?.enabled);
  const containerOpacityFrom = resolveTransitionOpacity(fromStyle.containerCss?.opacity as number | undefined, from?.enabled);
  const containerOpacityTo = resolveTransitionOpacity(toStyle.containerCss?.opacity as number | undefined, to?.enabled);

  const styleAcross = blendStyleValuesPartial(fromStyle, toStyle, t);
  const lineOpacity = mode === 'out'
    ? blendOpacity(fromStyle.lineOpacity, 0, t)
    : mode === 'in'
      ? blendOpacity(0, toStyle.lineOpacity, t)
      : blendOpacity(fromStyle.lineOpacity, toStyle.lineOpacity, t);
  const labelOpacity = mode === 'out'
    ? blendOpacity(fromStyle.labelOpacity, 0, t)
    : mode === 'in'
      ? blendOpacity(0, toStyle.labelOpacity, t)
      : blendOpacity(fromStyle.labelOpacity, toStyle.labelOpacity, t);
  const backgroundOpacity = mode === 'out'
    ? blendOpacity(fromStyle.backgroundOpacity, 0, t)
    : mode === 'in'
      ? blendOpacity(0, toStyle.backgroundOpacity, t)
      : blendOpacity(fromStyle.backgroundOpacity, toStyle.backgroundOpacity, t);
  const cssOpacity = mode === 'out'
    ? blendOpacity(cssOpacityFrom, 0, t)
    : mode === 'in'
      ? blendOpacity(0, cssOpacityTo, t)
      : blendOpacity(cssOpacityFrom, cssOpacityTo, t);
  const containerOpacity = mode === 'out'
    ? blendOpacity(containerOpacityFrom, 0, t)
    : mode === 'in'
      ? blendOpacity(0, containerOpacityTo, t)
      : blendOpacity(containerOpacityFrom, containerOpacityTo, t);

  const baseStyle = mode === 'out'
    ? fromStyle
    : mode === 'in'
      ? toStyle
      : (t < 0.5 ? fromStyle : toStyle);
  const baseCss = baseStyle.css as Record<string, string | number> | undefined;
  const baseContainerCss = baseStyle.containerCss as Record<string, string | number> | undefined;
  const style = {
    ...baseStyle,
    ...(styleAcross ?? {}),
    lineOpacity,
    labelOpacity,
    backgroundOpacity,
    css: mergeCssOpacity(baseCss, cssOpacity),
    containerCss: mergeCssOpacity(baseContainerCss, containerOpacity),
  };
  const visibility = mode === 'out'
    ? {
      ...fromVisibility,
      isVisible: fromVisibility.isVisible && t < 1,
    }
    : mode === 'in'
      ? {
        ...toVisibility,
        isVisible: toVisibility.isVisible && t > 0,
      }
      : {
        isVisible: t < 0.5 ? fromVisibility.isVisible : toVisibility.isVisible,
        minDistance: blendNumber(fromVisibility.minDistance, toVisibility.minDistance, t) ?? toVisibility.minDistance,
        maxDistance: blendDistance(fromVisibility.maxDistance, toVisibility.maxDistance, t) ?? toVisibility.maxDistance,
      };

  const resolvedOpacity = cssOpacity ?? style.labelOpacity ?? style.lineOpacity ?? 1;
  return {
    ...base,
    labelAnchor: blendLabelAnchor(from?.labelAnchor, to?.labelAnchor, t, mode),
    style,
    visibility,
    enabled: resolveEnabledByOpacity(resolvedOpacity, base.enabled ?? true),
  };
};

export const annotationsTransitionSpec: ElementTransitionSpec<AnnotationDefinition[]> = {
  exit: (from: AnnotationDefinition[] | undefined, context: TransitionContext): AnnotationDefinition[] =>
    (from ?? []).map((item) => blendAnnotation(item, undefined, context.tExit, 'out')),
  enter: (to: AnnotationDefinition[] | undefined, context: TransitionContext): AnnotationDefinition[] =>
    (to ?? []).map((item) => blendAnnotation(undefined, item, context.tEnter, 'in')),
  interpolate: (from: AnnotationDefinition[] | undefined, to: AnnotationDefinition[] | undefined, context: TransitionContext): AnnotationDefinition[] => {
    const result: AnnotationDefinition[] = [];
    const byId = new Map<string, AnnotationDefinition>();
    for (const item of to ?? []) {
      byId.set(item.id, item);
    }
    for (const item of from ?? []) {
      const next = byId.get(item.id);
      if (next) {
        result.push(blendAnnotation(item, next, context.tFull, 'across'));
        byId.delete(item.id);
      } else {
        result.push(blendAnnotation(item, undefined, context.tExit, 'out'));
      }
    }
    for (const item of byId.values()) {
      result.push(blendAnnotation(undefined, item, context.tEnter, 'in'));
    }
    return result;
  },
};

// ============================================================================
// Annotation defaults transitions spec
// ============================================================================

const resolveDefaults = (defaults?: Partial<AnnotationDefaults>): AnnotationDefaults => ({
  style: {
    ...DEFAULT_ANNOTATION_DEFAULTS.style,
    ...(defaults?.style ?? {}),
  },
  visibility: {
    ...DEFAULT_ANNOTATION_DEFAULTS.visibility,
    ...(defaults?.visibility ?? {}),
  },
});

const blendVisibility = (
  from: AnnotationDefaults['visibility'],
  to: AnnotationDefaults['visibility'],
  t: number,
) => ({
  isVisible: t < 0.5 ? from.isVisible : to.isVisible,
  minDistance: blendNumber(from.minDistance, to.minDistance, t) ?? to.minDistance,
  maxDistance: blendDistance(from.maxDistance, to.maxDistance, t) ?? to.maxDistance,
});

// exit and enter deliberately return defaults unchanged (blending a value with itself is a no-op).
// Annotation defaults are global scene settings; they do not animate in/out independently —
// only the per-annotation items (annotationsTransitionSpec) carry opacity transitions.
export const annotationDefaultsTransitionSpec: ElementTransitionSpec<Partial<AnnotationDefaults> | undefined> = {
  exit: (from: Partial<AnnotationDefaults> | undefined, _context: TransitionContext): Partial<AnnotationDefaults> | undefined => {
    const resolved = resolveDefaults(from);
    return {
      style: resolved.style,
      visibility: resolved.visibility,
    };
  },
  enter: (to: Partial<AnnotationDefaults> | undefined, _context: TransitionContext): Partial<AnnotationDefaults> | undefined => {
    const resolved = resolveDefaults(to);
    return {
      style: resolved.style,
      visibility: resolved.visibility,
    };
  },
  interpolate: (from: Partial<AnnotationDefaults> | undefined, to: Partial<AnnotationDefaults> | undefined, context: TransitionContext): Partial<AnnotationDefaults> | undefined => {
    const resolvedFrom = resolveDefaults(from);
    const resolvedTo = resolveDefaults(to);
    return {
      style: blendStyleValues(resolvedFrom.style, resolvedTo.style, context.tFull) ?? resolvedTo.style,
      visibility: blendVisibility(resolvedFrom.visibility, resolvedTo.visibility, context.tFull),
    };
  },
};

// compileAnnotations was moved to src/robot/runtime/compiler/annotationCompiler.ts.
// It requires SceneFrameState (a compiler-layer type) and belongs in the compiler layer,
// not inside the element module.
