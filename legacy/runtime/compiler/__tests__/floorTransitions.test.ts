import {describe, expect, it} from 'vitest';
import {floorTransitionSpec} from '../../../elements/floor/compile';
import {buildContext} from './transitionTestUtils';

describe('floor transitions', () => {
  it('switches texture across', () => {
    const context = buildContext({ tFull: 0.5 });
    const from = { enabled: true, textureUrl: 'a' };
    const to = { enabled: true, textureUrl: 'b' };
    const result = floorTransitionSpec.interpolate(from, to, context);
    expect(result.textureUrl).toBe('b');
  });

  it('transitions out by disabling', () => {
    const context = buildContext({ tExit: 1 });
    const from = { enabled: true, textureUrl: 'a' };
    const result = floorTransitionSpec.exit(from, context);
    expect(result.enabled).toBe(false);
  });

  it('transitions in by enabling', () => {
    const context = buildContext({ tEnter: 0.5 });
    const to = { enabled: true, textureUrl: 'b' };
    const result = floorTransitionSpec.enter(to, context);
    expect(result.enabled).toBe(true);
  });
});
