import { describe, it, expect } from 'vitest';
import { applySceneTransitions, computeSceneProgress, hexToRgb } from '../sceneUtils';
import type { SceneFrame } from '../sceneTrackTypes';
import type { SceneFrameContext, SceneTransition } from '../sceneTypes';

const baseState: SceneFrame = {
  id: 'scene',
  scrollProgress: 0,
  widgets: {},
};

const makeContext = (overrides: Partial<SceneFrameContext> = {}): SceneFrameContext => ({
  progress: 0,
  sceneProgress: 0,
  sceneProgressRaw: undefined,
  globalProgress: 0,
  sceneStart: 0,
  sceneEnd: 1,
  assetsReady: false,
  timeline: {} as SceneFrameContext['timeline'],
  ...overrides,
});

describe('sceneUtils', () => {
  it('computeSceneProgress handles zero-length ranges', () => {
    expect(computeSceneProgress(0.2, 0, 0)).toBe(1);
    expect(computeSceneProgress(-1, 0, 0)).toBe(0);
  });

  it('computeSceneProgress clamps progress within range', () => {
    expect(computeSceneProgress(0.5, 0, 1)).toBe(0.5);
    expect(computeSceneProgress(2, 0, 1)).toBe(1);
    expect(computeSceneProgress(-1, 0, 1)).toBe(0);
  });

  it('applySceneTransitions returns state when transitions are empty', () => {
    const ctx = makeContext({ progress: 0.3 });
    expect(applySceneTransitions(baseState, [], ctx)).toBe(baseState);
  });

  it('applySceneTransitions skips active transitions when progress is before start', () => {
    const ctx = makeContext({ progress: 0.1, globalProgress: 0.1 });
    const transitions: SceneTransition[] = [
      {
        id: 't1',
        start: 0.2,
        end: 0.4,
        apply: (state) => ({ ...state, id: 'updated' }),
      },
    ];
    const result = applySceneTransitions(baseState, transitions, ctx);
    expect(result.id).toBe('scene');
  });

  it('applySceneTransitions applies active transitions when progress is in range', () => {
    const ctx = makeContext({ progress: 0.3, globalProgress: 0.3 });
    const transitions: SceneTransition[] = [
      {
        id: 't2',
        start: 0.2,
        end: 0.4,
        apply: (state, _context, t) => ({ ...state, scrollProgress: t }),
      },
    ];
    const result = applySceneTransitions(baseState, transitions, ctx);
    expect(result.scrollProgress).toBeGreaterThan(0);
  });

  it('applySceneTransitions respects inherit phase and persist scope', () => {
    const ctx = makeContext({ progress: 0.3, sceneProgressRaw: 0.3, globalProgress: 0.3 });
    const transitions: SceneTransition[] = [
      {
        id: 'persist',
        start: 0.2,
        end: 0.4,
        scope: 'persist',
        apply: (state) => ({ ...state, id: 'persisted' }),
      },
      {
        id: 'skip',
        start: 0.5,
        end: 0.7,
        scope: 'active',
        apply: (state) => ({ ...state, id: 'skipped' }),
      },
    ];

    const result = applySceneTransitions(baseState, transitions, ctx, { phase: 'inherit' });
    expect(result.id).toBe('persisted');
  });

  it('applySceneTransitions resolves start/end functions and clamps inherit progress past end', () => {
    const ctx = makeContext({ progress: 0.9, sceneProgressRaw: 0.9, globalProgress: 0.9 });
    const transitions: SceneTransition[] = [
      {
        id: 'fn',
        start: () => 0.2,
        end: () => 0.4,
        apply: (state, _context, t) => ({ ...state, meta: { t } }),
      },
    ];
    const result = applySceneTransitions(baseState, transitions, ctx, { phase: 'inherit' });
    expect(result.meta?.t).toBe(1);
  });

  it('hexToRgb handles shorthand and invalid values', () => {
    expect(hexToRgb('#abc')).toBe('170 187 204');
    expect(hexToRgb('#aabbcc')).toBe('170 187 204');
    expect(hexToRgb('#abcd')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });
});
