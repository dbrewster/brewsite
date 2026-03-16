// centering.test.ts — pure math assertions for the NVS→world centering contract.
//
// ChartWidget.apply() converts (nvsX, nvsY) to a world-space center point via
// NVSCoordService.toWorld(), then subtracts (worldW/2, worldH/2) to produce the
// chartGroup position. worldW and worldH are derived from NVS fraction bounds via
// NVSCoordService.toWorldSize().
//
// These tests verify the math using a real NVSCoordService (no mocks).

import { describe, it, expect } from 'vitest';
import { createNVSCoordService } from '@brewsite/core';

describe('NVSCoordService centering math — worldScale=10 camera (z=12.07, fov=45, 1920x1080)', () => {
  const coords = createNVSCoordService({ distance: 12.07, fovDeg: 45 }, 1920, 1080);
  // visibleWorldHeight ≈ 10.0, visibleWorldWidth ≈ 17.78

  it('visibleWorldHeight is approximately 10.0', () => {
    expect(coords.visibleWorldHeight).toBeCloseTo(10.0, 1);
  });

  it('visibleWorldWidth is approximately 17.78', () => {
    expect(coords.visibleWorldWidth).toBeCloseTo(17.78, 1);
  });

  it('NVS center (0.5, 0.5) maps to world origin [0, 0, 0]', () => {
    const [x, y, z] = coords.toWorld(0.5, 0.5, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBe(0);
  });

  it('bounds.width=1.0 (NVS fraction) → worldW ≈ 17.78', () => {
    const [worldW] = coords.toWorldSize(1.0, 1.0);
    expect(worldW).toBeCloseTo(17.78, 1);
  });

  it('bounds.height=1.0 (NVS fraction) → worldH ≈ 10.0', () => {
    const [, worldH] = coords.toWorldSize(1.0, 1.0);
    expect(worldH).toBeCloseTo(10.0, 1);
  });

  it('NVS center (0.5, 0.5) with bounds (1.0, 1.0): chartGroup at [-worldW/2, -worldH/2, 0]', () => {
    const [wcx, wcy, wcz] = coords.toWorld(0.5, 0.5, 0);
    const [worldW, worldH] = coords.toWorldSize(1.0, 1.0);
    const [gx, gy, gz] = [wcx - worldW / 2, wcy - worldH / 2, wcz];
    expect(gx).toBeCloseTo(-8.89, 1);
    expect(gy).toBeCloseTo(-5.0, 1);
    expect(gz).toBe(0);
  });

  it('§9.5: bounds (0.5, 0.4) → worldW≈8.89, worldH≈4.0', () => {
    const [worldW, worldH] = coords.toWorldSize(0.5, 0.4);
    expect(worldW).toBeCloseTo(8.89, 1);
    expect(worldH).toBeCloseTo(4.0, 1);
  });

  it('§9.5: chartGroup position for bounds (0.5, 0.4) at NVS center', () => {
    const [wcx, wcy, wcz] = coords.toWorld(0.5, 0.5, 0);
    const [worldW, worldH] = coords.toWorldSize(0.5, 0.4);
    const [gx, gy, gz] = [wcx - worldW / 2, wcy - worldH / 2, wcz];
    expect(gx).toBeCloseTo(-4.44, 1);
    expect(gy).toBeCloseTo(-2.0, 1);
    expect(gz).toBe(0);
  });

  it('NVS bounds top-left (x=0.1, y=0.2, w=0.6, h=0.4) → nvsCenter = (0.4, 0.4)', () => {
    const nvsX = 0.1 + 0.6 / 2;
    const nvsY = 0.2 + 0.4 / 2;
    expect(nvsX).toBeCloseTo(0.4);
    expect(nvsY).toBeCloseTo(0.4);
  });

  it('chart content extremes [0..worldW, 0..worldH] are centered on worldCenter after offset', () => {
    const nvsX = 0.5;
    const nvsY = 0.5;
    const boundsW = 0.6;
    const boundsH = 0.4;
    const [wcx, wcy] = coords.toWorld(nvsX, nvsY, 0);
    const [worldW, worldH] = coords.toWorldSize(boundsW, boundsH);
    const [groupX, groupY] = [wcx - worldW / 2, wcy - worldH / 2];
    // Content center = [groupX + worldW/2, groupY + worldH/2] = [wcx, wcy]
    expect(groupX + worldW / 2).toBeCloseTo(wcx);
    expect(groupY + worldH / 2).toBeCloseTo(wcy);
  });

  it('z coordinate passes through toWorld() unchanged', () => {
    const [, , z] = coords.toWorld(0.5, 0.5, -2);
    expect(z).toBe(-2);
  });
});
