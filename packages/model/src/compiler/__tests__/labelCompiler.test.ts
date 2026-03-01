import { describe, it, expect } from 'vitest';
import { compileLabels } from '../labelCompiler';
import type { LabelCompileContext } from '../labelCompiler';

const ctx = { sceneProgress: 0 } as LabelCompileContext;

describe('compileLabels', () => {
  it('filters out disabled labels', () => {
    const labels = [
      { id: 'a', text: 'A', targetPartId: 'head', enabled: true },
      { id: 'b', text: 'B', targetPartId: 'head', enabled: false },
      { id: 'c', text: 'C', targetPartId: 'head' },
    ];
    const result = compileLabels(labels, undefined, ctx);
    expect(result.map((l) => l.id)).toEqual(['a', 'c']);
  });

  it('interpolates offsets and opacities when label exists in both', () => {
    const from = [{
      id: 'a',
      text: 'A',
      targetPartId: 'head',
      labelOffset: [0, 0, 0],
      style: { labelOpacity: 0.2, lineOpacity: 0.6 },
    }];
    const to = [{
      id: 'a',
      text: 'A',
      targetPartId: 'head',
      labelOffset: [10, 0, 0],
      style: { labelOpacity: 1, lineOpacity: 0.2 },
    }];
    const result = compileLabels(from, to, { sceneProgress: 0.5 });
    expect(result[0]?.labelOffset?.[0]).toBeCloseTo(5);
    expect(result[0]?.style?.labelOpacity).toBeCloseTo(0.6);
    expect(result[0]?.style?.lineOpacity).toBeCloseTo(0.4);
  });

  it('fades out labels missing in next scene', () => {
    const from = [{
      id: 'fade',
      text: 'F',
      targetPartId: 'head',
      style: { labelOpacity: 0.5, lineOpacity: 0.5 },
    }];
    const result = compileLabels(from, [], { sceneProgress: 1 });
    expect(result.length).toBe(0);
  });

  it('fades in labels missing in previous scene', () => {
    const to = [{
      id: 'fade-in',
      text: 'F',
      targetPartId: 'head',
      style: { labelOpacity: 0.6, lineOpacity: 0.2 },
    }];
    const result = compileLabels([], to, { sceneProgress: 0.5 });
    expect(result[0]?.style?.labelOpacity).toBeCloseTo(0.3);
    expect(result[0]?.style?.lineOpacity).toBeCloseTo(0.1);
  });

  it('returns empty when all labels are disabled', () => {
    const from = [{ id: 'a', text: 'A', targetPartId: 'head', enabled: false }];
    const to = [{ id: 'b', text: 'B', targetPartId: 'head', enabled: false }];
    const result = compileLabels(from, to, { sceneProgress: 0.5 });
    expect(result).toEqual([]);
  });
});
