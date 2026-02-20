import type { AnimationTickContext, IAnimationController } from '../widget/types';

/**
 * SceneMetaWidget: publishes scene identity and optional scene meta fields
 * to the VariableStore, and fires onSceneChange when the scene id changes.
 */
export class SceneMetaWidget implements IAnimationController {
  readonly widgetId = '__scene_meta__';
  readonly tickPriority = -1000;

  private lastSceneId: string | null = null;
  private lastMetaKeys = new Set<string>();
  private onSceneChange?: (sceneId: string, sceneIndex: number) => void;

  constructor(options?: { onSceneChange?: (sceneId: string, sceneIndex: number) => void }) {
    this.onSceneChange = options?.onSceneChange;
  }

  onTick({ variables, tick }: AnimationTickContext): void {
    if (!tick) return;

    const sceneId = tick.sceneId;
    const sceneIndex = tick.sceneIndex;
    const sceneProgress = tick.sceneProgress;

    variables.set('scene', 'id', sceneId);
    variables.set('scene', 'index', sceneIndex);
    variables.set('scene', 'progress', sceneProgress);

    const meta = tick.state.meta;
    if (meta) {
      const nextKeys = new Set(Object.keys(meta));
      for (const key of nextKeys) {
        variables.set('scene', key, meta[key]);
      }
      for (const key of this.lastMetaKeys) {
        if (!nextKeys.has(key)) {
          variables.set('scene', key, null);
        }
      }
      this.lastMetaKeys = nextKeys;
    } else if (this.lastMetaKeys.size > 0) {
      for (const key of this.lastMetaKeys) {
        variables.set('scene', key, null);
      }
      this.lastMetaKeys.clear();
    }

    if (sceneId !== this.lastSceneId) {
      this.lastSceneId = sceneId;
      this.onSceneChange?.(sceneId, sceneIndex);
    }
  }
}
