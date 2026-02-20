import {expect} from 'vitest';
import type {TransitionContext} from '../transitions/transitionTypes';

export const buildContext = (options: Partial<TransitionContext> = {}): TransitionContext => ({
  tExit: options.tExit ?? 0.5,
  tEnter: options.tEnter ?? 0.5,
  tFull: options.tFull ?? 0.5,
  progress: options.progress ?? 0.5,
  exitStart: options.exitStart ?? 0.2,
  exitEnd: options.exitEnd ?? 0.6,
  enterStart: options.enterStart ?? 0.6,
  enterEnd: options.enterEnd ?? 1,
});

export const expectNumberClose = (value: number | undefined, expected: number, digits = 5) => {
  if (typeof value !== 'number') {
    throw new Error(`Expected number ${expected} but got ${String(value)}`);
  }
  expect(value).toBeCloseTo(expected, digits);
};

export const expectVec3Close = (
  value: [number, number, number] | undefined,
  expected: [number, number, number],
  digits = 5,
) => {
  if (!value) {
    throw new Error(`Expected vec3 ${JSON.stringify(expected)} but got ${String(value)}`);
  }
  expect(value[0]).toBeCloseTo(expected[0], digits);
  expect(value[1]).toBeCloseTo(expected[1], digits);
  expect(value[2]).toBeCloseTo(expected[2], digits);
};
