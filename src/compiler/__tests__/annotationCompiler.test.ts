import { describe, it, expect } from 'vitest';
import { compileAnnotations } from '../annotationCompiler';
import type { SceneFrame } from '../sceneTrackTypes';
import type { AnnotationDefinition } from '../../annotations/annotationTypes';

const makeFrame = (annotations?: AnnotationDefinition[]): SceneFrame => ({
  id: 'scene',
  scrollProgress: 0,
  widgets: {},
  annotations,
});

describe('compileAnnotations', () => {
  it('uses base annotations when state annotations are undefined', () => {
    const base = makeFrame([{ id: 'a', label: 'A', placement: { mode: 'fixed', reference: { x: 'left', y: 'top' }, offset: { xPct: 0, yPct: 0 } } }]);
    const state = makeFrame(undefined);
    const result = compileAnnotations(state, base);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns empty when state annotations are empty', () => {
    const base = makeFrame([{ id: 'a', label: 'A', placement: { mode: 'fixed', reference: { x: 'left', y: 'top' }, offset: { xPct: 0, yPct: 0 } } }]);
    const state = makeFrame([]);
    const result = compileAnnotations(state, base);
    expect(result).toEqual([]);
  });

  it('uses state annotations when it has a full definition', () => {
    const base = makeFrame([{ id: 'base', label: 'Base', placement: { mode: 'fixed', reference: { x: 'left', y: 'top' }, offset: { xPct: 0, yPct: 0 } } }]);
    const state = makeFrame([{ id: 'state', label: 'State', placement: { mode: 'fixed', reference: { x: 'right', y: 'bottom' }, offset: { xPct: 0, yPct: 0 } } }]);
    const result = compileAnnotations(state, base);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('state');
  });

  it('merges base annotations when state definitions are partial', () => {
    const base = makeFrame([{ id: 'base', label: 'Base', placement: { mode: 'fixed', reference: { x: 'left', y: 'top' }, offset: { xPct: 0, yPct: 0 } } }]);
    const state = makeFrame([{ id: 'partial', label: '', placement: { mode: 'fixed', reference: { x: 'left', y: 'top' }, offset: { xPct: 0, yPct: 0 } } }]);
    const result = compileAnnotations(state, base);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual(['base', 'partial']);
  });
});
