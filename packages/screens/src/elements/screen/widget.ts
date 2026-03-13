// ScreenWidget — ISceneElement<ScreenState> + IRenderable + IExtraRenderPass.
// CSS3DRenderer provides perspective-correct iframe placement at any rotation.

import * as THREE from 'three';
import type {
  IRenderable,
  ISceneElement,
  IExtraRenderPass,
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
import { validateNVSScalar } from '@brewsite/core';
import type { ScreenProps } from './dsl';
import { functionalScreenTransitionSpec } from './compile';
import { ScreenRenderer } from './render';
import type { ScreenState } from './types';
import { acquireCSS3DContext, releaseCSS3DContext, renderCSS3DContext } from './css3dSetup';

/** Reference pixel budget for the iframe div. Scale converts this to world-space size. */
const IFRAME_REFERENCE_WIDTH_PX = 1024;

/**
 * DSL stub component for Screen. Returns null — actual rendering is done by ScreenWidget.
 * CSS3DRenderer provides perspective-correct iframe placement supporting full 3D rotation.
 */
export function Screen(_props: ScreenProps): null { return null; }

/**
 * Renders a live interactive website inside a physical 3D bezel frame.
 * Uses CSS3DRenderer for full 3D rotation support — suitable for carousel layouts.
 * The bezel and glow are WebGL objects that track the screen position.
 * For a static image, use <ImagePanel>. For video/stream, use <MediaScreen>.
 */
export class ScreenWidget
  implements ISceneElement<ScreenState>, IRenderable<ScreenState>, IExtraRenderPass
{
  readonly widgetId: string;
  readonly defaultState: ScreenState;
  readonly transitionSpec = functionalScreenTransitionSpec;
  readonly DslComponent = Screen;

  private renderer: ScreenRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private webglRenderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private canvasParent: HTMLElement | null = null;

  /** Cached world-scale dimensions — only recompute when NVS size changes. */
  private cachedWorldScale: { nvsW: number; nvsH: number; worldW: number; worldH: number } | null = null;

  constructor(widgetId: string, defaultState: ScreenState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene, renderer, camera }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    this.webglRenderer = (renderer as THREE.WebGLRenderer) ?? null;
    this.camera = (camera as THREE.PerspectiveCamera) ?? null;

    const parent = (renderer as THREE.WebGLRenderer)?.domElement?.parentElement ?? null;
    if (!parent) {
      // Fallback for test environments — no visible rendering, no CSS3D needed.
      this.renderer = new ScreenRenderer(new THREE.Scene());
      return;
    }
    this.canvasParent = parent;
    const ctx = acquireCSS3DContext(parent);
    this.renderer = new ScreenRenderer(ctx.scene);
  }

  apply(state: ScreenState, context: WidgetRenderContext): void {
    if (!this.scene || !this.renderer) return;

    if (process.env.NODE_ENV !== 'production') {
      validateNVSScalar(state.nvsX, 'nvsX', `ScreenWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsY, 'nvsY', `ScreenWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsWidth, 'nvsWidth', `ScreenWidget(${this.widgetId})`);
      if (state.nvsHeight !== undefined)
        validateNVSScalar(state.nvsHeight, 'nvsHeight', `ScreenWidget(${this.widgetId})`);
    }

    const [worldX, worldY, worldZ] = context.coords.toWorld(state.nvsX, state.nvsY, state.z);

    // ── Stable world scale (locked to NVS size, immune to camera zoom) ──
    // Cache world-space dimensions and only recompute when the NVS size changes.
    // When nvsHeight is undefined, derive height from a 16:9 ratio applied to world width.
    const nvsW = state.nvsWidth;
    const nvsH = state.nvsHeight ?? (nvsW * context.coords.canvasAspect * (9 / 16));
    const cached = this.cachedWorldScale;
    let worldW: number, worldH: number;
    if (cached && cached.nvsW === nvsW && cached.nvsH === nvsH) {
      worldW = cached.worldW; worldH = cached.worldH;
    } else {
      [worldW, worldH] = context.coords.toWorldSize(nvsW, nvsH);
      this.cachedWorldScale = { nvsW, nvsH, worldW, worldH };
    }

    // css3DScale: IFRAME_REFERENCE_WIDTH_PX (CSS pixels) → worldW (world units)
    const pixPerWorldUnit = context.coords.viewportHeight / context.coords.visibleWorldHeight;
    const css3DScale = state.scale * worldW * pixPerWorldUnit / IFRAME_REFERENCE_WIDTH_PX;

    this.renderer.update({
      ...state,
      position: [worldX, worldY, worldZ],
      width: worldW,
      height: worldH,
      css3DScale,
    }, this.scene);
  }

  /** IExtraRenderPass — called by useSceneEngine after renderer.render(scene, camera). */
  renderPass(renderer: THREE.WebGLRenderer, viewportWidth: number, viewportHeight: number): void {
    if (!this.canvasParent || !this.camera) return;
    renderCSS3DContext(
      this.canvasParent,
      this.camera,
      renderer.info.render.frame,
      viewportWidth,
      viewportHeight,
    );
  }

  dispose(): void {
    if (!this.scene || !this.renderer) return;
    this.renderer.dispose(this.widgetId, this.scene);
    if (this.canvasParent) releaseCSS3DContext(this.canvasParent);
    this.scene = null;
    this.renderer = null;
    this.canvasParent = null;
    this.camera = null;
    this.cachedWorldScale = null;
  }
}
