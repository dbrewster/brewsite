import { describe, it, expect, vi } from 'vitest';
import renderer, { act } from 'react-test-renderer';
import { useEngineScrubber } from '../useEngineScrubber';

describe('useEngineScrubber', () => {
  it('tracks scrubbing state and forwards setProgress', () => {
    const scrollToProgress = vi.fn();
    let api: ReturnType<typeof useEngineScrubber> | undefined;

    const Test = () => {
      api = useEngineScrubber({
        scrollToProgress,
        getGlobalProgress: () => 0.3,
      });
      return null;
    };

    act(() => {
      renderer.create(<Test />);
    });
    if (!api) throw new Error('Hook did not initialize');
    expect(api.progress).toBe(0.3);
    expect(api.isScrubbing).toBe(false);

    act(() => api?.startScrub());
    if (!api) throw new Error('Hook did not update');
    expect(api.isScrubbing).toBe(true);

    act(() => api?.setProgress(0.6));
    expect(scrollToProgress).toHaveBeenCalledWith(0.6);

    act(() => api?.stopScrub());
    if (!api) throw new Error('Hook did not update');
    expect(api.isScrubbing).toBe(false);
  });
});
