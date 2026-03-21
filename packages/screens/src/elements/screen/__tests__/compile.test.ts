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
    const state = compileScreen({ id: 'screen', src: 'https://example.com', x: '30%', y: '70%', z: -1 });
    expect(state.nvsX).toBeCloseTo(0.3);
    expect(state.nvsY).toBeCloseTo(0.7);
    expect(state.z).toBe(-1);
  });

  it('respects explicit NVS height', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com', height: '35%' });
    expect(state.nvsHeight).toBeCloseTo(0.35);
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

  it('compiles rotation with angle units', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com', rotation: [0, '45deg', 0] });
    expect(state.rotation[0]).toBe(0);
    expect(state.rotation[1]).toBeCloseTo(Math.PI / 4);
    expect(state.rotation[2]).toBe(0);
  });

  it('compiles rotation with radian units', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com', rotation: [0, '1rad', 0] });
    expect(state.rotation[1]).toBe(1.0);
  });

  it('ScreenState has no gloss field', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect((state as { gloss?: number }).gloss).toBeUndefined();
  });

  it('ScreenState has no selfIllumination field', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect((state as { selfIllumination?: number }).selfIllumination).toBeUndefined();
  });

  it('defaults uniformSizing to false', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com' });
    expect(state.uniformSizing).toBe(false);
  });

  it('sets uniformSizing true when width uses u unit', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com', width: '62.5u' });
    expect(state.uniformSizing).toBe(true);
    expect(state.nvsWidth).toBeCloseTo(0.625);
  });

  it('sets uniformSizing false when width uses % unit', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com', width: '62.5%' });
    expect(state.uniformSizing).toBe(false);
    expect(state.nvsWidth).toBeCloseTo(0.625);
  });

  it('resolves x=0 to nvsX=0', () => {
    const state = compileScreen({ id: 'screen', src: 'https://example.com', x: 0 });
    expect(state.nvsX).toBe(0);
  });
});
