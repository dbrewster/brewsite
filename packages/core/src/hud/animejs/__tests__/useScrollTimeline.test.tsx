// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';

// ── AnimeJS mock ──────────────────────────────────────────────────────────────
const seekFn = vi.fn();
vi.mock('animejs', () => ({
  default: {
    timeline: vi.fn(() => ({
      add: vi.fn().mockReturnThis(),
      seek: seekFn,
    })),
  },
}));

// ── Real EngineStateContext — no mock ─────────────────────────────────────────
import { EngineStateContext } from '../../../player/EngineStateContext';

const engineState = (sceneProgress: number) => ({
  progress: sceneProgress,
  sceneId: 'test',
  sceneIndex: 0,
  sceneProgress,
});

// ── Subject ───────────────────────────────────────────────────────────────────
import { useScrollTimeline } from '../useScrollTimeline';

const TestComponent = ({ duration }: { duration: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  useScrollTimeline(
    ref,
    (_target) => ({ add: vi.fn().mockReturnThis(), seek: seekFn } as never),
    duration,
    [duration] as const,
  );
  return <div ref={ref} />;
};

const wrap = (sceneProgress: number, duration: number) => (
  <EngineStateContext.Provider value={engineState(sceneProgress)}>
    <TestComponent duration={duration} />
  </EngineStateContext.Provider>
);

describe('useScrollTimeline', () => {
  beforeEach(() => seekFn.mockClear());

  it('seeks to 0 on mount when sceneProgress is 0', () => {
    render(wrap(0, 1000));
    expect(seekFn).toHaveBeenCalledWith(0);
  });

  it('seeks to totalDuration when sceneProgress is 1', () => {
    render(wrap(1, 1000));
    expect(seekFn).toHaveBeenCalledWith(1000);
  });

  it('seeks to sceneProgress * totalDuration on context update', () => {
    const { rerender } = render(wrap(0, 800));
    seekFn.mockClear();
    act(() => { rerender(wrap(0.5, 800)); });
    expect(seekFn).toHaveBeenCalledWith(400);
  });

  it('rebuilds and re-seeks when totalDuration changes', () => {
    const { rerender } = render(wrap(0, 500));
    const before = seekFn.mock.calls.length;
    act(() => { rerender(wrap(0, 1000)); });
    expect(seekFn.mock.calls.length).toBeGreaterThan(before);
  });
});
