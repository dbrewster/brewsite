import { describe, it, expect } from 'vitest';
import {
  blendNumber,
  blendDistance,
  blendOpacity,
  blendVec3,
  blendColor,
  blendAxisRotation,
  blendAxisTranslation,
  mergeCssOpacity,
  blendStyleValues,
  blendStyleValuesPartial,
  resolveTransitionOpacity,
  resolveEnabledByOpacity,
  blendMaterialApplication,
} from '../transitions/transitionTypes';
import type { MaterialApplication } from '../../widget/materialTypes';
import { resolveSceneTransition } from '../transitions/transitionPresets';
import type { TransitionWindow } from '../sceneTrackTypes';

describe('transitionTypes blend helpers', () => {
  it('blendNumber handles undefined inputs and interpolation', () => {
    expect(blendNumber(undefined, undefined, 0.5)).toBeUndefined();
    expect(blendNumber(undefined, 2, 0.5)).toBe(2);
    expect(blendNumber(2, undefined, 0.5)).toBe(2);
    expect(blendNumber(0, 10, 0.5)).toBe(5);
  });

  it('blendDistance handles finite and infinite values', () => {
    expect(blendDistance(undefined, undefined, 0.5)).toBeUndefined();
    expect(blendDistance(1, 3, 0.5)).toBe(2);
    expect(blendDistance(Infinity, 10, 0.25)).toBe(Infinity);
    expect(blendDistance(Infinity, 10, 0.75)).toBe(10);
    expect(blendDistance(-Infinity, Infinity, 0.1)).toBe(-Infinity);
  });

  it('blendOpacity treats undefined as 0', () => {
    expect(blendOpacity(undefined, undefined, 0.5)).toBeUndefined();
    expect(blendOpacity(undefined, 1, 0.5)).toBe(0.5);
    expect(blendOpacity(1, undefined, 0.5)).toBe(0.5);
  });

  it('blendVec3 returns interpolated vectors', () => {
    expect(blendVec3(undefined, undefined, 0.5)).toBeUndefined();
    expect(blendVec3([0, 0, 0], undefined, 0.5)).toEqual([0, 0, 0]);
    expect(blendVec3(undefined, [1, 2, 3], 0.5)).toEqual([1, 2, 3]);
    expect(blendVec3([0, 0, 0], [2, 4, 6], 0.5)).toEqual([1, 2, 3]);
  });

  it('blendColor returns interpolated hex when valid, otherwise picks defined', () => {
    expect(blendColor(undefined, undefined, 0.5)).toBeUndefined();
    expect(blendColor('#ff0000', '#00ff00', 0.5)).toBe('#808000');
    expect(blendColor('#abc', '#def', 0.5)).toBe('#c4d5e6');
    expect(blendColor('#ff0000', undefined, 0.5)).toBe('#ff0000');
    expect(blendColor('bad', '#00ff00', 0.5)).toBe('#00ff00');
    expect(blendColor('#ff0000', '#00ff00', undefined)).toBe('#00ff00');
  });

  it('blendAxisRotation and blendAxisTranslation interpolate per-axis', () => {
    expect(blendAxisRotation(undefined, undefined, 0.5)).toBeUndefined();
    expect(blendAxisRotation({ yawPct: 0 }, { yawPct: 1 }, 0.5)).toEqual({ yawPct: 0.5, pitchPct: undefined, rollPct: undefined });
    expect(blendAxisTranslation({ xPct: 0 }, { xPct: 1, yPct: 2 }, 0.25)).toEqual({ xPct: 0.25, yPct: 2, zPct: undefined });
  });

  it('mergeCssOpacity adds opacity when provided', () => {
    expect(mergeCssOpacity(undefined, undefined)).toBeUndefined();
    expect(mergeCssOpacity({ color: 'red' }, undefined)).toEqual({ color: 'red' });
    expect(mergeCssOpacity({ color: 'red' }, 0.5)).toEqual({ color: 'red', opacity: 0.5 });
  });

  it('blendStyleValues interpolates numbers and colors', () => {
    const from = { size: 10, color: '#ff0000', keep: 'a' };
    const to = { size: 20, color: '#00ff00', keep: 'b' };
    const result = blendStyleValues(from, to, 0.5);
    expect(result?.size).toBe(15);
    expect(result?.color).toBe('#808000');
    expect(result?.keep).toBe('b');
  });

  it('blendStyleValuesPartial only includes keys from target', () => {
    const from = { size: 10, color: '#ff0000' };
    const to = { size: 20, color: '#00ff00' };
    const result = blendStyleValuesPartial(from, to, 0.5);
    expect(result).toEqual({ size: 15, color: '#808000' });
  });

  it('resolveTransitionOpacity prefers explicit opacity and enabled flag', () => {
    expect(resolveTransitionOpacity(0.2, true)).toBe(0.2);
    expect(resolveTransitionOpacity(undefined, false)).toBe(0);
    expect(resolveTransitionOpacity(undefined, true)).toBe(1);
  });

  it('resolveEnabledByOpacity respects explicit opacity', () => {
    expect(resolveEnabledByOpacity(undefined)).toBe(true);
    expect(resolveEnabledByOpacity(0)).toBe(false);
    expect(resolveEnabledByOpacity(0.1)).toBe(true);
    expect(resolveEnabledByOpacity(undefined, false)).toBe(false);
  });
});

