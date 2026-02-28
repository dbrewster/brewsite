// Three.js + DOM rendering for ScreenState.
// WebGL bezel + DOM iframe overlay.

import * as THREE from 'three';
import type { ScreenState } from './types';
import { createBezel, disposeBezel } from '../_shared/bezelGeometry';
import { createGlow, disposeGlowSprite } from '../_shared/glowSprite';
import { SCREEN_ROTATION_WARNING_THRESHOLD_RAD } from './compile';

type ScreenEntry = {
  group: THREE.Group;
  bezelGroup: THREE.Group;
  glowSprite?: THREE.Sprite;
  iframeDiv: HTMLDivElement;
  iframe: HTMLIFrameElement;
  lastState?: ScreenState;
};

export class ScreenRenderer {
  private screens = new Map<string, ScreenEntry>();
  private overlayContainer: HTMLDivElement;
  private warnedRotation = new Set<string>();

  constructor(overlayContainer: HTMLDivElement) {
    this.overlayContainer = overlayContainer;
  }

  update(state: ScreenState, scene: THREE.Scene, camera: THREE.Camera, canvasRect: DOMRect): void {
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

    this.syncIframeToBezel(entry, state, camera, canvasRect);

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

  private createScreen(state: ScreenState): ScreenEntry {
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
    state: ScreenState,
    camera: THREE.Camera,
    canvasRect: DOMRect,
  ): void {
    entry.group.updateWorldMatrix(true, false);
    const bottomLeft = new THREE.Vector3(-state.width / 2, -state.height / 2, 0).applyMatrix4(entry.group.matrixWorld);
    const topRight = new THREE.Vector3(state.width / 2, state.height / 2, 0).applyMatrix4(entry.group.matrixWorld);

    const bl = bottomLeft.clone().project(camera);
    const tr = topRight.clone().project(camera);

    const x = (bl.x + 1) / 2 * canvasRect.width;
    const y = (-tr.y + 1) / 2 * canvasRect.height;
    const w = (tr.x - bl.x) / 2 * canvasRect.width;
    const h = (bl.y - tr.y) / 2 * canvasRect.height;

    entry.iframeDiv.style.left = `${canvasRect.left + x}px`;
    entry.iframeDiv.style.top = `${canvasRect.top + y}px`;
    entry.iframeDiv.style.width = `${w}px`;
    entry.iframeDiv.style.height = `${h}px`;
  }
}
