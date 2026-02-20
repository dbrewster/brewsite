import {describe, expect, it} from 'vitest';
import type {AnnotationDefaults, AnnotationStyle, AnnotationVisibility} from '../../../annotations/annotationTypes';
import {DEFAULT_ANNOTATION_DEFAULTS} from '../../../annotations/annotationDefaults';
import {annotationDefaultsTransitionSpec} from '../transitions/annotationDefaultsTransitions';
import {buildContext, expectNumberClose} from './transitionTestUtils';

type AnnotationDefaultsOverrides = {
  style?: Partial<AnnotationStyle>;
  visibility?: Partial<AnnotationVisibility>;
};

const withDefaults = (overrides: AnnotationDefaultsOverrides): AnnotationDefaults => ({
  style: { ...DEFAULT_ANNOTATION_DEFAULTS.style, ...(overrides.style ?? {}) },
  visibility: { ...DEFAULT_ANNOTATION_DEFAULTS.visibility, ...(overrides.visibility ?? {}) },
});

describe('annotation defaults transitions', () => {
  it('blends default style and visibility across', () => {
    const from = withDefaults({
      style: { labelOpacity: 0, lineOpacity: 0.2 },
      visibility: { isVisible: false, minDistance: 0, maxDistance: 10 },
    });
    const to = withDefaults({
      style: { labelOpacity: 1, lineOpacity: 0.8 },
      visibility: { isVisible: true, minDistance: 10, maxDistance: 30 },
    });
    const result = annotationDefaultsTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 })) as AnnotationDefaults;
    expectNumberClose(result.style?.labelOpacity, 0.5);
    expectNumberClose(result.style?.lineOpacity, 0.5);
    expectNumberClose(result.visibility?.minDistance, 5);
    expectNumberClose(result.visibility?.maxDistance, 20);
    expect(result.visibility?.isVisible).toBe(true);
  });

  it('keeps defaults stable on transition out', () => {
    const from = withDefaults({
      style: { labelOpacity: 0.3 },
      visibility: { isVisible: true, minDistance: 2, maxDistance: 4 },
    });
    const result = annotationDefaultsTransitionSpec.exit(from, buildContext({ tExit: 0.5 })) as AnnotationDefaults;
    expectNumberClose(result.style?.labelOpacity, 0.3);
    expectNumberClose(result.visibility?.minDistance, 2);
  });

  it('keeps defaults stable on transition in', () => {
    const to = withDefaults({
      style: { labelOpacity: 0.7 },
      visibility: { isVisible: true, minDistance: 3, maxDistance: 5 },
    });
    const result = annotationDefaultsTransitionSpec.enter(to, buildContext({ tEnter: 0.5 })) as AnnotationDefaults;
    expectNumberClose(result.style?.labelOpacity, 0.7);
    expectNumberClose(result.visibility?.minDistance, 3);
  });
});
