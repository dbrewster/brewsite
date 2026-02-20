import { describe, it, expect } from 'vitest';
import { compileLabels } from '../labelCompiler';
import type { LabelDefinition } from '../../labels/types';
import type { SceneFrameContext } from '../sceneTypes';

const ctx = {} as SceneFrameContext;

describe('compileLabels', () => {
  it('filters out disabled labels', () => {
    const labels: LabelDefinition[] = [
      { id: 'a', text: 'A', targetPartId: 'head', enabled: true },
      { id: 'b', text: 'B', targetPartId: 'head', enabled: false },
      { id: 'c', text: 'C', targetPartId: 'head' },
    ];
    const result = compileLabels(labels, ctx);
    expect(result.map((l) => l.id)).toEqual(['a', 'c']);
  });
});
