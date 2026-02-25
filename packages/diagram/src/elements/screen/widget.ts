// ScreenWidget — implements ISceneElement<ScreenState> + IRenderable.

import type * as THREE from 'three';
import type { IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext } from '@brewsite/core';
import { Screen } from './dsl';
import { functionalScreenTransitionSpec } from './compile';
import { ScreenRenderer } from './render';
import type { ScreenState } from './types';

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

  apply(state: ScreenState, _ctx: WidgetRenderContext): void {
    if (!this.scene || !this.renderer) return;
    const camera = this.scene.userData['__brewsite_camera'] as THREE.Camera | undefined;
    const canvas = this.webglRenderer?.domElement ?? null;
    if (!camera || !canvas) {
      console.warn(`ScreenWidget(${this.widgetId}): missing camera or canvas for iframe projection.`);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    this.renderer.update(state, this.scene, camera, rect);
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
