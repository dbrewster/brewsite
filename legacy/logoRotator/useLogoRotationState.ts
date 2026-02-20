import {useEffect, useState} from 'react';
import type {LogoRotationRuntime, LogoRotationState} from './LogoRotationRuntime';

const emptyState: LogoRotationState = {
  id: '',
  nextId: '',
  progress: 0,
  elapsedMs: 0,
  displayId: '',
  label: '',
  url: '',
  palette: undefined,
};

export const useLogoRotationState = (runtime: LogoRotationRuntime | null): LogoRotationState => {
  const [state, setState] = useState<LogoRotationState>(() => runtime?.getState() ?? emptyState);

  useEffect(() => {
    if (!runtime) {
      setState(emptyState);
      return;
    }
    setState(runtime.getState());
    return runtime.subscribe((next) => {
      setState(next);
    });
  }, [runtime]);

  return state;
};
