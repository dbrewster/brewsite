import { useEngineStateContext } from './EngineStateContext';

export const useCurrentScene = (): { id: string; index: number } => {
  const state = useEngineStateContext();
  return { id: state.sceneId, index: state.sceneIndex };
};
