import { describe, it, expect } from 'vitest';
import { Background } from '../dsl';
import { DEFAULT_BACKGROUND, backgroundTransitionSpec } from '../compile';
import { applyBackground } from '../render';
import type { SceneBackground } from '../types';
import {
  makeTransitionContext,
  makeFakeDomElement,
} from '../../__tests__/elementTestMocks';

describe('background compile + render', () => {
  it('defaults to opaque with no image', () => {
    expect(DEFAULT_BACKGROUND.opacity).toBe(1);
    expect(DEFAULT_BACKGROUND.imageUrl).toBeUndefined();
  });

  it('transitionSpec.exit fades opacity to 0', () => {
    const state: SceneBackground = { opacity: 1, imageUrl: '/a.jpg' };
    const result = backgroundTransitionSpec.exit(state, makeTransitionContext({ tExit: 1 }));
    expect(result.opacity).toBeCloseTo(0);
  });

  it('transitionSpec.enter fades opacity in', () => {
    const state: SceneBackground = { opacity: 0.8 };
    const result = backgroundTransitionSpec.enter(state, makeTransitionContext({ tEnter: 0.5 }));
    expect(result.opacity).toBeGreaterThan(0);
    expect(result.opacity).toBeLessThan(0.8);
  });

  it('transitionSpec.interpolate cross-fades when image differs', () => {
    const from: SceneBackground = { opacity: 1, imageUrl: '/from.jpg' };
    const to: SceneBackground = { opacity: 1, imageUrl: '/to.jpg' };
    const at25 = backgroundTransitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 0.25 }));
    const at75 = backgroundTransitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 0.75 }));
    expect(at25.imageUrl).toBe('/from.jpg');
    expect(at75.imageUrl).toBe('/to.jpg');
    expect(at25.opacity).toBeLessThan(1);
    expect(at75.opacity).toBeLessThan(1);
  });

  it('applyBackground writes styles to the element', () => {
    const el = makeFakeDomElement();
    const state: SceneBackground = {
      opacity: 0.6,
      imageUrl: '/hero.jpg',
      cssPosition: 'center',
      cssSize: 'cover',
      cssRepeat: 'no-repeat',
      position: [1, 2, 3],
    };
    applyBackground(state, { element: el });
    const styles = el.style as unknown as Record<string, string>;
    expect(styles.backgroundImage).toContain('hero.jpg');
    expect(styles.opacity).toBe('0.6');
    expect(styles.backgroundPosition).toBe('center');
    expect(styles.backgroundSize).toBe('cover');
    expect(styles.backgroundRepeat).toBe('no-repeat');
    expect(styles.transform).toContain('translate3d(1px, 2px, 3px)');
  });

  it('Background DSL component renders null and has displayName', () => {
    expect(Background.displayName).toBe('Background');
    expect(Background({})).toBeNull();
  });
});
