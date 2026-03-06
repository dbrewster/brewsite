import { describe, it, expect } from 'vitest';
import { compileImagePanel } from '../compile';


describe('compileImagePanel', () => {
  it('defaults to NVS center 0.5, 0.5', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png' });
    expect(state.nvsX).toBe(0.5);
    expect(state.nvsY).toBe(0.5);
    expect(state.z).toBe(0);
  });

  it('respects explicit NVS x, y, z', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png', x: 0.2, y: 0.8, z: -2 });
    expect(state.nvsX).toBe(0.2);
    expect(state.nvsY).toBe(0.8);
    expect(state.z).toBe(-2);
  });

  it('has no position property', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png' });
    expect(state).not.toHaveProperty('position');
  });

  it('defaults nvsWidth to 0.6', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png' });
    expect(state.nvsWidth).toBe(0.6);
  });

  it('respects explicit NVS width', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png', width: 0.4 });
    expect(state.nvsWidth).toBe(0.4);
  });

  it('nvsHeight is undefined by default (computed from aspect ratio at render time)', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png' });
    expect(state.nvsHeight).toBeUndefined();
  });

  it('respects explicit NVS height', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png', height: 0.35 });
    expect(state.nvsHeight).toBe(0.35);
  });

  it('applies default gloss 0.5 when not provided', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png' });
    expect(state.gloss).toBe(0.5);
  });

  it('applies default glossRoughness 0.05', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png' });
    expect(state.glossRoughness).toBe(0.05);
  });

  it('applies default selfIllumination 0.15', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png' });
    expect(state.selfIllumination).toBe(0.15);
  });

  it('preserves explicit src value', () => {
    const state = compileImagePanel({ id: 'panel', src: '/custom.png' });
    expect(state.src).toBe('/custom.png');
  });

  it('applies default bezel "dark"', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png' });
    expect(state.bezel).toBe('dark');
  });

  it('sets glow: true by default', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png' });
    expect(state.glow).toBe(true);
  });

  it('does not modify explicitly provided rotation', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png', rotation: [0.1, 0.2, 0.3] });
    expect(state.rotation).toEqual([0.1, 0.2, 0.3]);
  });
});
