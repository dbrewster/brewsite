import { describe, it, expect } from 'vitest';
import { EngineScrollRegion } from '../EngineScrollRegion';

describe('EngineScrollRegion', () => {
  const region = new EngineScrollRegion({ sceneCount: 5, subTickCount: 101, pixelsPerScene: 400 });
  const maxScroll = 5 * 400; // 2000

  describe('getScrollRegionHeightPx', () => {
    it('returns viewportHeight + sceneCount * pixelsPerScene', () => {
      expect(region.getScrollRegionHeightPx(800)).toBe(800 + 5 * 400);
    });

    it('handles zero viewport height', () => {
      expect(region.getScrollRegionHeightPx(0)).toBe(5 * 400);
    });

    it('handles non-standard viewport height', () => {
      expect(region.getScrollRegionHeightPx(1024)).toBe(1024 + 2000);
    });
  });

  describe('mapScrollToFrame', () => {
    it('maps scrollTop=0 to frameIndex=0 and progress=0', () => {
      const result = region.mapScrollToFrame(0, maxScroll);
      expect(result.frameIndex).toBe(0);
      expect(result.globalProgress).toBe(0);
    });

    it('maps scrollTop=maxScroll to frameIndex=100 (subTickCount-1) and progress=1', () => {
      const result = region.mapScrollToFrame(maxScroll, maxScroll);
      expect(result.frameIndex).toBe(100);
      expect(result.globalProgress).toBe(1);
    });

    it('maps mid-scroll to correct values', () => {
      const result = region.mapScrollToFrame(maxScroll / 2, maxScroll);
      expect(result.globalProgress).toBeCloseTo(0.5);
      expect(result.frameIndex).toBe(50);
    });

    it('clamps below 0', () => {
      const result = region.mapScrollToFrame(-100, maxScroll);
      expect(result.frameIndex).toBe(0);
      expect(result.globalProgress).toBe(0);
    });

    it('clamps above maxScroll', () => {
      const result = region.mapScrollToFrame(maxScroll + 500, maxScroll);
      expect(result.frameIndex).toBe(100);
      expect(result.globalProgress).toBe(1);
    });

    it('returns progress=0 when maxScroll=0 (avoids division by zero)', () => {
      const result = region.mapScrollToFrame(100, 0);
      expect(result.frameIndex).toBe(0);
      expect(result.globalProgress).toBe(0);
    });

    it('rounds frame index correctly at 1/4 position', () => {
      const result = region.mapScrollToFrame(maxScroll / 4, maxScroll);
      expect(result.globalProgress).toBeCloseTo(0.25);
      expect(result.frameIndex).toBe(25);
    });
  });

  describe('mapFrameToScroll', () => {
    it('maps frameIndex=0 to scrollTop=0', () => {
      expect(region.mapFrameToScroll(0, maxScroll)).toBe(0);
    });

    it('maps frameIndex=100 (subTickCount-1) to maxScroll', () => {
      expect(region.mapFrameToScroll(100, maxScroll)).toBe(maxScroll);
    });

    it('maps mid-frame to mid-scroll', () => {
      expect(region.mapFrameToScroll(50, maxScroll)).toBeCloseTo(maxScroll / 2);
    });
  });

  describe('round-trip consistency', () => {
    it('mapScrollToFrame and mapFrameToScroll are inverse operations', () => {
      for (const scrollTop of [0, 500, 1000, 1500, 2000]) {
        const { frameIndex } = region.mapScrollToFrame(scrollTop, maxScroll);
        const recovered = region.mapFrameToScroll(frameIndex, maxScroll);
        // Allow rounding error from frame index quantization
        expect(Math.abs(recovered - scrollTop)).toBeLessThanOrEqual(maxScroll / (101 - 1) + 1);
      }
    });
  });

  describe('single-scene edge case', () => {
    const singleScene = new EngineScrollRegion({
      sceneCount: 1,
      subTickCount: 1,
      pixelsPerScene: 400,
    });

    it('handles subTickCount=1 without division by zero', () => {
      const result = singleScene.mapScrollToFrame(200, 400);
      expect(result.frameIndex).toBe(0);
      expect(result.globalProgress).toBeCloseTo(0.5);
    });

    it('mapFrameToScroll with subTickCount=1 returns 0', () => {
      expect(singleScene.mapFrameToScroll(0, 400)).toBe(0);
    });
  });
});
