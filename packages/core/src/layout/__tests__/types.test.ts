// Structural conformance tests for NVS layout types.
import { describe, it, expect } from 'vitest';
import type { NVSRect, NVSPosition, INVSBounded } from '../types';

describe('NVSRect', () => {
  it('accepts a valid fullscreen rect literal', () => {
    const rect: NVSRect = { x: 0, y: 0, w: 1, h: 1 };
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.w).toBe(1);
    expect(rect.h).toBe(1);
  });

  it('accepts a sub-region rect literal', () => {
    const rect: NVSRect = { x: 0.1, y: 0.2, w: 0.5, h: 0.3 };
    expect(rect.x).toBe(0.1);
    expect(rect.y).toBe(0.2);
    expect(rect.w).toBe(0.5);
    expect(rect.h).toBe(0.3);
  });
});

describe('NVSPosition', () => {
  it('accepts a valid position literal', () => {
    const pos: NVSPosition = { x: 0.5, y: 0.75 };
    expect(pos.x).toBe(0.5);
    expect(pos.y).toBe(0.75);
  });

  it('accepts the top-left origin position', () => {
    const pos: NVSPosition = { x: 0, y: 0 };
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });
});

describe('INVSBounded', () => {
  it('is implementable by a concrete class returning a fullscreen default', () => {
    class ConcreteWidget implements INVSBounded {
      get nvsBounds(): NVSRect {
        return { x: 0, y: 0, w: 1, h: 1 };
      }
    }

    const widget = new ConcreteWidget();
    expect(widget.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('is implementable by a concrete class returning a sub-region', () => {
    class SubRegionWidget implements INVSBounded {
      constructor(private readonly bounds: NVSRect) {}
      get nvsBounds(): NVSRect {
        return this.bounds;
      }
    }

    const bounds: NVSRect = { x: 0.25, y: 0.1, w: 0.5, h: 0.8 };
    const widget = new SubRegionWidget(bounds);
    expect(widget.nvsBounds).toBe(bounds);
  });
});