describe('resolveSceneTransition', () => {
  describe('dissolve (default)', () => {
    it('undefined prop + undefined exitStart → exit:[0.8,0.9] enter:[0.9,1.0]', () => {
      const result = resolveSceneTransition(undefined, undefined);
      expect(result).toEqual({ exit: [0.8, 0.9], enter: [0.9, 1.0] });
    });

    it("explicit 'dissolve' + no exitStart → same as undefined", () => {
      expect(resolveSceneTransition('dissolve', undefined)).toEqual({ exit: [0.8, 0.9], enter: [0.9, 1.0] });
    });

    it('exitStart=0.6 → mid=0.8, exit:[0.6,0.8] enter:[0.8,1.0]', () => {
      const result = resolveSceneTransition(undefined, 0.6);
      expect(result.exit?.[0]).toBeCloseTo(0.6);
      expect(result.exit?.[1]).toBeCloseTo(0.8);
      expect(result.enter?.[0]).toBeCloseTo(0.8);
      expect(result.enter?.[1]).toBeCloseTo(1.0);
    });

    it('exitStart=0.8 (default) → mid=0.9, exit:[0.8,0.9] enter:[0.9,1.0]', () => {
      const result = resolveSceneTransition(undefined, 0.8);
      expect(result.exit?.[0]).toBeCloseTo(0.8);
      expect(result.exit?.[1]).toBeCloseTo(0.9);
      expect(result.enter?.[0]).toBeCloseTo(0.9);
      expect(result.enter?.[1]).toBeCloseTo(1.0);
    });

    it('exitStart=0.9 → mid=0.95, exit:[0.9,0.95] enter:[0.95,1.0] — matches old DISSOLVE_TO_BLACK', () => {
      const result = resolveSceneTransition('dissolve', 0.9);
      expect(result.exit?.[0]).toBeCloseTo(0.9);
      expect(result.exit?.[1]).toBeCloseTo(0.95);
      expect(result.enter?.[0]).toBeCloseTo(0.95);
      expect(result.enter?.[1]).toBeCloseTo(1.0);
    });

    it('exitStart=0 → exit:[0,0.5] enter:[0.5,1.0] — lower bound is 0, not clamped', () => {
      const result = resolveSceneTransition(undefined, 0);
      expect(result.exit?.[0]).toBeCloseTo(0);
      expect(result.exit?.[1]).toBeCloseTo(0.5);
      expect(result.enter?.[0]).toBeCloseTo(0.5);
      expect(result.enter?.[1]).toBeCloseTo(1.0);
    });

    it('exitStart=1.0 → clamped to 0.99, mid=0.995', () => {
      const result = resolveSceneTransition(undefined, 1.0);
      expect(result.exit?.[0]).toBeCloseTo(0.99);
      expect(result.exit?.[1]).toBeCloseTo(0.995);
      expect(result.enter?.[0]).toBeCloseTo(0.995);
      expect(result.enter?.[1]).toBeCloseTo(1.0);
    });

    it('exitStart=-0.1 → clamped to 0', () => {
      const result = resolveSceneTransition(undefined, -0.1);
      expect(result.exit?.[0]).toBeCloseTo(0);
    });

    it('exitStart=1.5 → clamped to 0.99', () => {
      const result = resolveSceneTransition(undefined, 1.5);
      expect(result.exit?.[0]).toBeCloseTo(0.99);
    });

    it('default exitStart=0.8 when not provided', () => {
      const withDefault = resolveSceneTransition(undefined, undefined);
      const explicit = resolveSceneTransition(undefined, 0.8);
      expect(withDefault).toEqual(explicit);
    });
  });

  describe('crossfade', () => {
    it("'crossfade' → exit:[0,1] enter:[0,1]", () => {
      expect(resolveSceneTransition('crossfade', undefined)).toEqual({ exit: [0, 1], enter: [0, 1] });
    });

    it('crossfade ignores exitStart — always full-block windows', () => {
      // exitStart would be a TypeScript error in normal usage; test runtime behavior for safety
      // @ts-expect-error — testing runtime behavior with invalid prop combination
      const result = resolveSceneTransition('crossfade', 0.7);
      expect(result).toEqual({ exit: [0, 1], enter: [0, 1] });
    });
  });

  describe('raw TransitionWindow escape hatch', () => {
    it('raw window passes through by reference', () => {
      const raw: TransitionWindow = { exit: [0.7, 1.0], enter: [0.0, 0.3] };
      const result = resolveSceneTransition(raw, undefined);
      expect(result).toBe(raw); // strict referential identity — no copy
    });

    it('raw window with only exit defined passes through', () => {
      const raw: TransitionWindow = { exit: [0.5, 0.8] };
      expect(resolveSceneTransition(raw, undefined)).toBe(raw);
    });

    it('raw empty window passes through', () => {
      const raw: TransitionWindow = {};
      expect(resolveSceneTransition(raw, undefined)).toBe(raw);
    });
  });
});

