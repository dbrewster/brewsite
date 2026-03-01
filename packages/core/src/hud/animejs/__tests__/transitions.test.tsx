// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { EngineStateContext } from '../../../player/EngineStateContext';
import { Fade, MidFade, SlideUp, SlideDown, ScrollOn, ScrollOff } from '../transitions';

vi.mock('animejs', () => ({
  default: {
    timeline: vi.fn(() => ({
      add: vi.fn().mockReturnThis(),
      seek: vi.fn(),
    })),
  },
}));

const zeroState = { progress: 0, sceneId: 'test', sceneIndex: 0, sceneProgress: 0 };
const wrap = (node: React.ReactElement) => (
  <EngineStateContext.Provider value={zeroState}>
    {node}
  </EngineStateContext.Provider>
);

const PRESETS = [
  { name: 'Fade', C: Fade, startsHidden: true },
  { name: 'MidFade', C: MidFade, startsHidden: true },
  { name: 'SlideUp', C: SlideUp, startsHidden: true },
  { name: 'SlideDown', C: SlideDown, startsHidden: true },
  { name: 'ScrollOn', C: ScrollOn, startsHidden: true },
  { name: 'ScrollOff', C: ScrollOff, startsHidden: false },
] as const;

describe('transition presets', () => {
  afterEach(() => {
    cleanup();
  });
  for (const { name, C, startsHidden } of PRESETS) {
    it(`${name}: renders children inside a div`, () => {
      const { getByText } = render(wrap(<C><span>content</span></C>));
      expect(getByText('content')).toBeDefined();
    });

    if (startsHidden) {
      it(`${name}: initial opacity is 0`, () => {
      const { container } = render(wrap(<C><span /></C>));
      const div = container.firstElementChild as HTMLElement;
      expect(div?.style.opacity).toBe('0');
    });
    }

    it(`${name}: does not throw`, () => {
      expect(() => render(wrap(<C><span /></C>))).not.toThrow();
    });
  }

  it('presets compose without error', () => {
    expect(() =>
      render(wrap(
        <Fade><SlideUp delay={100}><span>nested</span></SlideUp></Fade>
      ))
    ).not.toThrow();
  });

  it('SlideUp stagger via delay prop does not throw', () => {
    expect(() =>
      render(wrap(
        <>
          <SlideUp delay={0}><span>a</span></SlideUp>
          <SlideUp delay={100}><span>b</span></SlideUp>
          <SlideUp delay={200}><span>c</span></SlideUp>
        </>
      ))
    ).not.toThrow();
  });

  it('Fade always starts hidden (opacity: 0)', () => {
    const { container } = render(wrap(<Fade><span /></Fade>));
    const div = container.firstElementChild as HTMLElement;
    expect(div?.style.opacity).toBe('0');
  });
});
