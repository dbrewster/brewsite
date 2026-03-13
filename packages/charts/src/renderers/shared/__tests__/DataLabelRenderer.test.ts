// DataLabelRenderer tests — troika Text instance lifecycle and alignment offset behavior.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted — define all mock classes INSIDE factory functions.

vi.mock('three', () => {
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
    normalize() {
      const len = this.length();
      if (len > 0) { this.x /= len; this.y /= len; this.z /= len; }
      return this;
    }
    multiplyScalar(s: number) { this.x *= s; this.y *= s; this.z *= s; return this; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
  }

  class Object3D {
    position: Vector3 = new Vector3();
    renderOrder = 0;
    userData: Record<string, unknown> = {};
    children: Object3D[] = [];
    add(child: Object3D) { this.children.push(child); return this; }
    remove(child: Object3D) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
      return this;
    }
  }

  class Group extends Object3D {}

  return { Vector3, Object3D, Group };
});

vi.mock('troika-three-text', () => {
  class Object3D {
    position = { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; } };
    renderOrder = 0;
    userData: Record<string, unknown> = {};
    children: Object3D[] = [];
    add(child: Object3D) { this.children.push(child); return this; }
    remove(child: Object3D) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
      return this;
    }
  }

  class Text extends Object3D {
    text = '';
    color = '';
    fontSize = 0;
    fillOpacity = 1;
    visible = true;
    anchorX = 'center';
    anchorY = 'middle';
    textAlign = 'center';
    overflowWrap = 'normal';
    whiteSpace = 'nowrap';
    lineHeight = 1.1;
    font?: string;
    maxWidth?: number;
    sync = vi.fn();
    dispose = vi.fn();
    textRenderInfo: unknown = undefined;
  }

  return { Text };
});

vi.mock('@brewsite/core', () => ({
  ensureText: vi.fn((text: { visible: boolean; fillOpacity: number }) => {
    text.visible = true;
    text.fillOpacity = 1;
  }),
  disposeText: vi.fn((text: { dispose?: () => void }) => {
    text.dispose?.();
  }),
  parseHexColor: (hex: string) => ({
    rgb: hex.length === 9 && hex[0] === '#' ? hex.slice(0, 7) : hex,
    alpha: hex.length === 9 && hex[0] === '#' ? parseInt(hex.slice(7, 9), 16) / 255 : 1,
  }),
}));

import * as THREE from 'three';
import { ensureText } from '@brewsite/core';
import { DataLabelRenderer } from '../DataLabelRenderer';
import type { DataLabelEntry } from '../IChartRenderer';

const makeTheme = () => ({
  legend: { fontSize: 0.12, swatchSize: 0.12, spacing: 0.2, textColor: '#fff', gap: 0.1 },
  series: [{ color: '#00d4ff', metalness: 0, roughness: 0.5, transmission: 0, emissiveIntensity: 0.2, depth: 0.1 }],
  axis: { lineColor: '#fff', lineOpacity: 1, tickOpacity: 1, labelColor: '#fff', labelOpacity: 1, fontSize: 0.1, tickLength: 0.05, gap: 0.04 },
  background: { planeColor: null, planeOpacity: 0, gridColor: null },
  line: { shape: 'circle' as const, smoothness: 0.5, subdivisions: 10 },
  pie: { tilt: 0.2 },
  interaction: { hoverColor: '#fff', hoverEmissiveIntensity: 1, selectedColor: '#ff0' },
  name: 'test',
});

const makeEntry = (
  x: number, y: number, z: number,
  alignment: DataLabelEntry['alignment'],
  text = '42',
): DataLabelEntry => ({
  position: new THREE.Vector3(x, y, z),
  text,
  alignment,
});

