import { useEngineState } from './EngineStateContext';

/**
 * Returns the current scene's local progress [0, 1] — equivalent to blockProgress
 * for the active scene. Use this for in-scene animations (fades, reveals, etc.)
 * that should be keyed to how far through the current scene the user is.
 *
 * For global progress across all scenes use useEngineState().progress instead.
 */
export const useSceneProgress = (): number => {
  const state = useEngineState();
  return state.sceneProgress;
};
