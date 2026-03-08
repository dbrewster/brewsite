// ScreenWidget — implements ISceneElement<ScreenState> + IRenderable.
// Converts NVS position (nvsX, nvsY, z) to world-space before passing to ScreenRenderer.

import * as THREE from 'three';
import type { IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext } from '@brewsite/core';
import { nvsToWorldWithCamera, computeWorldDimensionsFromCamera } from '@brewsite/core';
import type { ScreenProps } from './dsl';
import { functionalScreenTransitionSpec } from './compile';
import { ScreenRenderer } from './render';
import type { ScreenState } from './types';

/**
 * Renders a live interactive website inside a physical 3D bezel frame.
 * The website is a real <iframe> — click, scroll, and interact normally.
 * The bezel and glow are WebGL objects that track the screen position.
 * The 3D scene renders behind the screen. The iframe faces the camera.
 * For a static image, use <ImagePanel> instead.
 */
export function Screen(_props: ScreenProps): null {
  return null;
}

const OVERLAY_ATTR = 'data-brewsite-screen-overlay';

export class ScreenWidget implements ISceneElement<ScreenState>, IRenderable<ScreenState> {
  readonly widgetId: string;
  readonly defaultState: ScreenState;
  readonly transitionSpec = functionalScreenTransitionSpec;
  readonly DslComponent = Screen;

  private renderer: ScreenRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private cameraRef: THREE.PerspectiveCamera | null = null;
  private webglRenderer: THREE.WebGLRenderer | null = null;

  constructor(widgetId: string, defaultState: ScreenState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene, renderer, camera }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    if (camera) this.cameraRef = camera;
    this.webglRenderer = (renderer as THREE.WebGLRenderer) ?? null;
    const overlay = this.ensureOverlayContainer();
    this.renderer = new ScreenRenderer(overlay);
  }

  apply(state: ScreenState, _ctx: WidgetRenderContext): void {
    if (!this.scene || !this.renderer) return;
    const camera = this.cameraRef;
    const canvas = this.webglRenderer?.domElement ?? null;
    if (!camera || !canvas) {
      console.warn(`ScreenWidget(${this.widgetId}): missing camera or canvas for iframe projection.`);
      return;
    }

    // Convert NVS position to world-space.
    const worldPos = nvsToWorldWithCamera(state.nvsX, state.nvsY, camera, state.z);

    // Convert NVS width/height fractions to world units.
    const { worldWidth: ww, worldHeight: wh } = computeWorldDimensionsFromCamera(camera, state.z);
    const worldWidth = state.nvsWidth * ww;
    // For height: if nvsHeight is provided use it; otherwise derive from 16:9.
    const worldHeight = state.nvsHeight !== undefined
      ? state.nvsHeight * wh
      : worldWidth * (9 / 16);

    const rect = canvas.getBoundingClientRect();
    this.renderer.update({
      ...state,
      position: worldPos,
      width: worldWidth,
      height: worldHeight,
    }, this.scene, camera, rect);
  }

  dispose(): void {
    if (!this.scene || !this.renderer) return;
    this.renderer.dispose(this.widgetId, this.scene);
    this.scene = null;
    this.cameraRef = null;
    this.renderer = null;
  }

  private ensureOverlayContainer(): HTMLDivElement {
    const canvas = this.webglRenderer?.domElement ?? null;
    const parent = canvas?.parentElement ?? null;
    if (!parent) {
      const fallback = document.createElement('div');
      return fallback;
    }

    const existing = parent.querySelector<HTMLDivElement>(`[${OVERLAY_ATTR}]`);
    if (existing) return existing;

    const overlay = document.createElement('div');
    overlay.setAttribute(OVERLAY_ATTR, 'true');
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '3';
    parent.appendChild(overlay);
    return overlay;
  }
}

