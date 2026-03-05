// Tests for the pure projectNdcToNvsPixels function exported from ChartTooltipOverlay.

import { describe, it, expect } from 'vitest';
import { projectNdcToNvsPixels } from '../ChartTooltipOverlay';
import type { NVSRect } from '@brewsite/core';

const FULLSCREEN: NVSRect = { x: 0, y: 0, w: 1, h: 1 };

describe('projectNdcToNvsPixels', () => {
  it('projects NDC (0, 0) to center of fullscreen container', () => {
    const result = projectNdcToNvsPixels(0, 0, 1920, 1080, FULLSCREEN);
    // regionX = 0, regionY = 0, regionW = 1920, regionH = 1080
    // x = 0 + (0+1)/2 * 1920 = 960
    // y = 0 + (-0+1)/2 * 1080 = 540
    expect(result.x).toBeCloseTo(960);
    expect(result.y).toBeCloseTo(540);
  });

  it('projects NDC (0, 0) to center of right-half sub-region', () => {
    const result = projectNdcToNvsPixels(0, 0, 1920, 1080, { x: 0.5, y: 0, w: 0.5, h: 1 });
    // regionX = 960, regionY = 0, regionW = 960, regionH = 1080
    // x = 960 + (0+1)/2 * 960 = 960 + 480 = 1440
    // y = 0 + (-0+1)/2 * 1080 = 540
    expect(result.x).toBeCloseTo(1440);
    expect(result.y).toBeCloseTo(540);
  });

  it('projects NDC (-1, 1) to top-left of sub-region', () => {
    const nvsBounds: NVSRect = { x: 0.5, y: 0, w: 0.5, h: 1 };
    const result = projectNdcToNvsPixels(-1, 1, 1920, 1080, nvsBounds);
    // regionX = 960, regionY = 0, regionW = 960, regionH = 1080
    // x = 960 + (-1+1)/2 * 960 = 960 + 0 = 960
    // y = 0 + (-1+1)/2 * 1080 = 0 + 0 = 0
    expect(result.x).toBeCloseTo(960);
    expect(result.y).toBeCloseTo(0);
  });

  it('projects NDC (1, -1) to bottom-right of sub-region', () => {
    const nvsBounds: NVSRect = { x: 0.5, y: 0, w: 0.5, h: 1 };
    const result = projectNdcToNvsPixels(1, -1, 1920, 1080, nvsBounds);
    // regionX = 960, regionY = 0, regionW = 960, regionH = 1080
    // x = 960 + (1+1)/2 * 960 = 960 + 960 = 1920
    // y = 0 + (1+1)/2 * 1080 = 0 + 1080 = 1080
    expect(result.x).toBeCloseTo(1920);
    expect(result.y).toBeCloseTo(1080);
  });

  it('projects NDC (-1, 1) to top-left of fullscreen container', () => {
    const result = projectNdcToNvsPixels(-1, 1, 1920, 1080, FULLSCREEN);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('projects NDC (1, -1) to bottom-right of fullscreen container', () => {
    const result = projectNdcToNvsPixels(1, -1, 1920, 1080, FULLSCREEN);
    expect(result.x).toBeCloseTo(1920);
    expect(result.y).toBeCloseTo(1080);
  });

  it('projects NDC (0, 0) to center of bottom-quarter sub-region', () => {
    const nvsBounds: NVSRect = { x: 0, y: 0.75, w: 1, h: 0.25 };
    const result = projectNdcToNvsPixels(0, 0, 1920, 1080, nvsBounds);
    // regionX = 0, regionY = 810, regionW = 1920, regionH = 270
    // x = 0 + (0+1)/2 * 1920 = 960
    // y = 810 + (-0+1)/2 * 270 = 810 + 135 = 945
    expect(result.x).toBeCloseTo(960);
    expect(result.y).toBeCloseTo(945);
  });

  it('scales linearly with container dimensions', () => {
    const small = projectNdcToNvsPixels(0, 0, 960, 540, FULLSCREEN);
    const large = projectNdcToNvsPixels(0, 0, 1920, 1080, FULLSCREEN);
    // Center of fullscreen — should scale proportionally
    expect(large.x).toBeCloseTo(small.x * 2);
    expect(large.y).toBeCloseTo(small.y * 2);
  });
});
