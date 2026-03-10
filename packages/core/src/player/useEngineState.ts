// useEngineState.ts — Unified hook replacing useEngineState() and useSceneEngineState(id).

import { useContext } from 'react';
import { useSyncExternalStore } from 'react';
import { EngineStateContext } from './EngineStateContext';
import {
  getEngineSnapshot,
  subscribeEngineSnapshot,
  type SceneEngineSnapshot,
} from './ScenePlayerRegistry';
import type { EngineFrameState } from './engineTypes';

/**
 * Returns live engine state.
 *
 * Without id: reads from the nearest ancestor SceneEngine context.
 *             Throws if not inside a SceneEngine.
 *             Updates on every frame tick.
 *
 * With id:    reads from the global registry.
 *             Returns null when the engine with that id is not mounted.
 *             Works from anywhere in the React tree (no ancestor requirement).
 *             Updates on every frame tick via useSyncExternalStore.
 */
export function useEngineState(): EngineFrameState;
export function useEngineState(id: string): SceneEngineSnapshot | null;
export function useEngineState(
  id?: string,
): EngineFrameState | SceneEngineSnapshot | null {
  const localState = useContext(EngineStateContext);

  const globalState = useSyncExternalStore(
    id
      ? (cb) => subscribeEngineSnapshot(id, cb)
      : () => () => { /* no-op unsubscribe when no id */ },
    id ? () => getEngineSnapshot(id) : () => null,
    () => null,
  );

  if (id !== undefined) {
    return globalState;
  }

  if (!localState) {
    throw new Error(
      '[useEngineState] must be called inside a <SceneEngine> when no id is provided.',
    );
  }

  return localState;
}
