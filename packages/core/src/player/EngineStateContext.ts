import { createContext, useContext } from 'react';
import type { EngineFrameState } from './engineTypes';

export const EngineStateContext = createContext<EngineFrameState | null>(null);

export const useEngineStateContext = (): EngineFrameState => {
  const state = useContext(EngineStateContext);
  if (!state) {
    throw new Error('[useEngineStateContext] must be used inside <SceneEngine>');
  }
  return state;
};
