import {describe, expect, it} from 'vitest';
import {backgroundTransitionSpec} from '../../../elements/background/compile';
import {buildContext, expectNumberClose} from './transitionTestUtils';

describe('background transitions', () => {
  it('cross fades image and opacity', () => {
    const context = buildContext({ tFull: 0.25 });
    const from = { imageUrl: 'a.png', opacity: 1 };
    const to = { imageUrl: 'b.png', opacity: 1 };
    const result = backgroundTransitionSpec.interpolate(from, to, context);
    expectNumberClose(result.opacity, 0.5);
    expect(result.imageUrl).toBe('a.png');
  });

  it('fades background out', () => {
    const context = buildContext({ tExit: 0.5 });
    const from = { imageUrl: 'a.png', opacity: 1 };
    const result = backgroundTransitionSpec.exit(from, context);
    expectNumberClose(result.opacity, 0.5);
  });

  it('fades background in', () => {
    const context = buildContext({ tEnter: 0.5 });
    const to = { imageUrl: 'b.png', opacity: 1 };
    const result = backgroundTransitionSpec.enter(to, context);
    expectNumberClose(result.opacity, 0.5);
  });
});
