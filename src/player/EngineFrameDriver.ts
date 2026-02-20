import type { SceneTrackTick } from '../compiler/sceneTrackTypes';
import type { EngineFrameState } from './engineTypes';

export class EngineFrameDriver {
  private lastIndex = -1;
  private readonly onFrameChange: (state: EngineFrameState) => void;

  constructor(onFrameChange: (state: EngineFrameState) => void) {
    this.onFrameChange = onFrameChange;
  }

  handleTick(tick: SceneTrackTick | null): void {
    if (!tick) return;
    if (tick.index === this.lastIndex) return;
    this.lastIndex = tick.index;
    this.onFrameChange({
      tickIndex: tick.index,
      progress: tick.progress,
      sceneId: tick.sceneId,
      sceneIndex: tick.sceneIndex,
      sceneProgress: tick.sceneProgress,
      tick,
    });
  }

  reset(): void {
    this.lastIndex = -1;
  }
}
