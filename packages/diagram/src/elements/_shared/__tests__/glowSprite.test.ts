import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createGlow, createGlowTexture, disposeGlowSprite } from '../glowSprite';

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

describe('disposeGlowSprite', () => {
  it('disposes the SpriteMaterial but NOT the shared canvas texture', () => {
    const sharedTexture = createGlowTexture();
    const sprite = createGlow('#ff0000', 6, 4, 1.2, 0.5);
    const matDisposeSpy = vi.spyOn(sprite.material, 'dispose');
    // The texture is the module-level cached instance — spying on its dispose
    // lets us verify it is NOT called.
    const texDisposeSpy = vi.spyOn(sharedTexture, 'dispose');

    disposeGlowSprite(sprite);

    expect(matDisposeSpy).toHaveBeenCalledOnce();
    expect(texDisposeSpy).not.toHaveBeenCalled();
  });
});
