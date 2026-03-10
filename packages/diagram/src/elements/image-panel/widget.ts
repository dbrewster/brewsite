// ImagePanelWidget — implements ISceneElement<ImagePanelState> + IRenderable.
// Converts NVS position (nvsX, nvsY, z) to world-space before passing to ImagePanelRenderer.

import * as THREE from 'three';
import type { IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext } from '@brewsite/core';
import { validateNVSScalar } from '@brewsite/core';
import type { ImagePanelProps } from './dsl';
import { functionalImagePanelTransitionSpec } from './compile';
import { ImagePanelRenderer } from './render';
import type { ImagePanelState } from './types';

/**
 * Renders a static image as a physical 3D floating panel in world space.
 * The image is a WebGL texture — fully supports tilt, lighting, and reflections.
 * For a live interactive website, use <Screen>.
 */
export function ImagePanel(_props: ImagePanelProps): null {
  return null;
}

export class ImagePanelWidget implements ISceneElement<ImagePanelState>, IRenderable<ImagePanelState> {
  readonly widgetId: string;
  readonly defaultState: ImagePanelState;
  readonly transitionSpec = functionalImagePanelTransitionSpec;
  readonly DslComponent = ImagePanel;

  private renderer = new ImagePanelRenderer();
  private scene: THREE.Scene | null = null;

  constructor(widgetId: string, defaultState: ImagePanelState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
  }

  apply(state: ImagePanelState, context: WidgetRenderContext): void {
    if (!this.scene) return;

    if (process.env.NODE_ENV !== 'production') {
      validateNVSScalar(state.nvsX, 'nvsX', `ImagePanelWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsY, 'nvsY', `ImagePanelWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsWidth, 'nvsWidth', `ImagePanelWidget(${this.widgetId})`);
      if (state.nvsHeight !== undefined) {
        validateNVSScalar(state.nvsHeight, 'nvsHeight', `ImagePanelWidget(${this.widgetId})`);
      }
    }

    // Convert NVS position to world-space using the per-frame coord service.
    const [worldX, worldY, worldZ] = context.coords.toWorld(state.nvsX, state.nvsY, state.z);

    // Convert NVS width/height fractions to world units.
    // Pass a placeholder for the height arg when nvsHeight is undefined so we can ignore it.
    const [worldW, worldH] = context.coords.toWorldSize(
      state.nvsWidth,
      state.nvsHeight ?? state.nvsWidth,
    );
    const worldHeight = state.nvsHeight !== undefined ? worldH : undefined;

    this.renderer.update({
      ...state,
      position: [worldX, worldY, worldZ],
      width: worldW,
      height: worldHeight,
    }, this.scene);
  }

  dispose(): void {
    if (!this.scene) return;
    this.renderer.dispose(this.widgetId, this.scene);
    this.scene = null;
  }
}
