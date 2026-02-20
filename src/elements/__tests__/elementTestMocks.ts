import * as THREE from 'three';
import type { TransitionContext } from '../../compiler/transitions/transitionTypes';
import type { WidgetInitContext, WidgetRenderContext } from '../../widget/types';
import { VariableStore } from '../../widget/VariableStore';

export const makeTransitionContext = (
  overrides: Partial<TransitionContext> = {},
): TransitionContext => ({
  tExit: 0,
  tEnter: 0,
  tFull: 0,
  progress: 0,
  exitStart: 0,
  exitEnd: 1,
  enterStart: 0,
  enterEnd: 1,
  ...overrides,
});

export const makeRenderContext = (
  overrides: Partial<WidgetRenderContext> = {},
): WidgetRenderContext => ({
  deltaSeconds: 0,
  globalProgress: 0,
  wallTimeSeconds: 0,
  variables: new VariableStore(),
  extra: undefined,
  ...overrides,
});

export const makeInitContext = (
  overrides: Partial<WidgetInitContext> = {},
): WidgetInitContext => ({
  scene: new THREE.Scene(),
  widgetId: 'test-widget',
  ...overrides,
});

export const makeFakeDomElement = (): HTMLElement => {
  return { style: {} } as unknown as HTMLElement;
};
