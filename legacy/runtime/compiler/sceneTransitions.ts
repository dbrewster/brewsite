import type {SceneFrameContext, SceneTransition} from './sceneTypes';
import type {AutoTransitionProps} from './primitives';
import {applySceneTransition, buildTransitionContext} from './transitions/sceneTransitionCoordinator';

export const createAutoTransitionTransition = (props: AutoTransitionProps, context: SceneFrameContext): SceneTransition => {
  const exitStart = props.exitStart ?? 0.2;
  const exitEnd = props.exitEnd ?? 0.6;
  const enterStart = props.enterStart ?? 0.6;
  const enterEnd = props.enterEnd ?? 1;
  const resolvedExitStart = typeof exitStart === 'function' ? exitStart(context) : exitStart;
  const resolvedExitEnd = typeof exitEnd === 'function' ? exitEnd(context) : exitEnd;
  const resolvedEnterStart = typeof enterStart === 'function' ? enterStart(context) : enterStart;
  const resolvedEnterEnd = typeof enterEnd === 'function' ? enterEnd(context) : enterEnd;
  const start = Math.min(resolvedExitStart, resolvedEnterStart);
  const end = Math.max(resolvedExitEnd, resolvedEnterEnd);

  return {
    id: 'auto-transition',
    start,
    end,
    scope: props.scope ?? 'active',
    apply: (state, nextContext, _t) => {
      const progress = nextContext.progress;
      const nextExitStart = typeof exitStart === 'function' ? exitStart(nextContext) : exitStart;
      const nextExitEnd = typeof exitEnd === 'function' ? exitEnd(nextContext) : exitEnd;
      const nextEnterStart = typeof enterStart === 'function' ? enterStart(nextContext) : enterStart;
      const nextEnterEnd = typeof enterEnd === 'function' ? enterEnd(nextContext) : enterEnd;
      const transitionContext = buildTransitionContext({
        progress,
        exitStart: nextExitStart,
        exitEnd: nextExitEnd,
        enterStart: nextEnterStart,
        enterEnd: nextEnterEnd,
      });

      const target = nextContext.nextState ?? state;
      if (progress < nextExitStart) return state;
      if (progress > nextEnterEnd) return target;
      return applySceneTransition(state, target, transitionContext);
    },
  };
};

export const __test__ = {
  applySceneTransition,
  buildTransitionContext,
};
