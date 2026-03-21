// Tests for compileMediaScreen: verifies default values, source resolution, and warnings.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { compileMediaScreen } from '../compile';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('compileMediaScreen', () => {
  it('defaults to NVS center 0.5, 0.5', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4' });
    expect(state.nvsX).toBe(0.5);
    expect(state.nvsY).toBe(0.5);
  });

  it('sets sourceKind=video when src is provided', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4' });
    expect(state.sourceKind).toBe('video');
    expect(state.src).toBe('/video.mp4');
    expect(state.streamId).toBeUndefined();
  });

  it('sets sourceKind=stream when streamId is provided', () => {
    const state = compileMediaScreen({ id: 'ms', streamId: 'my-stream' });
    expect(state.sourceKind).toBe('stream');
    expect(state.streamId).toBe('my-stream');
    expect(state.src).toBeUndefined();
  });

  it('src takes precedence when both src and streamId are provided, and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4', streamId: 'my-stream' });
    expect(state.sourceKind).toBe('video');
    expect(state.src).toBe('/video.mp4');
    expect(state.streamId).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('both src and streamId set'));
  });

  it('warns when neither src nor streamId is provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    compileMediaScreen({ id: 'ms' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no src or streamId'));
  });

  it('defaults autoPlay=true, loop=true, muted=true', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4' });
    expect(state.autoPlay).toBe(true);
    expect(state.loop).toBe(true);
    expect(state.muted).toBe(true);
  });

  it('defaults gloss=0.5, glossRoughness=0.05, selfIllumination=0.3', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4' });
    expect(state.gloss).toBe(0.5);
    expect(state.glossRoughness).toBe(0.05);
    expect(state.selfIllumination).toBe(0.3);
  });

  it('defaults glow=true, glowColor=#88ccff, glowScale=1.4', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4' });
    expect(state.glow).toBe(true);
    expect(state.glowColor).toBe('#88ccff');
    expect(state.glowScale).toBe(1.4);
  });

  it('compiles rotation with angle units', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4', rotation: [0, '1rad', 0] });
    expect(state.rotation[1]).toBe(1.0);
  });

  it('compiles rotation with degree units', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4', rotation: [0, '90deg', 0] });
    expect(state.rotation[1]).toBeCloseTo(Math.PI / 2);
  });

  it('nvsHeight is undefined by default', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4' });
    expect(state.nvsHeight).toBeUndefined();
  });

  it('nvsWidth defaults to 0.625', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4' });
    expect(state.nvsWidth).toBe(0.625);
  });

  it('defaults uniformSizing to false', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4' });
    expect(state.uniformSizing).toBe(false);
  });

  it('sets uniformSizing true when width uses u unit', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4', width: '62.5u' });
    expect(state.uniformSizing).toBe(true);
    expect(state.nvsWidth).toBeCloseTo(0.625);
  });

  it('resolves explicit x/y SceneLength values', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4', x: '20%', y: '80%' });
    expect(state.nvsX).toBeCloseTo(0.2);
    expect(state.nvsY).toBeCloseTo(0.8);
  });
});
