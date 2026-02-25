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
});
