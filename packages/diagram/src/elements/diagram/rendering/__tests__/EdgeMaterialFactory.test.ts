import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { EdgeMaterialFactory } from '../EdgeMaterialFactory';

describe('EdgeMaterialFactory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('solid style → MeshStandardMaterial with no map', () => {
    const factory = new EdgeMaterialFactory();
    const material = factory.createMaterial('#ff0000', 1, 'solid', 0.3, 0.7) as THREE.MeshStandardMaterial;
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.map).toBeNull();
  });

  it('dashed style → material with texture map set', () => {
    const factory = new EdgeMaterialFactory();
    const material = factory.createMaterial('#ff0000', 1, 'dashed', 0.3, 0.7) as THREE.MeshStandardMaterial;
    expect(material.map).not.toBeNull();
  });

  it('dotted style → material with different texture map', () => {
    const factory = new EdgeMaterialFactory();
    const dashed = factory.createMaterial('#ff0000', 1, 'dashed', 0.3, 0.7) as THREE.MeshStandardMaterial;
    const dotted = factory.createMaterial('#ff0000', 1, 'dotted', 0.3, 0.7) as THREE.MeshStandardMaterial;
    expect(dashed.map).not.toBe(dotted.map);
  });

  it('two dashed calls → same texture instance', () => {
    const factory = new EdgeMaterialFactory();
    const first = factory.createMaterial('#ff0000', 1, 'dashed', 0.3, 0.7) as THREE.MeshStandardMaterial;
    const second = factory.createMaterial('#ff0000', 1, 'dashed', 0.3, 0.7) as THREE.MeshStandardMaterial;
    expect(first.map).toBe(second.map);
  });

  it('disposeTextures → next call recreates texture', () => {
    const factory = new EdgeMaterialFactory();
    const first = factory.createMaterial('#ff0000', 1, 'dashed', 0.3, 0.7) as THREE.MeshStandardMaterial;
    factory.disposeTextures();
    const second = factory.createMaterial('#ff0000', 1, 'dashed', 0.3, 0.7) as THREE.MeshStandardMaterial;
    expect(first.map).not.toBe(second.map);
  });

  it('uses document canvas when available', () => {
    const ctx = {
      fillStyle: '',
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
    };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
    };
    vi.stubGlobal('document', { createElement: () => fakeCanvas });

    const factory = new EdgeMaterialFactory();
    const dashed = factory.createMaterial('#ff0000', 1, 'dashed', 0.3, 0.7) as THREE.MeshStandardMaterial;
    const dotted = factory.createMaterial('#ff0000', 1, 'dotted', 0.3, 0.7) as THREE.MeshStandardMaterial;
    expect(dashed.map).not.toBeNull();
    expect(dotted.map).not.toBeNull();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('uses OffscreenCanvas when document is unavailable', () => {
    class FakeOffscreenCanvas {
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
      }
      getContext(): null {
        return null;
      }
    }
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);

    const factory = new EdgeMaterialFactory();
    const dashed = factory.createMaterial('#ff0000', 1, 'dashed', 0.3, 0.7) as THREE.MeshStandardMaterial;
    expect(dashed.map).not.toBeNull();
  });

  it('falls back to minimal canvas when no DOM APIs exist', () => {
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('OffscreenCanvas', undefined);
    const factory = new EdgeMaterialFactory();
    const dotted = factory.createMaterial('#ff0000', 1, 'dotted', 0.3, 0.7) as THREE.MeshStandardMaterial;
    expect(dotted.map).not.toBeNull();
  });
});
