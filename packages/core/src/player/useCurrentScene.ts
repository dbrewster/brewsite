import { useEngineState } from './EngineStateContext';

export const useCurrentScene = (): { id: string; index: number } => {
  const state = useEngineState();
  return { id: state.sceneId, index: state.sceneIndex };
};
