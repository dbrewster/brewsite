import { createContext, useContext } from 'react';
import type { EngineFrameState } from './engineTypes';

export const EngineStateContext = createContext<EngineFrameState | null>(null);

// DEBT: Rename to useEngineStateContext or make private — conflicts with overloaded useEngineState in useEngineState.ts
export const useEngineState = (): EngineFrameState => {
  const state = useContext(EngineStateContext);
  if (!state) {
    throw new Error('[useEngineState] must be used inside <SceneEngine>');
  }
  return state;
};
