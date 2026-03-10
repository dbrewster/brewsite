// useEngineScrubber.ts — Engine scrubber hook for progress control via pointer drag.
// Reads engine context directly; no external callbacks required.

import { useCallback, useState } from 'react';
import { useSceneEngineContext } from './EngineContext';

export type UseEngineScrubberResult = {
  isScrubbing: boolean;
  startScrub: () => void;
  stopScrub: () => void;
  /** Calls engine.setProgress() clamped to [0, 1]. */
  setProgress: (next: number) => void;
};

/**
 * Provides scrubbing state and a setProgress function wired to the nearest
 * SceneEngine context. Must be called inside a <SceneEngine> tree.
 *
 * In v2, the options object has been removed. The hook reads the engine context
 * directly. See MIGRATION.md for the v1 → v2 upgrade path.
 */
export function useEngineScrubber(): UseEngineScrubberResult {
  const engine = useSceneEngineContext();
  const [isScrubbing, setIsScrubbing] = useState(false);

  const startScrub = useCallback(() => setIsScrubbing(true), []);
  const stopScrub = useCallback(() => setIsScrubbing(false), []);

  const setProgress = useCallback(
    (next: number) => {
      engine.setProgress(Math.max(0, Math.min(1, next)));
    },
    [engine],
  );

  return { isScrubbing, startScrub, stopScrub, setProgress };
}
