// packages/slides/src/widget/SlideNavWidget.ts
// Registry anchor widget for the slide navigation widgetId.

import type { IWidget } from '@brewsite/core';

/**
 * Slide navigation widget — registry anchor only.
 *
 * SlideNavWidget does NOT participate in the SceneTrack compilation pipeline.
 * It is registered as a plain `IWidget` and serves as a stable widgetId anchor
 * for the slide navigation system.
 *
 * Actual navigation (keyboard, pointer, touch) is implemented at the React layer
 * inside `SlidePlayerInner` via `useSlideNavigation` — it calls
 * `engine.scrollToProgress()`, not any Three.js action. `<InputController>` DSL
 * is not used because `SceneEngine` runs with `inputModePolicy="direct"` in
 * `SlidePlayer`, disabling the engine's scroll-based scene advancement pipeline.
 */
export class SlideNavWidget implements IWidget {
  readonly widgetId = 'slide-nav';
}
