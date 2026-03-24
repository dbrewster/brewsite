// slidesPlugin() — registers slide widgets and DSL handlers.

import { registerNode } from '@brewsite/core';
import type { WidgetPlugin } from '@brewsite/core';
import { SlideMetaWidget } from './widget/SlideMetaWidget';
import { SlideNavWidget } from './widget/SlideNavWidget';

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

/**
 * WidgetPlugin factory for @brewsite/slides.
 * Registers SlideMetaWidget and SlideNavWidget.
 *
 * Takes no arguments — visual tokens come from SceneTheme via core's ThemeContext.
 * Behavioral tokens come from SlideTheme via SlidePlayer's container CSS vars.
 */
/** Widget ID for SlideMetaWidget — matches SlideMetaWidget.widgetId. */
const SLIDE_META_WIDGET_ID = 'slide-meta';

export function slidesPlugin(): WidgetPlugin {
  return {
    createWidgets: () => [new SlideMetaWidget(), new SlideNavWidget()],

    registerHandlers: () => {
      registerNode(SlideMetaDsl, (node, api) => {
        const props = node.props as SlideMetaDslProps;
        api.setWidgetState(SLIDE_META_WIDGET_ID, {
          slideKey: props.slideKey,
          logicalIndex: props.logicalIndex,
          totalSlides: props.totalSlides,
          notes: props.notes,
          title: props.title,
          hasAnimatedList: props.hasAnimatedList,
          totalBullets: props.totalBullets,
        } satisfies import('./widget/SlideMetaWidget').SlideMetaState);
      }, { category: 'ambient' });
    },

    configureRegistry: (_registry) => {
      // No registry configuration needed.
    },
  };
}
