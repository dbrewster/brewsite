import { useCallback, useContext } from 'react';
import { useSyncExternalStore } from 'react';
import { VariableStoreContext } from './VariableStoreContext';
import type { JsonPrimitive } from './VariableStore';

/**
 * React hook for reading a reactive variable from the VariableStore.
 * Re-renders the consuming component whenever the named variable changes.
 *
 * Must be used inside a `<ScenePlayer>` tree (which provides `VariableStoreContext`).
 *
 * @example
 * // Read the current scene title published by SceneMetaWidget:
 * const title = useVariable<string>('__scene_meta__', 'title');
 *
 * // Read a variable published by a custom IVariableProvider widget:
 * const speed = useVariable<number>('myAnimWidget', 'speed');
 */
export const useVariable = <T extends JsonPrimitive = JsonPrimitive>(
  namespace: string, key: string,
): T | undefined => {
  const store = useContext(VariableStoreContext);
  if (!store) throw new Error('[useVariable] must be used inside <ScenePlayer>');

  const subscribe = useCallback(
    (callback: () => void) => store.subscribe(`${namespace}.${key}`, callback),
    [store, namespace, key],
  );

  const getSnapshot = useCallback(
    () => store.get(namespace, key) as T | undefined,
    [store, namespace, key],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
