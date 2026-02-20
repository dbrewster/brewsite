import { describe, expect, it } from 'vitest';
import { applyBackground } from '../render';

const makeElement = (): HTMLElement => {
  const style: Record<string, string> = {};
  // Minimal HTMLElement stub — only `style` property is needed.
  return { style } as unknown as HTMLElement;
};

describe('applyBackground', () => {
  it('sets background-image when imageUrl is provided', () => {
    const el = makeElement();
    applyBackground({ imageUrl: '/assets/bg.jpg', opacity: 1 }, { element: el });
    expect(el.style.backgroundImage).toBe("url('/assets/bg.jpg')");
  });

  it('clears background-image when imageUrl is absent', () => {
    const el = makeElement();
    el.style.backgroundImage = "url('/old.jpg')";
    applyBackground({ opacity: 0.5 }, { element: el });
    expect(el.style.backgroundImage).toBe('');
  });

  it('applies opacity to element style', () => {
    const el = makeElement();
    applyBackground({ opacity: 0.4 }, { element: el });
    expect(el.style.opacity).toBe('0.4');
  });

  it('defaults opacity to 1 when not provided', () => {
    const el = makeElement();
    applyBackground({} as Parameters<typeof applyBackground>[0], { element: el });
    expect(el.style.opacity).toBe('1');
  });

  it('applies cssPosition when provided', () => {
    const el = makeElement();
    applyBackground({ opacity: 1, cssPosition: 'center top' }, { element: el });
    expect(el.style.backgroundPosition).toBe('center top');
  });

  it('applies cssSize when provided', () => {
    const el = makeElement();
    applyBackground({ opacity: 1, cssSize: 'cover' }, { element: el });
    expect(el.style.backgroundSize).toBe('cover');
  });

  it('applies cssRepeat when provided', () => {
    const el = makeElement();
    applyBackground({ opacity: 1, cssRepeat: 'no-repeat' }, { element: el });
    expect(el.style.backgroundRepeat).toBe('no-repeat');
  });

  it('clears transform when no position is provided', () => {
    const el = makeElement();
    el.style.transform = 'translate3d(10px, 20px, 0px)';
    applyBackground({ opacity: 1 }, { element: el });
    expect(el.style.transform).toBe('');
  });

  it('applies 3D transform when position is provided', () => {
    const el = makeElement();
    applyBackground({ opacity: 1, position: [10, -5, 2] }, { element: el });
    expect(el.style.transform).toBe('translate3d(10px, -5px, 2px)');
  });
});
