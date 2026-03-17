// Built-in PBR material preset manifest for @brewsite/textures.

import type { MaterialManifest } from '@brewsite/core';

/**
 * Built-in material manifest for @brewsite/textures.
 * Preset paths are relative to the basePath configured in texturesPlugin().
 *
 * The basePath default is '/assets/materials' — Vite plugin copies assets there.
 */
export const BUILTIN_MANIFEST: Omit<MaterialManifest, 'basePath'> = {
  version: 1,
  presets: {
    // -- Stone ----------------------------------------------------------------
    'onyx': {
      maps: {
        color: 'presets/onyx/color.ktx2',
        normal: 'presets/onyx/normal.ktx2',
        roughness: 'presets/onyx/roughness.ktx2',
        displacement: 'presets/onyx/displacement.ktx2',
      },
      defaults: { metalness: 0.05, roughness: 0.25 },
    },
    'dark-marble': {
      maps: {
        color: 'presets/dark-marble/color.ktx2',
        normal: 'presets/dark-marble/normal.ktx2',
        roughness: 'presets/dark-marble/roughness.ktx2',
        displacement: 'presets/dark-marble/displacement.ktx2',
      },
      defaults: { metalness: 0.05, roughness: 0.30 },
    },
    'verde-marble': {
      maps: {
        color: 'presets/verde-marble/color.ktx2',
        normal: 'presets/verde-marble/normal.ktx2',
        roughness: 'presets/verde-marble/roughness.ktx2',
        displacement: 'presets/verde-marble/displacement.ktx2',
      },
      defaults: { metalness: 0.05, roughness: 0.25 },
    },
    'light-marble': {
      maps: {
        color: 'presets/light-marble/color.ktx2',
        normal: 'presets/light-marble/normal.ktx2',
        roughness: 'presets/light-marble/roughness.ktx2',
      },
      defaults: { metalness: 0.05, roughness: 0.35 },
    },
    'white-marble': {
      maps: {
        color: 'presets/white-marble/color.ktx2',
        normal: 'presets/white-marble/normal.ktx2',
        roughness: 'presets/white-marble/roughness.ktx2',
      },
      defaults: { metalness: 0.05, roughness: 0.35 },
    },
    // -- Metal ----------------------------------------------------------------
    'steel': {
      maps: {
        color: 'presets/steel/color.ktx2',
        normal: 'presets/steel/normal.ktx2',
        roughness: 'presets/steel/roughness.ktx2',
      },
      defaults: { metalness: 0.95, roughness: 0.15 },
    },
    'dark-steel': {
      maps: {
        color: 'presets/dark-steel/color.ktx2',
        normal: 'presets/dark-steel/normal.ktx2',
        roughness: 'presets/dark-steel/roughness.ktx2',
      },
      defaults: { metalness: 0.95, roughness: 0.20 },
    },
    'gold': {
      maps: {
        color: 'presets/gold/color.ktx2',
        normal: 'presets/gold/normal.ktx2',
        roughness: 'presets/gold/roughness.ktx2',
      },
      defaults: { metalness: 1.0, roughness: 0.15 },
    },
    'copper': {
      maps: {
        color: 'presets/copper/color.ktx2',
        normal: 'presets/copper/normal.ktx2',
        roughness: 'presets/copper/roughness.ktx2',
      },
      defaults: { metalness: 1.0, roughness: 0.20 },
    },
    'brushed-steel': {
      maps: {
        color: 'presets/brushed-steel/color.ktx2',
        normal: 'presets/brushed-steel/normal.ktx2',
        roughness: 'presets/brushed-steel/roughness.ktx2',
      },
      defaults: { metalness: 0.90, roughness: 0.35 },
    },
    // -- Volcanic glass -------------------------------------------------------
    'obsidian': {
      maps: {
        color: 'presets/obsidian/color.ktx2',
        normal: 'presets/obsidian/normal.ktx2',
        roughness: 'presets/obsidian/roughness.ktx2',
        displacement: 'presets/obsidian/displacement.ktx2',
      },
      defaults: { metalness: 0.15, roughness: 0.12 },
    },
  },
};
