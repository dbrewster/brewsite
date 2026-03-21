// Tests for parseLength and parseAngle — pure string parsing.

import { describe, expect, it } from 'vitest';
import { parseAngle, parseLength } from '../parse';
import type { SceneAngle, SceneLength } from '../types';

describe('parseLength', () => {
  describe('valid spatial values', () => {
    it('parses "0.15u" → { value: 0.15, unit: "u" }', () => {
      expect(parseLength('0.15u')).toEqual({ value: 0.15, unit: 'u' });
    });

    it('parses "50%" → { value: 50, unit: "%" }', () => {
      expect(parseLength('50%')).toEqual({ value: 50, unit: '%' });
    });

    it('parses "15vw" → { value: 15, unit: "vw" }', () => {
      expect(parseLength('15vw')).toEqual({ value: 15, unit: 'vw' });
    });

    it('parses "15vh" → { value: 15, unit: "vh" }', () => {
      expect(parseLength('15vh')).toEqual({ value: 15, unit: 'vh' });
    });
  });

  describe('zero values', () => {
    it('parses literal 0 → { value: 0, unit: "u" }', () => {
      expect(parseLength(0)).toEqual({ value: 0, unit: 'u' });
    });

    it('parses "0u" → { value: 0, unit: "u" }', () => {
      expect(parseLength('0u')).toEqual({ value: 0, unit: 'u' });
    });

    it('parses "0%" → { value: 0, unit: "%" }', () => {
      expect(parseLength('0%')).toEqual({ value: 0, unit: '%' });
    });

    it('parses "0vw" → { value: 0, unit: "vw" }', () => {
      expect(parseLength('0vw')).toEqual({ value: 0, unit: 'vw' });
    });

    it('parses "0vh" → { value: 0, unit: "vh" }', () => {
      expect(parseLength('0vh')).toEqual({ value: 0, unit: 'vh' });
    });
  });

  describe('negative values', () => {
    it('parses "-5u" → { value: -5, unit: "u" }', () => {
      expect(parseLength('-5u')).toEqual({ value: -5, unit: 'u' });
    });

    it('parses "-10%" → { value: -10, unit: "%" }', () => {
      expect(parseLength('-10%')).toEqual({ value: -10, unit: '%' });
    });
  });

  describe('float variants', () => {
    it('parses "15.5u"', () => {
      expect(parseLength('15.5u')).toEqual({ value: 15.5, unit: 'u' });
    });

    it('parses ".5u"', () => {
      expect(parseLength('.5u')).toEqual({ value: 0.5, unit: 'u' });
    });

    it('parses "0.001u"', () => {
      expect(parseLength('0.001u')).toEqual({ value: 0.001, unit: 'u' });
    });
  });

  describe('large values', () => {
    it('parses "200vw"', () => {
      expect(parseLength('200vw')).toEqual({ value: 200, unit: 'vw' });
    });

    it('parses "999vh"', () => {
      expect(parseLength('999vh')).toEqual({ value: 999, unit: 'vh' });
    });
  });

  describe('invalid values', () => {
    it('rejects bare number string "15"', () => {
      expect(() => parseLength('15' as SceneLength)).toThrow('Invalid SceneLength');
    });

    it('rejects unknown unit "15px"', () => {
      expect(() => parseLength('15px' as SceneLength)).toThrow('Invalid SceneLength');
    });

    it('rejects empty string', () => {
      expect(() => parseLength('' as SceneLength)).toThrow('Invalid SceneLength');
    });

    it('rejects "abc"', () => {
      expect(() => parseLength('abc' as SceneLength)).toThrow('Invalid SceneLength');
    });

    it('rejects whitespace " 15u "', () => {
      expect(() => parseLength(' 15u ' as SceneLength)).toThrow('Invalid SceneLength');
    });

    it('rejects scientific notation "1e2u"', () => {
      expect(() => parseLength('1e2u' as SceneLength)).toThrow('Invalid SceneLength');
    });
  });
});

describe('parseAngle', () => {
  describe('valid angle values', () => {
    it('parses "45deg" → { value: 45, unit: "deg" }', () => {
      expect(parseAngle('45deg')).toEqual({ value: 45, unit: 'deg' });
    });

    it('parses "0.78rad" → { value: 0.78, unit: "rad" }', () => {
      expect(parseAngle('0.78rad')).toEqual({ value: 0.78, unit: 'rad' });
    });

    it('parses literal 0 → { value: 0, unit: "deg" }', () => {
      expect(parseAngle(0)).toEqual({ value: 0, unit: 'deg' });
    });

    it('parses "0deg" → { value: 0, unit: "deg" }', () => {
      expect(parseAngle('0deg')).toEqual({ value: 0, unit: 'deg' });
    });

    it('parses "0rad" → { value: 0, unit: "rad" }', () => {
      expect(parseAngle('0rad')).toEqual({ value: 0, unit: 'rad' });
    });
  });

  describe('negative angles', () => {
    it('parses "-45deg"', () => {
      expect(parseAngle('-45deg')).toEqual({ value: -45, unit: 'deg' });
    });

    it('parses "-1.57rad"', () => {
      expect(parseAngle('-1.57rad')).toEqual({ value: -1.57, unit: 'rad' });
    });
  });

  describe('invalid angle values', () => {
    it('rejects bare number string "45"', () => {
      expect(() => parseAngle('45' as SceneAngle)).toThrow('Invalid SceneAngle');
    });

    it('rejects unknown unit "45turns"', () => {
      expect(() => parseAngle('45turns' as SceneAngle)).toThrow('Invalid SceneAngle');
    });

    it('rejects empty string', () => {
      expect(() => parseAngle('' as SceneAngle)).toThrow('Invalid SceneAngle');
    });

    it('rejects scientific notation "1e2deg"', () => {
      expect(() => parseAngle('1e2deg' as SceneAngle)).toThrow('Invalid SceneAngle');
    });
  });
});
