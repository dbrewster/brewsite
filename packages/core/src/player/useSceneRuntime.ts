import { useEffect, useSyncExternalStore } from 'react';
import {
  getSceneRuntimeState,
  hasRegisteredPlayer,
  subscribeSceneRuntime,
  type SceneRuntimeState,
} from './ScenePlayerRegistry';

/**
 * @deprecated No known consumers in current packages or apps.
 * This export will be removed in a future version.
 */
export const useSceneRuntime = (playerId: string): SceneRuntimeState => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasRegisteredPlayer(playerId)) {
        console.warn(
          `[useSceneRuntime] No <SceneEngine id="${playerId}"> was found after component mount. ` +
          `Check that the target SceneEngine has id="${playerId}" and is mounted in the tree.`,
        );
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [playerId]);

  return useSyncExternalStore(
    (onStoreChange) => subscribeSceneRuntime(playerId, onStoreChange),
    () => getSceneRuntimeState(playerId),
    () => ({
      assetsReady: false,
      viewport: { width: 1, height: 1, aspectRatio: 1 },
      variables: undefined,
      numScenes: 0,
    }),
  );
};
