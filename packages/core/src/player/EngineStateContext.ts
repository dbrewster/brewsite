import { createContext, useContext } from 'react';
import type { EngineState } from './engineTypes';

export const EngineStateContext = createContext<EngineState | null>(null);

// DEBT: Rename to useEngineStateContext or make private — conflicts with overloaded useEngineState in useEngineState.ts
export const useEngineState = (): EngineState => {
  const state = useContext(EngineStateContext);
  if (!state) {
    throw new Error('[useEngineState] must be used inside <SceneEngine>');
  }
  return state;
};
