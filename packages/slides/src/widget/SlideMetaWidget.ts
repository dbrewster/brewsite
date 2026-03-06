// packages/slides/src/widget/SlideMetaWidget.ts
// Publishes slide metadata (notes, title, logical index, sceneProgress) to VariableStore each tick.

import type {
  IWidget,
  ISceneElement,
  IRenderable,
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { VariableStore } from '@brewsite/core';
import { SlideMetaDsl } from '../plugin';

/** INVARIANT: same namespace used by useSlideNotes hook and SlideContentWithProgress. */
export const SLIDE_META_NAMESPACE = 'slide:meta';

/**
 * Compiled state for a single slide's metadata.
 * Produced by the SlideMetaDsl NodeHandler in plugin.ts.
 */
export type SlideMetaState = {
  /** The stable slide key (= Scene id). */
  slideKey: string;
  /** 0-based logical slide index. Used by progress indicator. */
  logicalIndex: number;
  /** Total logical slide count for this deck. */
  totalSlides: number;
  /** Speaker notes. Undefined when no notes were authored. */
  notes: string | undefined;
  /** Slide title. */
  title: string | undefined;
  /** Whether this slide has an animated bullet/number list. */
  hasAnimatedList: boolean;
  /** Total animated bullet count (for sceneProgress-based reveals). */
  totalBullets: number;
};

/**
 * Functional transition spec for SlideMetaState.
 * Metadata does not animate — snap to the target state immediately.
 */
export const slideMeta_FunctionalTransitionSpec: FunctionalTransitionSpec<SlideMetaState> = {
  // Snap to fromState — metadata doesn't need to animate on exit.
  exitFn: (from) => (_ctx) => from,
  // Snap to toState — metadata is available immediately on enter.
  enterFn: (to) => (_ctx) => to,
  // Snap to toState — no interpolation needed between slide metadata.
  interpolateFn: (_from, to) => (_ctx) => to,
};

/**
 * Publishes slide metadata to VariableStore on every `apply()` call.
 *
 * Published keys (all under the `'slide:meta'` namespace):
 * - `currentSlideKey`         — string: stable key of the active slide
 * - `currentLogicalIndex`     — number: 0-based logical slide index
 * - `totalSlides`             — number: total logical slide count
 * - `{slideKey}.notes`        — string | null: speaker notes
 * - `{slideKey}.title`        — string | null: slide title
 * - `{slideKey}.hasAnimatedList` — 0 | 1: animated list flag
 * - `{slideKey}.totalBullets` — number: animated bullet count
 * - `{slideKey}.sceneProgress` — number [0,1]: within-scene progress (Decision A Option C)
 *
 * One instance per deck; shared across all slides (state varies per-scene in SceneTrack).
 */
export class SlideMetaWidget
  implements IWidget, ISceneElement<SlideMetaState>, IRenderable<SlideMetaState>
{
  readonly widgetId = 'slide-meta';
  readonly DslComponent = SlideMetaDsl;
  readonly transitionSpec = slideMeta_FunctionalTransitionSpec;

  readonly defaultState: SlideMetaState = {
    slideKey: '',
    logicalIndex: 0,
    totalSlides: 1,
    notes: undefined,
    title: undefined,
    hasAnimatedList: false,
    totalBullets: 0,
  };

  initialize(_context: WidgetInitContext): void {
    // No Three.js setup required — SlideMetaWidget only writes to VariableStore.
  }

  apply(state: SlideMetaState, ctx: WidgetRenderContext): void {
    // VariableStoreReader is the declared type of ctx.variables. Cast to the
    // concrete VariableStore to access the write-capable set() method.
    // This is the documented pattern for widgets that write to the store.
    const store = ctx.variables as unknown as VariableStore;
    store.set(SLIDE_META_NAMESPACE, 'currentSlideKey', state.slideKey);
    store.set(SLIDE_META_NAMESPACE, 'currentLogicalIndex', state.logicalIndex);
    store.set(SLIDE_META_NAMESPACE, 'totalSlides', state.totalSlides);
    store.set(SLIDE_META_NAMESPACE, `${state.slideKey}.notes`, state.notes ?? null);
    store.set(SLIDE_META_NAMESPACE, `${state.slideKey}.title`, state.title ?? null);
    store.set(SLIDE_META_NAMESPACE, `${state.slideKey}.hasAnimatedList`, state.hasAnimatedList ? 1 : 0);
    store.set(SLIDE_META_NAMESPACE, `${state.slideKey}.totalBullets`, state.totalBullets);
    // sceneProgress is read from tick.sceneProgress (Decision A, Option C in §7).
    // Defaults to blockProgress when sceneProgress is absent (backward compat).
    const sp = (ctx.tick as { sceneProgress?: number } | null | undefined)?.sceneProgress ?? 0;
    store.set(SLIDE_META_NAMESPACE, `${state.slideKey}.sceneProgress`, sp);
  }

  dispose(): void {
    // No Three.js resources to release.
  }
}
