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
  readonly disableWhenAbsent = true;

  /** Root Three.js group — all WebGL panel content is parented under this. */
  private readonly rootGroup = new THREE.Group();

  /** Root Three.js object for runtime absent-widget visibility management. */
  get rootObject(): THREE.Group { return this.rootGroup; }

  private renderer = new ImagePanelRenderer();
  private scene: THREE.Scene | null = null;

  // ── Stable world scale cache (immune to camera zoom) ──────────────────────
  // Cache world-space dimensions keyed on NVS size. Only recompute when the
  // NVS size changes (scene transition), NOT when the camera zooms. This
  // ensures image panels are fixed 3D objects that scale naturally with camera.
  private cachedWorldScale: {
    nvsW: number; nvsH: number;
    worldW: number; worldH: number;
  } | null = null;

  constructor(widgetId: string, defaultState: ImagePanelState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    this.scene.add(this.rootGroup);
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
    // Position is always live so the panel stays anchored at its NVS viewport slot.
    const [worldX, worldY, worldZ] = context.coords.toWorld(state.nvsX, state.nvsY, state.z);

    // ── Stable world scale (locked to NVS size, immune to camera zoom) ──
    // Cache world-space dimensions and only recompute when the NVS size changes
    // (scene transition), NOT when the camera zooms. This ensures image panels
    // are fixed 3D objects that scale naturally with the camera.
    const nvsW = state.nvsWidth;
    const nvsH = state.nvsHeight ?? state.nvsWidth;
    const cached = this.cachedWorldScale;
    let worldW: number;
    let worldH: number;
    if (cached && cached.nvsW === nvsW && cached.nvsH === nvsH) {
      worldW = cached.worldW;
      worldH = cached.worldH;
    } else if (state.uniformSizing) {
      const uniform = Math.min(context.coords.visibleWorldWidth, context.coords.visibleWorldHeight);
      worldW = nvsW * uniform;
      worldH = nvsH * uniform;
      this.cachedWorldScale = { nvsW, nvsH, worldW, worldH };
    } else {
      [worldW, worldH] = context.coords.toWorldSize(nvsW, nvsH);
      this.cachedWorldScale = { nvsW, nvsH, worldW, worldH };
    }
    const worldHeight = state.nvsHeight !== undefined ? worldH : undefined;

    this.renderer.update({
      ...state,
      position: [worldX, worldY, worldZ],
      width: worldW,
      height: worldHeight,
    }, this.rootGroup as unknown as THREE.Scene);
  }

  dispose(): void {
    if (!this.scene) return;
    this.renderer.dispose(this.widgetId, this.rootGroup as unknown as THREE.Scene);
    this.scene.remove(this.rootGroup);
    this.scene = null;
    this.cachedWorldScale = null;
  }
}