describe('DataLabelRenderer', () => {
  let group: THREE.Group;
  let renderer: DataLabelRenderer;

  beforeEach(() => {
    group = new THREE.Group();
    renderer = new DataLabelRenderer(group);
  });

  it('creates group with no children on instantiation', () => {
    expect(group.children.length).toBe(0);
  });

  it('update() with 3 entries adds 3 Text instances to the group', () => {
    renderer.update([
      makeEntry(0, 1, 0, 'above'),
      makeEntry(1, 2, 0, 'center'),
      makeEntry(2, 1, 0, 'outside'),
    ], makeTheme(), 1);

    expect(group.children.length).toBe(3);
  });

  it('update() with 0 entries after 3 removes all text children', () => {
    renderer.update([
      makeEntry(0, 1, 0, 'above'),
      makeEntry(1, 2, 0, 'center'),
      makeEntry(2, 1, 0, 'outside'),
    ], makeTheme(), 1);
    expect(group.children.length).toBe(3);

    renderer.update([], makeTheme(), 1);
    expect(group.children.length).toBe(0);
  });

  it('update() with above alignment applies +0.06 Z offset', () => {
    renderer.update([makeEntry(1, 2, 0, 'above')], makeTheme(), 1);

    const child = group.children[0]!;
    expect(child.position.z).toBeCloseTo(0.06);
    expect(child.position.x).toBeCloseTo(1);
    expect(child.position.y).toBeCloseTo(2);
  });

  it('update() with center alignment does not offset position', () => {
    renderer.update([makeEntry(1, 2, 0.5, 'center')], makeTheme(), 1);

    const child = group.children[0]!;
    expect(child.position.x).toBeCloseTo(1);
    expect(child.position.y).toBeCloseTo(2);
    expect(child.position.z).toBeCloseTo(0.5);
  });

  it('update() with outside alignment adds radial X offset when pointing right', () => {
    // Position at (1, 0, 0) — radial outward is +X direction, offset = 0.08
    renderer.update([makeEntry(1, 0, 0, 'outside')], makeTheme(), 1);

    const child = group.children[0]!;
    expect(child.position.x).toBeCloseTo(1.08, 2);
    expect(child.position.y).toBeCloseTo(0, 2);
  });

  it('update() with outside alignment at zero vector does not offset', () => {
    renderer.update([makeEntry(0, 0, 0, 'outside')], makeTheme(), 1);

    const child = group.children[0]!;
    expect(child.position.x).toBeCloseTo(0);
    expect(child.position.y).toBeCloseTo(0);
  });

  it('dispose() removes all texts from the group', () => {
    renderer.update([makeEntry(0, 0, 0, 'above'), makeEntry(1, 1, 0, 'center')], makeTheme(), 1);
    expect(group.children.length).toBe(2);

    renderer.dispose();
    expect(group.children.length).toBe(0);
  });

  it('update() reuses existing Text instance when count stays the same', () => {
    renderer.update([makeEntry(0, 0, 0, 'above')], makeTheme(), 1);
    const firstChild = group.children[0];

    renderer.update([makeEntry(1, 1, 0, 'above', '99')], makeTheme(), 1);
    expect(group.children[0]).toBe(firstChild);
    expect(group.children.length).toBe(1);
  });

  it('reads fontSize from theme.dataLabels when present', () => {
    const theme = { ...makeTheme(), dataLabels: { fontSize: 0.08, color: '#aabbcc' } };
    renderer.update([makeEntry(0, 0, 0, 'above')], theme, 1);

    const calls = vi.mocked(ensureText).mock.calls;
    const lastCall = calls[calls.length - 1];
    // ensureText signature: (textObj, text, color, fontSize, opacity, ...)
    expect(lastCall?.[3]).toBeCloseTo(0.08);
  });

  it('falls back to fontSize=0.05 when theme.dataLabels is absent', () => {
    renderer.update([makeEntry(0, 0, 0, 'above')], makeTheme(), 1);

    const calls = vi.mocked(ensureText).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[3]).toBeCloseTo(0.05);
  });

  it('reads color from theme.dataLabels when present', () => {
    const theme = { ...makeTheme(), dataLabels: { fontSize: 0.05, color: '#ff0000' } };
    renderer.update([makeEntry(0, 0, 0, 'above')], theme, 1);

    const calls = vi.mocked(ensureText).mock.calls;
    const lastCall = calls[calls.length - 1];
    // ensureText signature: (textObj, text, color, fontSize, opacity, ...)
    expect(lastCall?.[2]).toBe('#ff0000');
  });

  it('falls back to color=#ffffff when theme.dataLabels is absent', () => {
    renderer.update([makeEntry(0, 0, 0, 'above')], makeTheme(), 1);

    const calls = vi.mocked(ensureText).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[2]).toBe('#ffffff');
  });
});
