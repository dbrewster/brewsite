import { describe, it, expect } from 'vitest';
import { compileImagePanel } from '../compile';


describe('compileImagePanel', () => {
  it('applies default position [0, 0, 0] when not provided', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png' });
    expect(state.position).toEqual([0, 0, 0]);
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

  it('height is undefined by default (computed from aspect ratio at render time)', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png' });
    expect(state.height).toBeUndefined();
  });

  it('does not modify explicitly provided height', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png', height: 6 });
    expect(state.height).toBe(6);
  });

  it('does not modify explicitly provided rotation', () => {
    const state = compileImagePanel({ id: 'panel', src: '/img.png', rotation: [0.1, 0.2, 0.3] });
    expect(state.rotation).toEqual([0.1, 0.2, 0.3]);
  });
});
