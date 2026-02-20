import type { SceneTrackSampler } from '../runtime/compiler/sceneTrackSampler';
import type { EngineFrameState } from './engineTypes';

export type EngineFrameDriverOptions = {
  sampler: SceneTrackSampler;
  onScrollFrameChange: (state: EngineFrameState) => void;
};

/**
 * Frame-change detection for the scroll-driven 3D scene engine.
 *
 * Sits in the RuntimeLoop.onAfterTick callback. Samples the SceneTrack at the
 * current global progress and notifies onScrollFrameChange only when the compiled
 * frame index changes — keeping React re-renders cheap.
 *
 * Wall-time animations (breathing, idle) advance on every RAF tick via the
 * RuntimeDriver.tick() call that RuntimeLoop manages separately.
 */
export class EngineFrameDriver {
  private readonly sampler: SceneTrackSampler;
  private readonly onScrollFrameChange: (state: EngineFrameState) => void;
  private lastFrameIndex: number | null = null;

  constructor(options: EngineFrameDriverOptions) {
    this.sampler = options.sampler;
    this.onScrollFrameChange = options.onScrollFrameChange;
  }

  /**
   * Called every RAF (via RuntimeLoop.onAfterTick).
   * Notifies onScrollFrameChange only when frameIndex changes.
   */
  tick(options: { globalProgress: number; wallTimeSeconds: number }): void {
    const { globalProgress, wallTimeSeconds } = options;
    const tick = this.sampler.sample(globalProgress);
    const frameIndex = tick.index;

    if (frameIndex !== this.lastFrameIndex || this.lastFrameIndex === null) {
      this.lastFrameIndex = frameIndex;
      this.onScrollFrameChange({ frameIndex, globalProgress, wallTimeSeconds, tick });
    }
  }

  /** Reset frame tracking — forces re-notification on the next tick. */
  reset(): void {
    this.lastFrameIndex = null;
  }
}
