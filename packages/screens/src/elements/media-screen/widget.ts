// MediaScreenWidget — ISceneElement<MediaScreenState> + IRenderable<MediaScreenState>.
// Static stream registry bridges live MediaStream objects into the compiled scene tick.

import * as THREE from 'three';
import type { IViewChild, IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext } from '@brewsite/core';
import { validateNVSScalar } from '@brewsite/core';
import type { MediaScreenProps } from './dsl';
import { compileMediaScreen, functionalMediaScreenTransitionSpec } from './compile';
import { MediaScreenRenderer } from './render';
import type { MediaScreenState } from './types';

/** DSL stub — returns null, actual rendering is handled by MediaScreenWidget. */
export function MediaScreen(_props: MediaScreenProps): null { return null; }

/** Widget for WebGL video-texture screens with optional MediaStream support. */
export class MediaScreenWidget implements ISceneElement<MediaScreenState>, IRenderable<MediaScreenState>, IViewChild {
  readonly widgetId: string;
  readonly defaultState: MediaScreenState;
  readonly transitionSpec = functionalMediaScreenTransitionSpec;
  readonly DslComponent = MediaScreen;

  /**
   * Internal root group for this widget's 3D content.
   * Not exposed publicly — IGroupOwner has been removed.
   * ViewWidget applies opacity via applyViewOpacity() instead of reparenting.
   */
  private readonly rootGroup = new THREE.Group();

  private renderer = new MediaScreenRenderer();
  private scene: THREE.Scene | null = null;
  private cachedWorldScale: { nvsW: number; nvsH: number; worldW: number; worldH: number } | null = null;

  // ── Static stream registry ───────────────────────────────────────────────────
  private static readonly streamRegistry = new Map<string, MediaStream>();

  /**
   * Register a live MediaStream under a key used in <MediaScreen streamId="key">.
   * Call before or while the scene is rendering. Registration takes effect on the
   * next tick (within one frame).
   */
  static registerStream(id: string, stream: MediaStream): void {
    MediaScreenWidget.streamRegistry.set(id, stream);
  }

  /**
   * Unregister a stream. The MediaScreen will render black on the next tick.
   * Also stop the stream tracks: `stream.getTracks().forEach(t => t.stop())`.
   */
  static unregisterStream(id: string): void {
    MediaScreenWidget.streamRegistry.delete(id);
  }

  /** Look up a registered stream by ID. Returns null if not found. */
  static getStream(id: string): MediaStream | null {
    return MediaScreenWidget.streamRegistry.get(id) ?? null;
  }

  /**
   * Clear the static stream registry. Test-only — ensures test isolation.
   * Must be called in afterEach() for any test that calls registerStream().
   */
  static _clearRegistryForTest(): void {
    if (process.env.NODE_ENV !== 'production') {
      MediaScreenWidget.streamRegistry.clear();
    }
  }

  constructor(widgetId: string, defaultState: MediaScreenState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    // Add the root group to the scene. The renderer parents screen geometry
    // under this group. Position is controlled by NVS state each tick.
    this.scene.add(this.rootGroup);
  }

  apply(state: MediaScreenState, context: WidgetRenderContext): void {
    if (!this.scene) return;

    if (process.env.NODE_ENV !== 'production') {
      validateNVSScalar(state.nvsX, 'nvsX', `MediaScreenWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsY, 'nvsY', `MediaScreenWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsWidth, 'nvsWidth', `MediaScreenWidget(${this.widgetId})`);
      if (state.nvsHeight !== undefined)
        validateNVSScalar(state.nvsHeight, 'nvsHeight', `MediaScreenWidget(${this.widgetId})`);
    }

    const [worldX, worldY, worldZ] = context.coords.toWorld(state.nvsX, state.nvsY, state.z);

    const nvsW = state.nvsWidth;
    const nvsH = state.nvsHeight ?? (nvsW * context.coords.canvasAspect * (9 / 16));
    const cached = this.cachedWorldScale;
    let worldW: number, worldH: number;
    if (cached && cached.nvsW === nvsW && cached.nvsH === nvsH) {
      worldW = cached.worldW; worldH = cached.worldH;
    } else if (state.uniformSizing) {
      const uniform = Math.min(context.coords.visibleWorldWidth, context.coords.visibleWorldHeight);
      worldW = nvsW * uniform;
      worldH = nvsH * uniform;
      this.cachedWorldScale = { nvsW, nvsH, worldW, worldH };
    } else {
      [worldW, worldH] = context.coords.toWorldSize(nvsW, nvsH);
      this.cachedWorldScale = { nvsW, nvsH, worldW, worldH };
    }

    const resolvedStream = state.sourceKind === 'stream' && state.streamId
      ? MediaScreenWidget.getStream(state.streamId)
      : null;

    this.renderer.update({
      ...state,
      position: [worldX, worldY, worldZ],
      width: worldW,
      height: worldH,
      resolvedStream,
    }, this.rootGroup);
  }

  /**
   * Applies view-level opacity to all 3D content owned by this widget.
   * Called by ViewWidget when carousel or scene-transition opacity changes.
   */
  applyViewOpacity(opacity: number): void {
    this.rootGroup.visible = opacity > 0;
    this.rootGroup.traverse((obj) => {
      const hasMaterial = (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) && obj.material;
      if (!hasMaterial) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of materials) {
        if (!('opacity' in mat)) continue;
        (mat as THREE.Material & { opacity: number; transparent: boolean }).opacity = opacity;
        (mat as THREE.Material & { transparent: boolean }).transparent = opacity < 1;
      }
    });
  }

  dispose(): void {
    if (!this.scene) return;
    this.renderer.dispose(this.widgetId, this.rootGroup);
    this.scene.remove(this.rootGroup);
    this.scene = null;
    this.cachedWorldScale = null;
  }
}
