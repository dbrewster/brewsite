// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDiagramFocusRegion,
  getDiagramFocusRegion,
  publishDiagramFocusCanvas,
  publishDiagramFocusGroup,
} from '../focusRegion';
import { useDiagramFocusRegion } from '../useDiagramFocusRegion';

describe('useDiagramFocusRegion', () => {
  beforeEach(() => {
    clearDiagramFocusRegion();
  });

  it('returns latest focused group region', () => {
    publishDiagramFocusGroup({ id: 'system-canvas' }, 'system-arch', 'api-layer');

    const { result } = renderHook(() => useDiagramFocusRegion());
    expect(result.current).toMatchObject({
      kind: 'group',
      canvasId: 'system-canvas',
      diagramId: 'system-arch',
      groupId: 'api-layer',
    });
    expect(result.current?.focusedAt).toBeTypeOf('number');
  });

  it('filters by canvas id', () => {
    const { result } = renderHook(() => useDiagramFocusRegion({ canvasId: 'target-canvas' }));
    expect(result.current).toBeNull();

    act(() => {
      publishDiagramFocusGroup({ id: 'other-canvas' }, 'arch', 'g1');
    });
    expect(result.current).toBeNull();

    act(() => {
      publishDiagramFocusCanvas({ id: 'target-canvas' });
    });
    expect(result.current).toMatchObject({
      kind: 'canvas',
      canvasId: 'target-canvas',
      diagramId: null,
      groupId: null,
    });
  });

  it('clears focus state', () => {
    publishDiagramFocusCanvas({ id: 'system-canvas' });
    expect(getDiagramFocusRegion()).not.toBeNull();

    act(() => {
      clearDiagramFocusRegion('system-canvas');
    });
    expect(getDiagramFocusRegion()).toBeNull();
  });
});
