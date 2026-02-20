import { useCallback, useContext } from 'react';
import { useSyncExternalStore } from 'react';
import { VariableStoreContext } from './VariableStoreContext';
import type { JsonPrimitive } from './VariableStore';

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
