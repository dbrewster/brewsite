// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEngineScrubber } from '../useEngineScrubber';

describe('useEngineScrubber', () => {
  it('tracks scrubbing state and forwards setProgress', () => {
    const scrollToProgress = vi.fn();

    const { result } = renderHook(() => useEngineScrubber({
      scrollToProgress,
      getGlobalProgress: () => 0.3,
    }));

    expect(result.current.progress).toBe(0.3);
    expect(result.current.isScrubbing).toBe(false);

    act(() => result.current.startScrub());
    expect(result.current.isScrubbing).toBe(true);

    act(() => result.current.setProgress(0.6));
    expect(scrollToProgress).toHaveBeenCalledWith(0.6);

    act(() => result.current.stopScrub());
    expect(result.current.isScrubbing).toBe(false);
  });
});
