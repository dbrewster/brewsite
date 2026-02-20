import {describe, expect, it} from 'vitest';
import {environmentTransitionSpec} from '../../../elements/environment/compile';
import {buildContext, expectNumberClose} from './transitionTestUtils';

describe('environment transitions', () => {
  it('blends intensity across and switches url', () => {
    const context = buildContext({ tFull: 0.5 });
    const from = { enabled: true, intensity: 0, url: 'a' };
    const to = { enabled: true, intensity: 10, url: 'b' };
    const result = environmentTransitionSpec.interpolate(from, to, context);
    expectNumberClose(result.intensity, 5);
    expect(result.url).toBe('b');
  });

  it('transitions out by fading intensity', () => {
    const context = buildContext({ tExit: 0.5 });
    const from = { enabled: true, intensity: 10, url: 'a' };
    const result = environmentTransitionSpec.exit(from, context);
    expectNumberClose(result.intensity, 5);
    expect(result.enabled).toBe(true);
  });

  it('transitions in by fading intensity', () => {
    const context = buildContext({ tEnter: 0.5 });
    const to = { enabled: true, intensity: 10, url: 'b' };
    const result = environmentTransitionSpec.enter(to, context);
    expectNumberClose(result.intensity, 5);
    expect(result.enabled).toBe(true);
  });
});
