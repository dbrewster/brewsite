import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createGlow, createGlowTexture } from '../glowSprite';

describe('glowSprite', () => {
  it('caches the glow texture', () => {
    const first = createGlowTexture();
    const second = createGlowTexture();
    expect(first).toBe(second);
  });

  it('creates a sprite with expected scale and opacity', () => {
    const sprite = createGlow('#88ccff', 10, 5, 1.4, 0.35);
    expect(sprite).toBeInstanceOf(THREE.Sprite);
    expect(sprite.scale.x).toBeCloseTo(10 * 1.4, 4);
    expect(sprite.scale.y).toBeCloseTo(5 * 1.4, 4);
    const material = sprite.material as THREE.SpriteMaterial;
    expect(material.opacity).toBeCloseTo(0.35, 4);
    expect(sprite.position.z).toBeCloseTo(-0.1, 4);
  });
});
