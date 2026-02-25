import { describe, it, expect, vi, afterEach } from 'vitest';
import { compileScreen } from '../compile';


afterEach(() => {
  vi.restoreAllMocks();
});

describe('compileScreen', () => {
  it('applies default position [0, 0, 0] when not provided', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect(state.position).toEqual([0, 0, 0]);
  });

  it('applies default height 7.5 (16:9 at width 12)', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect(state.height).toBe(7.5);
  });

  it('preserves explicit src value', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com/docs' });
    expect(state.src).toBe('https://example.com/docs');
  });

  it('applies default bezel "dark"', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect(state.bezel).toBe('dark');
  });

  it('sets glow: true by default', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect(state.glow).toBe(true);
  });

  it('does not modify explicitly provided height', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com', height: 9 });
    expect(state.height).toBe(9);
  });

  it('emits console.warn when rotation Y exceeds 0.15 radians', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    compileScreen({ id: 'screen', src: 'https://example.com', rotation: [0, 0.2, 0] });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('emits console.warn when rotation X exceeds 0.15 radians', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    compileScreen({ id: 'screen', src: 'https://example.com', rotation: [0.2, 0, 0] });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does NOT warn for rotation values below 0.15 radians', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    compileScreen({ id: 'screen', src: 'https://example.com', rotation: [0.1, 0.1, 0.1] });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('ScreenState has no gloss field', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect((state as { gloss?: number }).gloss).toBeUndefined();
  });

  it('ScreenState has no selfIllumination field', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect((state as { selfIllumination?: number }).selfIllumination).toBeUndefined();
  });
});
