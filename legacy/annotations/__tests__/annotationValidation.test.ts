import {describe, expect, it} from 'vitest';
import {DEFAULT_ANNOTATION_DEFAULTS} from '../annotationDefaults';
import {normalizeAnnotationDefinitions} from '../annotationValidation';

describe('annotationValidation', () => {
  it('truncates long labels and applies defaults', () => {
    const result = normalizeAnnotationDefinitions({
      defaults: DEFAULT_ANNOTATION_DEFAULTS,
      annotations: [
        {
          id: 'a1',
          label: 'x'.repeat(90),
          mode: 'screen',
          target: { targetPoint: [0, 0, 0] },
          labelAnchor: {
            reference: { x: 'center', y: 'center' },
            offset: { xPct: 0, yPct: 0 },
          },
        },
      ],
    });

    expect(result.errors.length).toBe(0);
    expect(result.annotations[0]?.truncatedLabel.length).toBeLessThanOrEqual(80);
    expect(result.annotations[0]?.style.fontFamily).toBe('Space Grotesk');
  });

  it('flags invalid target definitions', () => {
    const result = normalizeAnnotationDefinitions({
      defaults: DEFAULT_ANNOTATION_DEFAULTS,
      annotations: [
        {
          id: 'a2',
          label: 'Bad target',
          mode: 'screen',
          // @ts-expect-error invalid target
          target: { targetPartId: 'head', targetPoint: [0, 0, 0] },
          labelAnchor: {
            reference: { x: 'center', y: 'center' },
            offset: { xPct: 0, yPct: 0 },
          },
        },
      ],
    });

    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('merges duplicate ids into a single annotation', () => {
    const result = normalizeAnnotationDefinitions({
      defaults: DEFAULT_ANNOTATION_DEFAULTS,
      annotations: [
        {
          id: 'merge-1',
          label: 'Base label',
          mode: 'screen',
          target: { targetPoint: [0, 0, 0] },
          labelAnchor: {
            reference: { x: 'center', y: 'center' },
            offset: { xPct: 0, yPct: 0 },
          },
          style: {
            lineOpacity: 0.2,
          },
        },
        {
          id: 'merge-1',
          style: {
            lineOpacity: 0.9,
            lineThickness: 0.4,
          },
          visibility: {
            minDistance: 4,
          },
        },
      ],
    });

    expect(result.errors.length).toBe(0);
    expect(result.annotations.length).toBe(1);
    expect(result.annotations[0]?.label).toBe('Base label');
    expect(result.annotations[0]?.style.lineOpacity).toBe(0.9);
    expect(result.annotations[0]?.style.lineThickness).toBe(0.4);
    expect(result.annotations[0]?.visibility.minDistance).toBe(4);
  });
});
