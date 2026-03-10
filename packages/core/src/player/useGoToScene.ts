// useGoToScene.ts — Programmatic scene navigation hook with optional scroll source sync.

import { useCallback, useContext } from 'react';
import { useSceneEngineContext } from './EngineContext';
import { ScrollNavigatorContext } from './ScrollNavigatorContext';

/**
 * Returns a stable function for programmatic scene navigation.
 *
 * In scroll mode (ScrollInput source='window'), syncs window.scrollY via
 * ScrollNavigatorContext so the scroll position stays in sync with the engine.
 *
 * In all other modes (inertia, keyboard, controlled, time), calls
 * engine.setProgress() directly.
 *
 * @param idOrIndex  Scene id string or zero-based numeric index.
 */
export function useGoToScene(): (idOrIndex: string | number) => void {
  const engine = useSceneEngineContext();
  const scrollNavigator = useContext(ScrollNavigatorContext);

  return useCallback(
    (idOrIndex: string | number) => {
      let targetIndex: number;

      if (typeof idOrIndex === 'string') {
        const scene = engine.compiledScenes.find((s) => s.id === idOrIndex);
        if (!scene) {
          console.warn(`[useGoToScene] Scene "${idOrIndex}" not found in compiled scenes.`);
          return;
        }
        targetIndex = scene.index;
      } else {
        targetIndex = idOrIndex;
      }

      const targetProgress =
        engine.sceneCount > 1
          ? Math.max(0, Math.min(1, targetIndex / (engine.sceneCount - 1)))
          : 0;

      if (scrollNavigator?.scrollTo && engine.progressMapper) {
        // Scroll mode with mapper: invert to raw scroll space then scroll
        const rawProgress = engine.progressMapper.inverse(targetProgress);
        scrollNavigator.scrollTo(rawProgress);
      } else if (scrollNavigator?.scrollTo) {
        // Scroll mode without mapper: progress == raw
        scrollNavigator.scrollTo(targetProgress);
      } else {
        // Direct/inertia/controlled mode: write engine progress directly
        engine.setProgress(targetProgress);
      }
    },
    [engine, scrollNavigator],
  );
}
