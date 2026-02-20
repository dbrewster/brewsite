import { useEngineState } from './EngineStateContext';

export const useSceneProgress = (): number => {
  const state = useEngineState();
  return state.progress;
};
