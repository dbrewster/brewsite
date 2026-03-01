// Global registry hook — reads live engine state from anywhere in the React tree.
// Does not require an EngineProvider ancestor. Updates on every frame tick.

import { useSyncExternalStore } from 'react';
import {
  getEngineSnapshot,
  subscribeEngineSnapshot,
  type SceneEngineSnapshot,
} from './ScenePlayerRegistry';

/**
 * Returns live engine state for a <ScenePlayer> or <EngineProvider> identified
 * by the given id prop. Works from anywhere in the React tree — the component
 * calling this hook does not need to be a descendant of the engine.
 *
 * Returns null if no engine with the given id is currently mounted.
 *
 * Updates on every frame tick (via useSyncExternalStore). For performance-sensitive
 * components that only need scene identity (not per-frame progress), use
 * useCurrentSceneExternal(id) instead (future work).
 *
 * @example
 * function DocsSidebar() {
 *   const state = useSceneEngineState('docs');
 *   if (!state) return null;
 *   return <nav data-active={state.sceneId}>...</nav>;
 * }
 */
export function useSceneEngineState(id: string): SceneEngineSnapshot | null {
  // getEngineSnapshot returns null when the id is not in the registry, so the
  // | null return type is honest. Consumers can reliably write:
  //   const state = useSceneEngineState('docs');
  //   if (!state) return null; // engine not yet mounted
  return useSyncExternalStore(
    (onStoreChange) => subscribeEngineSnapshot(id, onStoreChange),
    () => getEngineSnapshot(id),   // null when not mounted
    () => null,                    // server: always null (no engine on server)
  );
}