describe('blendMaterialApplication', () => {
  it('returns undefined when both sides are undefined', () => {
    expect(blendMaterialApplication(undefined, undefined, 0.5)).toBeUndefined();
  });

  it('returns to when from is undefined', () => {
    const to: MaterialApplication = { colorMix: 0.8, brightness: 1.2 };
    expect(blendMaterialApplication(undefined, to, 0.5)).toBe(to);
  });

  it('returns from when to is undefined', () => {
    const from: MaterialApplication = { colorMix: 0.3 };
    expect(blendMaterialApplication(from, undefined, 0.5)).toBe(from);
  });

  it('lerps numeric fields correctly at t=0', () => {
    const from: MaterialApplication = { colorMix: 0, brightness: 1.0 };
    const to: MaterialApplication = { colorMix: 1, brightness: 2.0 };
    const result = blendMaterialApplication(from, to, 0)!;
    expect(result.colorMix).toBe(0);
    expect(result.brightness).toBe(1.0);
  });

  it('lerps numeric fields correctly at t=0.5', () => {
    const from: MaterialApplication = { colorMix: 0, brightness: 1.0, saturation: 0.5 };
    const to: MaterialApplication = { colorMix: 1, brightness: 2.0, saturation: 1.5 };
    const result = blendMaterialApplication(from, to, 0.5)!;
    expect(result.colorMix).toBe(0.5);
    expect(result.brightness).toBe(1.5);
    expect(result.saturation).toBe(1.0);
  });

  it('lerps numeric fields correctly at t=1', () => {
    const from: MaterialApplication = { colorMix: 0, contrast: -0.5 };
    const to: MaterialApplication = { colorMix: 1, contrast: 0.5 };
    const result = blendMaterialApplication(from, to, 1)!;
    expect(result.colorMix).toBe(1);
    expect(result.contrast).toBe(0.5);
  });

  it('blends tint color via blendColor (interpolation)', () => {
    const from: MaterialApplication = { tint: '#ff0000' };
    const to: MaterialApplication = { tint: '#00ff00' };
    const result = blendMaterialApplication(from, to, 0.5)!;
    expect(result.tint).toBe('#808000');
  });

  it('snaps tint from one defined side when other is undefined', () => {
    const from: MaterialApplication = { tint: '#ff0000' };
    const to: MaterialApplication = {};
    const result = blendMaterialApplication(from, to, 0.3)!;
    expect(result.tint).toBe('#ff0000');
  });

  it('inherits undefined fields from the defined side', () => {
    const from: MaterialApplication = { colorMix: 0.5 };
    const to: MaterialApplication = { brightness: 1.5 };
    const result = blendMaterialApplication(from, to, 0.5)!;
    // colorMix: only from has it → blendNumber(0.5, undefined) → 0.5
    expect(result.colorMix).toBe(0.5);
    // brightness: only to has it → blendNumber(undefined, 1.5) → 1.5
    expect(result.brightness).toBe(1.5);
  });

  it('leaves fields undefined when neither side defines them', () => {
    const from: MaterialApplication = { colorMix: 0.5 };
    const to: MaterialApplication = { colorMix: 1.0 };
    const result = blendMaterialApplication(from, to, 0.5)!;
    expect(result.saturation).toBeUndefined();
    expect(result.depthMix).toBeUndefined();
    expect(result.tint).toBeUndefined();
  });

  it('lerps iridescence fields', () => {
    const from: MaterialApplication = { iridescence: 0, iridescenceIOR: 1.0 };
    const to: MaterialApplication = { iridescence: 1, iridescenceIOR: 2.0 };
    const result = blendMaterialApplication(from, to, 0.5)!;
    expect(result.iridescence).toBe(0.5);
    expect(result.iridescenceIOR).toBe(1.5);
  });

  it('lerps iridescenceThicknessRange when both defined', () => {
    const from: MaterialApplication = { iridescenceThicknessRange: [100, 200] };
    const to: MaterialApplication = { iridescenceThicknessRange: [300, 500] };
    const result = blendMaterialApplication(from, to, 0.5)!;
    expect(result.iridescenceThicknessRange![0]).toBe(200);
    expect(result.iridescenceThicknessRange![1]).toBe(350);
  });

  it('inherits iridescenceThicknessRange from defined side', () => {
    const from: MaterialApplication = { iridescenceThicknessRange: [100, 400] };
    const to: MaterialApplication = {};
    const result = blendMaterialApplication(from, to, 0.7)!;
    expect(result.iridescenceThicknessRange).toEqual([100, 400]);
  });
});
