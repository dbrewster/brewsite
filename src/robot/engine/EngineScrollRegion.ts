/**
 * Pure pixel-to-frame scroll math. No DOM, no React, fully testable.
 *
 * maxScroll = sceneCount * pixelsPerScene.
 * Using sceneCount as the unit (not subTickCount) keeps scroll density stable
 * across quality-tier recompiles where subTickCount changes.
 */
export class EngineScrollRegion {
  private readonly sceneCount: number;
  private readonly subTickCount: number;
  private readonly pixelsPerScene: number;

  constructor(config: { sceneCount: number; subTickCount: number; pixelsPerScene: number }) {
    this.sceneCount = config.sceneCount;
    this.subTickCount = config.subTickCount;
    this.pixelsPerScene = config.pixelsPerScene;
  }

  /**
   * Height of the fake scroll spacer div.
   * = viewportHeight + (sceneCount * pixelsPerScene)
   */
  getScrollRegionHeightPx(viewportHeight: number): number {
    return viewportHeight + this.sceneCount * this.pixelsPerScene;
  }

  /**
   * scrollTop → { frameIndex, globalProgress }
   * progress = clamp01(scrollTop / maxScroll)
   * frameIndex = Math.round(progress * (subTickCount - 1))
   * Matches sceneTrackSampler.sample() exactly.
   */
  mapScrollToFrame(
    scrollTop: number,
    maxScroll: number,
  ): { frameIndex: number; globalProgress: number } {
    const progress = maxScroll > 0 ? Math.max(0, Math.min(1, scrollTop / maxScroll)) : 0;
    const frameIndex = Math.round(progress * Math.max(0, this.subTickCount - 1));
    return { frameIndex, globalProgress: progress };
  }

  /**
   * frameIndex → scrollTop (for scrubber write path).
   */
  mapFrameToScroll(frameIndex: number, maxScroll: number): number {
    const maxFrame = Math.max(1, this.subTickCount - 1);
    const progress = Math.max(0, Math.min(1, frameIndex / maxFrame));
    return progress * maxScroll;
  }
}
