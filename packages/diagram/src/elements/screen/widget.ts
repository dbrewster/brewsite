// ScreenWidget — implements ISceneElement<ScreenState> + IRenderable.
// Converts NVS position (nvsX, nvsY, z) to world-space before passing to ScreenRenderer.

import * as THREE from 'three';
import type { IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext } from '@brewsite/core';
import { validateNVSScalar } from '@brewsite/core';
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
  private webglRenderer: THREE.WebGLRenderer | null = null;

  constructor(widgetId: string, defaultState: ScreenState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene, renderer }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    this.webglRenderer = (renderer as THREE.WebGLRenderer) ?? null;
    const overlay = this.ensureOverlayContainer();
    this.renderer = new ScreenRenderer(overlay);
  }

  apply(state: ScreenState, context: WidgetRenderContext): void {
    if (!this.scene || !this.renderer) return;

    if (process.env.NODE_ENV !== 'production') {
      validateNVSScalar(state.nvsX, 'nvsX', `ScreenWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsY, 'nvsY', `ScreenWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsWidth, 'nvsWidth', `ScreenWidget(${this.widgetId})`);
      if (state.nvsHeight !== undefined) {
        validateNVSScalar(state.nvsHeight, 'nvsHeight', `ScreenWidget(${this.widgetId})`);
      }
    }

    // Convert NVS position to world-space using the per-frame coord service.
    const [worldX, worldY, worldZ] = context.coords.toWorld(state.nvsX, state.nvsY, state.z);

    // Convert NVS width/height fractions to world units.
    // When nvsHeight is undefined, derive height from a 16:9 ratio applied to the world width.
    // nvsH_fallback = nvsWidth * canvasAspect * (9/16) ensures worldH = worldW * (9/16).
    const nvsH = state.nvsHeight ?? (state.nvsWidth * context.coords.canvasAspect * (9 / 16));
    const [worldW, worldH] = context.coords.toWorldSize(state.nvsWidth, nvsH);

    const canvas = this.webglRenderer?.domElement ?? null;
    const rect = canvas?.getBoundingClientRect() ?? new DOMRect(0, 0, 1920, 1080);

    this.renderer.update({
      ...state,
      position: [worldX, worldY, worldZ],
      width: worldW,
      height: worldH,
    }, this.scene, context.coords, rect);
  }

  dispose(): void {
    if (!this.scene || !this.renderer) return;
    this.renderer.dispose(this.widgetId, this.scene);
    this.scene = null;
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
