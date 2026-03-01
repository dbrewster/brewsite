import { createContext, useContext } from 'react';
import type { UseSceneEngineResult } from './useSceneEngine';

export const EngineContext = createContext<UseSceneEngineResult | null>(null);

export const useSceneEngineContext = (): UseSceneEngineResult => {
  const engine = useContext(EngineContext);
  if (!engine) {
    throw new Error('[useSceneEngineContext] must be used inside <EngineProvider> or <ScenePlayer>');
  }
  return engine;
};
