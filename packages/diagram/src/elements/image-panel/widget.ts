// ImagePanelWidget — implements ISceneElement<ImagePanelState> + IRenderable.
// Converts NVS position (nvsX, nvsY, z) to world-space before passing to ImagePanelRenderer.

import * as THREE from 'three';
import type { IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext } from '@brewsite/core';
import { nvsToWorldWithCamera, nvsToWorldAnalytic, computeWorldDimensionsFromCamera, computeWorldDimensions } from '@brewsite/core';
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

/** Default camera distance used when no live camera is available. */
const DEFAULT_DIST = 12.07;

export class ImagePanelWidget implements ISceneElement<ImagePanelState>, IRenderable<ImagePanelState> {
  readonly widgetId: string;
  readonly defaultState: ImagePanelState;
  readonly transitionSpec = functionalImagePanelTransitionSpec;
  readonly DslComponent = ImagePanel;

  private renderer = new ImagePanelRenderer();
  private scene: THREE.Scene | null = null;
  private cameraRef: THREE.PerspectiveCamera | null = null;

  constructor(widgetId: string, defaultState: ImagePanelState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene, camera }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    if (camera) this.cameraRef = camera;
  }

  apply(state: ImagePanelState, _ctx: WidgetRenderContext): void {
    if (!this.scene) return;

    // Convert NVS position to world-space using the live camera when available.
    const cam = this.cameraRef;
    const worldPos = cam
      ? nvsToWorldWithCamera(state.nvsX, state.nvsY, cam, state.z)
      : nvsToWorldAnalytic(state.nvsX, state.nvsY, 0, 0, DEFAULT_DIST, 45, 16 / 9, state.z);

    // Convert NVS width/height fractions to world units.
    let worldWidth: number;
    let worldHeight: number | undefined;
    if (cam) {
      const { worldWidth: ww, worldHeight: wh } = computeWorldDimensionsFromCamera(cam, state.z);
      worldWidth = state.nvsWidth * ww;
      worldHeight = state.nvsHeight !== undefined ? state.nvsHeight * wh : undefined;
    } else {
      const { worldWidth: ww, worldHeight: wh } = computeWorldDimensions(DEFAULT_DIST, 45, 16 / 9);
      worldWidth = state.nvsWidth * ww;
      worldHeight = state.nvsHeight !== undefined ? state.nvsHeight * wh : undefined;
    }

    this.renderer.update({
      ...state,
      position: worldPos,
      width: worldWidth,
      height: worldHeight,
    }, this.scene);
  }

  dispose(): void {
    if (!this.scene) return;
    this.renderer.dispose(this.widgetId, this.scene);
    this.scene = null;
    this.cameraRef = null;
  }
}
