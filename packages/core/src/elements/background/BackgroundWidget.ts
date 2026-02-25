// BackgroundWidget — ISceneElement + IRenderable (simple prop-only DSL, no children).
// Wraps compile.ts transition spec and render.ts DOM logic into the widget SDK.
// Background rendering targets a DOM element, not a Three.js scene.

import type {
  ISceneElement,
  IRenderable,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../widget/types';
import type { SceneBackground } from './types';
import { DEFAULT_BACKGROUND, functionalBackgroundTransitionSpec } from './compile';
import { Background } from './dsl';
import { applyBackground } from './render';

export class BackgroundWidget implements ISceneElement<SceneBackground>, IRenderable<SceneBackground> {
  readonly widgetId = 'background';
  readonly defaultState: SceneBackground = DEFAULT_BACKGROUND;
  readonly transitionSpec = functionalBackgroundTransitionSpec;
  readonly DslComponent = Background;
  readonly useDefaultStateWhenAbsent = false;

  mergeSnapshot(
    prev: SceneBackground | undefined,
    next: SceneBackground | undefined,
  ): SceneBackground | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev;
    return { ...prev, ...next } as SceneBackground;
  }

  /** DOM element for background rendering; set by engine layer after initialization. */
  private domElement: HTMLElement | null = null;

  initialize(_ctx: WidgetInitContext): void {
    // Scene (THREE.Scene) not used for DOM background rendering.
    // domElement is provided separately via setDomElement().
  }

  /**
   * Attach a DOM element for background rendering.
   * Called by the engine layer after initialization.
   */
  setDomElement(element: HTMLElement | null): void {
    this.domElement = element;
  }

  apply(state: SceneBackground, _ctx: WidgetRenderContext): void {
    if (!this.domElement) return;
    applyBackground(state, { element: this.domElement });
  }

  dispose(): void {
    this.domElement = null;
  }
}
