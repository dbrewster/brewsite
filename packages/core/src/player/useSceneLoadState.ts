// Hook for reading per-scene loading state from RuntimeDriverImpl.

import { createContext, useContext, useSyncExternalStore } from 'react';
import type { RuntimeDriverImpl } from '../runtime/RuntimeDriver';

// ─── Context ─────────────────────────────────────────────────────────────────

/** Context value carrying a reference to the RuntimeDriverImpl for scene load state. */
export type SceneLoadStateContextValue = {
  driver: RuntimeDriverImpl | null;
};

/** @internal Provided by SceneEngine when loadPolicy is set. */
export const SceneLoadStateContext = createContext<SceneLoadStateContextValue>({
  driver: null,
});

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Per-scene loading status returned by useSceneLoadState(). */
export type SceneLoadState = {
  /** Set of scene indices whose assets are fully loaded. */
  loadedScenes: ReadonlySet<number>;
  /** Set of scene indices currently loading. */
  loadingScenes: ReadonlySet<number>;
};

const EMPTY_STATE: SceneLoadState = {
  loadedScenes: new Set(),
  loadingScenes: new Set(),
};

/**
 * Returns per-scene loading status for the nearest SceneEngine.
 *
 * Only meaningful when the engine has a `loadPolicy` configured.
 * When no loadPolicy is set, returns empty sets (all loading is upfront).
 *
 * Uses useSyncExternalStore for tear-free reads.
 */
export function useSceneLoadState(): SceneLoadState {
  const { driver } = useContext(SceneLoadStateContext);

  const subscribe = (onStoreChange: () => void): (() => void) => {
    if (!driver) return () => {};
    return driver.subscribeSceneLoadState(onStoreChange);
  };

  const getSnapshot = (): SceneLoadState => {
    if (!driver) return EMPTY_STATE;
    return driver.getSceneLoadState();
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_STATE);
}
