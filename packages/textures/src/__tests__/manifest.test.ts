// Tests for BUILTIN_MANIFEST — validates all 10 presets, map coverage, and PBR defaults.

import { describe, it, expect } from 'vitest';
import { BUILTIN_MANIFEST } from '../manifest';

const EXPECTED_PRESETS = [
  'onyx', 'dark-marble', 'verde-marble', 'light-marble', 'white-marble',
  'steel', 'dark-steel', 'gold', 'copper', 'brushed-steel',
] as const;

const STONE_PRESETS = ['onyx', 'dark-marble', 'verde-marble', 'light-marble', 'white-marble'];
const METAL_PRESETS = ['steel', 'dark-steel', 'gold', 'copper', 'brushed-steel'];

describe('BUILTIN_MANIFEST', () => {
  it('has version 1', () => {
    expect(BUILTIN_MANIFEST.version).toBe(1);
  });

  it('contains all 10 presets', () => {
    const presetNames = Object.keys(BUILTIN_MANIFEST.presets);
    expect(presetNames).toHaveLength(10);
    for (const name of EXPECTED_PRESETS) {
      expect(BUILTIN_MANIFEST.presets[name]).toBeDefined();
    }
  });

  it('every preset has color, normal, and roughness maps', () => {
    for (const name of EXPECTED_PRESETS) {
      const preset = BUILTIN_MANIFEST.presets[name];
      expect(preset.maps.color).toBeTruthy();
      expect(preset.maps.normal).toBeTruthy();
      expect(preset.maps.roughness).toBeTruthy();
    }
  });

  it('stone presets have low metalness (< 0.5)', () => {
    for (const name of STONE_PRESETS) {
      const preset = BUILTIN_MANIFEST.presets[name];
      expect(preset.defaults.metalness).toBeLessThan(0.5);
    }
  });

  it('metal presets have high metalness (>= 0.9)', () => {
    for (const name of METAL_PRESETS) {
      const preset = BUILTIN_MANIFEST.presets[name];
      expect(preset.defaults.metalness).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('all map paths are relative (no leading slash)', () => {
    for (const name of EXPECTED_PRESETS) {
      const maps = BUILTIN_MANIFEST.presets[name].maps;
      expect(maps.color).not.toMatch(/^\//);
      expect(maps.normal).not.toMatch(/^\//);
      expect(maps.roughness).not.toMatch(/^\//);
      if (maps.displacement) {
        expect(maps.displacement).not.toMatch(/^\//);
      }
    }
  });

  it('stone presets with displacement have displacement map paths', () => {
    const withDisplacement = ['onyx', 'dark-marble', 'verde-marble'];
    for (const name of withDisplacement) {
      const preset = BUILTIN_MANIFEST.presets[name];
      expect(preset.maps.displacement).toBeTruthy();
    }
  });

  it('metal presets do not have displacement maps', () => {
    for (const name of METAL_PRESETS) {
      const preset = BUILTIN_MANIFEST.presets[name];
      expect(preset.maps.displacement).toBeUndefined();
    }
  });

  it('all map paths follow presets/{name}/{map}.ktx2 pattern', () => {
    for (const name of EXPECTED_PRESETS) {
      const maps = BUILTIN_MANIFEST.presets[name].maps;
      expect(maps.color).toBe(`presets/${name}/color.ktx2`);
      expect(maps.normal).toBe(`presets/${name}/normal.ktx2`);
      expect(maps.roughness).toBe(`presets/${name}/roughness.ktx2`);
      if (maps.displacement) {
        expect(maps.displacement).toBe(`presets/${name}/displacement.ktx2`);
      }
    }
  });
});
