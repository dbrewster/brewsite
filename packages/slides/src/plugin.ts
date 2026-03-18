// packages/slides/src/plugin.ts
// slidesPlugin() — registers slide widgets and DSL handlers into a WidgetPlugin.

import { registerNode } from '@brewsite/core';
import type { WidgetPlugin } from '@brewsite/core';
import { SlideMetaWidget } from './widget/SlideMetaWidget';
import { SlideNavWidget } from './widget/SlideNavWidget';
import type { ResolvedDeckTheme, SlideNavigationConfig } from './types';

// ─── SlideMetaDsl (internal marker component) ────────────────────────────────

/**
 * Props for the internal `<SlideMetaDsl>` DSL marker node.
 * Authored by `buildSceneElements()` in deckCompiler.ts; consumed by the
 * SlideMetaWidget NodeHandler registered below.
 */
export type SlideMetaDslProps = {
  id: string;
  slideKey: string;
  logicalIndex: number;
  totalSlides: number;
  notes?: string;
  title?: string;
  hasAnimatedList: boolean;
  totalBullets: number;
};

/**
 * Internal DSL marker node. Read by SlideMetaWidget's NodeHandler at compile time.
 * Returns null — compiled, not rendered.
 */
export const SlideMetaDsl = (_props: SlideMetaDslProps): null => null;
SlideMetaDsl.displayName = 'SlideMetaDsl';

// ─── Plugin options ───────────────────────────────────────────────────────────

/**
 * Options passed to `slidesPlugin()`.
 */
export type SlidesPluginOptions = {
  /** Resolved deck theme (produced by themeCompiler.ts). */
  theme: ResolvedDeckTheme;
  /** Optional navigation configuration forwarded from SlidePlayer. */
  navigation?: SlideNavigationConfig;
};

/**
 * WidgetPlugin factory for `@brewsite/slides`.
 *
 * Registers `SlideMetaWidget` (publishes per-slide metadata to VariableStore)
 * and `SlideNavWidget` (registry anchor for the slide navigation widgetId).
 *
 * Usage:
 * ```tsx
 * <SceneEngine
 *   plugins={[corePlugin(), slidesPlugin({ theme: resolvedTheme })]}
 * />
 * ```
 */
export function slidesPlugin(options: SlidesPluginOptions): WidgetPlugin {
  const metaWidget = new SlideMetaWidget();

  return {
    createWidgets: () => [metaWidget, new SlideNavWidget()],

    registerHandlers: () => {
      registerNode(SlideMetaDsl, (node, api) => {
        const props = node.props as SlideMetaDslProps;
        api.setWidgetState(metaWidget.widgetId, {
          slideKey: props.slideKey,
          logicalIndex: props.logicalIndex,
          totalSlides: props.totalSlides,
          notes: props.notes,
          title: props.title,
          hasAnimatedList: props.hasAnimatedList,
          totalBullets: props.totalBullets,
        } satisfies import('./widget/SlideMetaWidget').SlideMetaState);
      });
    },

    configureRegistry: (_registry) => {
      // No registry configuration needed.
      //
      // ARCHITECTURE NOTE: Slide navigation (keyboard, pointer, touch) is implemented
      // at the React layer inside SlidePlayerInner via useEffect + onClick handlers
      // (see §8 SlidePlayer.tsx). It does NOT use <InputController> DSL or the 3D
      // input pipeline. Reasons:
      //
      // 1. Slide navigation is a pure React concern — it calls engine.scrollToProgress(),
      //    not a Three.js camera action.
      // 2. SceneEngine uses inputModePolicy="direct", so the engine's scroll-based
      //    scene advancement is disabled. No InputController actions needed.
      // 3. <InputController> speaks in terms of camera actions (orbit, dolly, focus).
      //    "next slide" is not a camera action — it is a React navigation callback.
      //
      // SlideNavWidget is registered as a plain IWidget (registry anchor only);
      // it does not participate in the SceneTrack pipeline.
    },
  };
}
