// Unit system compile integration tests for chart element.

import { describe, it, expect } from 'vitest';
import type { SceneLength, SceneAngle } from '@brewsite/core';
import { compileChart, DEFAULT_CHART_STATE } from '../compile';
import type { ChartTypeOptions } from '../types';

const barTypeOptions: ChartTypeOptions = { kind: 'bar', options: {} };

describe('chart unit system compile', () => {
  it('width: "60%" compiles to bounds.width=0.60 with uniformSizing=false', () => {
    const state = compileChart(
      { id: 'test', w: '60%' as SceneLength },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.bounds.width).toBeCloseTo(0.60);
    expect(state.uniformSizing).toBe(false);
  });

  it('width: "60u" compiles to bounds.width=0.60 with uniformSizing=true', () => {
    const state = compileChart(
      { id: 'test', w: '60u' as SceneLength },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.bounds.width).toBeCloseTo(0.60);
    expect(state.uniformSizing).toBe(true);
  });

  it('x: "20%", y: "10%" compiles to correct nvsX/nvsY center', () => {
    const state = compileChart(
      { id: 'test', x: '20%' as SceneLength, y: '10%' as SceneLength, w: '50%' as SceneLength, h: '60%' as SceneLength },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.nvsX).toBeCloseTo(0.20 + 0.50 / 2);
    expect(state.nvsY).toBeCloseTo(0.10 + 0.60 / 2);
    expect(state.uniformSizing).toBe(false);
  });

  it('x: "20u" sets uniformSizing=true', () => {
    const state = compileChart(
      { id: 'test', x: '20u' as SceneLength },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.nvsX).toBeCloseTo(0.20 + 1.0 / 2);
    expect(state.uniformSizing).toBe(true);
  });

  it('no x/y/w/h defaults to uniformSizing=false', () => {
    const state = compileChart(
      { id: 'test' },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.uniformSizing).toBe(false);
    expect(state.bounds.width).toBe(1);
    expect(state.bounds.height).toBe(1);
  });

  it('x: 0, y: 0 (zero literal) compiles to 0 with uniformSizing=false', () => {
    const state = compileChart(
      { id: 'test', x: 0, y: 0, w: '100%' as SceneLength, h: '100%' as SceneLength },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.nvsX).toBeCloseTo(0.5);
    expect(state.nvsY).toBeCloseTo(0.5);
    expect(state.uniformSizing).toBe(false);
  });

  it('rotation: ["45deg", "0deg", "90deg"] compiles to radians', () => {
    const state = compileChart(
      { id: 'test', rotation: ['45deg' as SceneAngle, '0deg' as SceneAngle, '90deg' as SceneAngle] },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.rotation[0]).toBeCloseTo(Math.PI / 4);
    expect(state.rotation[1]).toBeCloseTo(0);
    expect(state.rotation[2]).toBeCloseTo(Math.PI / 2);
  });

  it('rotation: ["0.5rad", "0rad", "1rad"] passes through as radians', () => {
    const state = compileChart(
      { id: 'test', rotation: ['0.5rad' as SceneAngle, '0rad' as SceneAngle, '1rad' as SceneAngle] },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.rotation[0]).toBeCloseTo(0.5);
    expect(state.rotation[1]).toBeCloseTo(0);
    expect(state.rotation[2]).toBeCloseTo(1);
  });

  it('rotation defaults to [0, 0, 0] when not specified', () => {
    const state = compileChart(
      { id: 'test' },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.rotation).toEqual([0, 0, 0]);
  });

  it('DEFAULT_CHART_STATE includes uniformSizing=false', () => {
    expect(DEFAULT_CHART_STATE.uniformSizing).toBe(false);
  });

  it('z stays number (world-space), not affected by units', () => {
    const state = compileChart(
      { id: 'test', z: -2.5 },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.z).toBe(-2.5);
  });

  it('vw unit resolves to NVS fraction', () => {
    const state = compileChart(
      { id: 'test', w: '50vw' as SceneLength },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.bounds.width).toBeCloseTo(0.50);
    expect(state.uniformSizing).toBe(false);
  });

  it('vh unit resolves to NVS fraction', () => {
    const state = compileChart(
      { id: 'test', h: '50vh' as SceneLength },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.bounds.height).toBeCloseTo(0.50);
    expect(state.uniformSizing).toBe(false);
  });

  it('mixed u and % — any u prop sets uniformSizing=true', () => {
    const state = compileChart(
      { id: 'test', w: '60u' as SceneLength, h: '40%' as SceneLength },
      'bar',
      barTypeOptions,
      null, [], [], null, null, [],
    );
    expect(state.uniformSizing).toBe(true);
  });
});
