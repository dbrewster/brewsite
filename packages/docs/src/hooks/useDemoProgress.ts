// Hook for reading demo engine progress from the global registry.

import { useSceneEngineState } from '@brewsite/core';

/**
 * Reads the current engine progress for a named demo.
 *
 * Only useful when the DemoEngine was given an explicit `id` prop.
 * For most demos, progress is driven by wheel capture and need not be observed externally.
 *
 * Returns null if the engine is not mounted or the id is not registered.
 */
export function useDemoProgress(engineId: string): number | null {
  const state = useSceneEngineState(engineId);
  return state?.progress ?? null;
}
