/**
 * useSceneCompilerState — thin React observer for a SceneCompiler instance.
 *
 * Subscribes to the compiler's state changes and re-renders when the phase
 * transitions. The compiler instance must be stable (e.g. from useRef).
 */
import {useEffect, useState} from 'react';
import type {SceneCompiler, SceneCompilerState} from './SceneCompiler';

export const useSceneCompilerState = (compiler: SceneCompiler): SceneCompilerState => {
  const [state, setState] = useState<SceneCompilerState>(() => compiler.getState());

  useEffect(() => {
    // Sync in case state changed between render and effect
    setState(compiler.getState());
    return compiler.subscribe((next) => setState(next));
  }, [compiler]);

  return state;
};
