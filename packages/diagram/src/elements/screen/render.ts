// Three.js + DOM rendering for ScreenState.
// WebGL bezel + DOM iframe overlay.
// Accepts ScreenRenderInput (world-space position + dimensions) computed by the widget layer.

import * as THREE from 'three';
import type { NVSCoordService } from '@brewsite/core';
import type { ScreenState } from './types';
import { createBezel, disposeBezel } from '../_shared/bezelGeometry';
import { createGlow, disposeGlowSprite } from '../_shared/glowSprite';
import { SCREEN_ROTATION_WARNING_THRESHOLD_RAD } from './compile';

/**
 * World-space render input for ScreenRenderer.
 * Produced by ScreenWidget.apply() by converting NVS fields to world-space.
 * Never exported — internal to the screen element.
 */
export type ScreenRenderInput = Omit<ScreenState, 'nvsX' | 'nvsY' | 'z' | 'nvsWidth' | 'nvsHeight'> & {
  /** World-space position of the screen center [x, y, z]. */
  readonly position: readonly [number, number, number];
  /** Screen content width in world units. */
  readonly width: number;
  /** Screen content height in world units. */
  readonly height: number;
};

type ScreenEntry = {
  group: THREE.Group;
  bezelGroup: THREE.Group;
  glowSprite?: THREE.Sprite;
  iframeDiv: HTMLDivElement;
  iframe: HTMLIFrameElement;
  lastState?: ScreenRenderInput;
};

export class ScreenRenderer {
  private screens = new Map<string, ScreenEntry>();
  private overlayContainer: HTMLDivElement;
  private warnedRotation = new Set<string>();

  constructor(overlayContainer: HTMLDivElement) {
    this.overlayContainer = overlayContainer;
  }

  update(state: ScreenRenderInput, scene: THREE.Scene, coords: NVSCoordService, canvasRect: DOMRect): void {
    let entry = this.screens.get(state.id);
    if (!entry) {
      entry = this.createScreen(state);
      this.screens.set(state.id, entry);
      scene.add(entry.group);
    }

    entry.group.position.set(state.position[0], state.position[1], state.position[2]);
    entry.group.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    entry.group.scale.setScalar(state.scale);
    entry.group.visible = state.enabled;

    const exceedsRotationThreshold =
      Math.abs(state.rotation[0]) > SCREEN_ROTATION_WARNING_THRESHOLD_RAD ||
      Math.abs(state.rotation[1]) > SCREEN_ROTATION_WARNING_THRESHOLD_RAD ||
      Math.abs(state.rotation[2]) > SCREEN_ROTATION_WARNING_THRESHOLD_RAD;
    if (exceedsRotationThreshold && !this.warnedRotation.has(state.id)) {
      console.warn(
        `ScreenRenderer: screen "${state.id}" rotation ${state.rotation.join(', ')} may misalign iframe overlay.`,
      );
      this.warnedRotation.add(state.id);
    }

    const prev = entry.lastState;
    if (!prev || state.bezel !== prev.bezel || state.bezelThickness !== prev.bezelThickness ||
        state.width !== prev.width || state.height !== prev.height) {
      disposeBezel(entry.bezelGroup);
      entry.group.remove(entry.bezelGroup);
      entry.bezelGroup = createBezel(state.bezel, state.width, state.height, state.bezelThickness);
      entry.group.add(entry.bezelGroup);
    }
    entry.bezelGroup.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material;
      if (mat && 'opacity' in mat) {
        (mat as THREE.Material & { opacity: number; transparent: boolean }).opacity = state.opacity;
        (mat as THREE.Material & { opacity: number; transparent: boolean }).transparent = true;
      }
    });

    if (state.glow) {
      if (!entry.glowSprite || state.glowColor !== prev?.glowColor || state.glowScale !== prev?.glowScale) {
        if (entry.glowSprite) {
          disposeGlowSprite(entry.glowSprite);
          entry.group.remove(entry.glowSprite);
        }
        entry.glowSprite = createGlow(
          state.glowColor,
          state.width,
          state.height,
          state.glowScale,
          state.glowOpacity * state.opacity,
        );
        entry.group.add(entry.glowSprite);
      } else {
        entry.glowSprite.material.opacity = state.glowOpacity * state.opacity;
      }
    } else if (entry.glowSprite) {
      disposeGlowSprite(entry.glowSprite);
      entry.group.remove(entry.glowSprite);
      entry.glowSprite = undefined;
    }

    entry.iframeDiv.style.opacity = String(state.opacity);
    entry.iframeDiv.style.display = state.enabled ? 'block' : 'none';
    if (!state.enabled) {
      entry.iframe.src = 'about:blank';
    } else if (state.src !== prev?.src || prev?.enabled === false) {
      entry.iframe.src = state.src;
    }

    this.syncIframeToBezel(entry, state, coords, canvasRect);

    entry.lastState = state;
  }

  dispose(screenId: string, scene: THREE.Scene): void {
    const entry = this.screens.get(screenId);
    if (!entry) return;
    scene.remove(entry.group);
    disposeBezel(entry.bezelGroup);
    if (entry.glowSprite) disposeGlowSprite(entry.glowSprite);
    entry.iframeDiv.remove();
    this.screens.delete(screenId);
    this.warnedRotation.delete(screenId);
  }

  private createScreen(state: ScreenRenderInput): ScreenEntry {
    const group = new THREE.Group();
    const bezelGroup = createBezel(state.bezel, state.width, state.height, state.bezelThickness);
    group.add(bezelGroup);

    const iframeDiv = document.createElement('div');
    iframeDiv.style.cssText = `
      position: absolute;
      pointer-events: auto;
      overflow: hidden;
      border: none;
    `;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    `;
    iframe.src = state.src;
    iframeDiv.appendChild(iframe);
    this.overlayContainer.appendChild(iframeDiv);

    return { group, bezelGroup, iframeDiv, iframe, lastState: state };
  }

  private syncIframeToBezel(
    entry: ScreenEntry,
    state: ScreenRenderInput,
    coords: NVSCoordService,
    canvasRect: DOMRect,
  ): void {
    // Derive NVS-space center and dimensions from world-space values (inverse of toWorld/toWorldSize).
    // worldX = (nvsX - 0.5) * visibleWorldWidth  →  nvsX = worldX / visibleWorldWidth + 0.5
    // worldY = -(nvsY - 0.5) * visibleWorldHeight →  nvsY = -worldY / visibleWorldHeight + 0.5
    const nvsX = state.position[0] / coords.visibleWorldWidth + 0.5;
    const nvsY = -state.position[1] / coords.visibleWorldHeight + 0.5;
    const nvsW = state.width / coords.visibleWorldWidth;
    const nvsH = state.height / coords.visibleWorldHeight;

    const left = (nvsX - nvsW / 2) * canvasRect.width;
    const top = (nvsY - nvsH / 2) * canvasRect.height;
    const w = nvsW * canvasRect.width;
    const h = nvsH * canvasRect.height;

    entry.iframeDiv.style.left = `${canvasRect.left + left}px`;
    entry.iframeDiv.style.top = `${canvasRect.top + top}px`;
    entry.iframeDiv.style.width = `${w}px`;
    entry.iframeDiv.style.height = `${h}px`;
  }
}
