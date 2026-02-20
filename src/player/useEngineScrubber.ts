import { useCallback, useState } from 'react';

export type UseEngineScrubberOptions = {
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
};

export type UseEngineScrubberResult = {
  progress: number;
  isScrubbing: boolean;
  startScrub: () => void;
  stopScrub: () => void;
  setProgress: (next: number) => void;
};

export const useEngineScrubber = (options: UseEngineScrubberOptions): UseEngineScrubberResult => {
  const { scrollToProgress, getGlobalProgress } = options;
  const [isScrubbing, setIsScrubbing] = useState(false);

  const startScrub = useCallback(() => setIsScrubbing(true), []);
  const stopScrub = useCallback(() => setIsScrubbing(false), []);
  const setProgress = useCallback((next: number) => scrollToProgress(next), [scrollToProgress]);

  return {
    progress: getGlobalProgress(),
    isScrubbing,
    startScrub,
    stopScrub,
    setProgress,
  };
};
