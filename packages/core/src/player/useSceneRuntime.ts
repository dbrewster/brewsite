import { useEffect, useSyncExternalStore } from 'react';
import {
  getSceneRuntimeState,
  hasRegisteredPlayer,
  subscribeSceneRuntime,
  type SceneRuntimeState,
} from './ScenePlayerRegistry';

export const useSceneRuntime = (playerId: string): SceneRuntimeState => {
  useEffect(() => {
    // process.env.NODE_ENV is replaced at build time by bundlers (Vite, webpack),
    // allowing this entire block to be dead-code-eliminated in production bundles.
    if (process.env.NODE_ENV === 'production') return undefined;
    const timer = setTimeout(() => {
      if (!hasRegisteredPlayer(playerId)) {
        console.warn(
          `[useSceneRuntime] No <ScenePlayer id="${playerId}"> was found after component mount. ` +
          `Check that the target ScenePlayer has id="${playerId}" and is mounted in the tree.`,
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
