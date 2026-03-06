import { describe, it, expect, vi, afterEach } from 'vitest';
import { compileScreen } from '../compile';


afterEach(() => {
  vi.restoreAllMocks();
});

describe('compileScreen', () => {
  it('defaults to NVS center 0.5, 0.5', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect(state.nvsX).toBe(0.5);
    expect(state.nvsY).toBe(0.5);
    expect(state.z).toBe(0);
  });

  it('has no position property', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect(state).not.toHaveProperty('position');
  });

  it('defaults nvsWidth to 0.625', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect(state.nvsWidth).toBe(0.625);
  });

  it('nvsHeight is undefined by default (derived from width at render time)', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect(state.nvsHeight).toBeUndefined();
  });

  it('respects explicit NVS x, y, z', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com', x: 0.3, y: 0.7, z: -1 });
    expect(state.nvsX).toBe(0.3);
    expect(state.nvsY).toBe(0.7);
    expect(state.z).toBe(-1);
  });

  it('respects explicit NVS height', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com', height: 0.35 });
    expect(state.nvsHeight).toBe(0.35);
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
