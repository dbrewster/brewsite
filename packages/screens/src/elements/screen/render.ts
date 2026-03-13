// render.ts — CSS3DRenderer-based Screen rendering.
// WebGL bezel (THREE.Group) + CSS3DObject iframe for perspective-correct 3D placement.

import * as THREE from 'three';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import type { ScreenState } from './types';
import { createBezel, disposeBezel } from '../_shared/bezelGeometry';
import { createGlow, disposeGlowSprite } from '../_shared/glowSprite';

/**
 * World-space render input. NVS fields are resolved to world-space by ScreenWidget.
 * css3DScale encodes the conversion: IFRAME_REFERENCE_WIDTH_PX → worldWidth world units.
 */
export type ScreenRenderInput =
  Omit<ScreenState, 'nvsX' | 'nvsY' | 'z' | 'nvsWidth' | 'nvsHeight'> & {
  readonly position: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  /** Uniform scale to apply to CSS3DObject: worldWidth * pixPerWorldUnit / REFERENCE_PX */
  readonly css3DScale: number;
};

/** Fixed pixel budget for the iframe div. Scale converts this to world-space size. */
const IFRAME_REFERENCE_WIDTH_PX = 1024;

type ScreenEntry = {
  group: THREE.Group;
  bezelGroup: THREE.Group;
  glowSprite?: THREE.Sprite;
  css3DObject: CSS3DObject;
  iframeDiv: HTMLDivElement;
  iframe: HTMLIFrameElement;
  lastState?: ScreenRenderInput;
};

/** Renders Screen elements using CSS3DObject for perspective-correct iframe placement. */
export class ScreenRenderer {
  private screens = new Map<string, ScreenEntry>();
  private css3DScene: THREE.Scene;

  constructor(css3DScene: THREE.Scene) {
    this.css3DScene = css3DScene;
  }

  update(state: ScreenRenderInput, scene: THREE.Scene): void {
    let entry = this.screens.get(state.id);
    if (!entry) {
      entry = this.createScreen(state);
      this.screens.set(state.id, entry);
      scene.add(entry.group);
      this.css3DScene.add(entry.css3DObject);
    }

    // ── WebGL bezel transform ────────────────────────────────────────────────
    entry.group.position.set(state.position[0], state.position[1], state.position[2]);
    entry.group.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    entry.group.scale.setScalar(state.scale);
    entry.group.visible = state.enabled;

    // ── CSS3DObject transform (mirrors bezel exactly) ────────────────────────
    entry.css3DObject.position.set(state.position[0], state.position[1], state.position[2]);
    entry.css3DObject.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    entry.css3DObject.scale.setScalar(state.css3DScale);
    entry.css3DObject.visible = state.enabled;

    // Update iframe div height for current aspect ratio
    const refH = Math.round(IFRAME_REFERENCE_WIDTH_PX * state.height / Math.max(0.001, state.width));
    entry.iframeDiv.style.height = `${refH}px`;

    // ── Bezel rebuild on geometry change ─────────────────────────────────────
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

    // ── Glow sprite ───────────────────────────────────────────────────────────
    if (state.glow) {
      if (!entry.glowSprite || state.glowColor !== prev?.glowColor || state.glowScale !== prev?.glowScale) {
        if (entry.glowSprite) { disposeGlowSprite(entry.glowSprite); entry.group.remove(entry.glowSprite); }
        entry.glowSprite = createGlow(
          state.glowColor, state.width, state.height,
          state.glowScale, state.glowOpacity * state.opacity,
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

    // ── Iframe enabled / src ─────────────────────────────────────────────────
    entry.iframeDiv.style.opacity = String(state.opacity);
    entry.css3DObject.visible = state.enabled;
    if (!state.enabled) {
      entry.iframe.src = 'about:blank';
    } else if (state.src !== prev?.src || prev?.enabled === false) {
      entry.iframe.src = state.src;
    }

    entry.lastState = state;
  }

  dispose(screenId: string, scene: THREE.Scene): void {
    const entry = this.screens.get(screenId);
    if (!entry) return;
    scene.remove(entry.group);
    this.css3DScene.remove(entry.css3DObject);
    disposeBezel(entry.bezelGroup);
    if (entry.glowSprite) disposeGlowSprite(entry.glowSprite);
    this.screens.delete(screenId);
  }

  private createScreen(state: ScreenRenderInput): ScreenEntry {
    const group = new THREE.Group();
    const bezelGroup = createBezel(state.bezel, state.width, state.height, state.bezelThickness);
    group.add(bezelGroup);

    const refH = Math.round(IFRAME_REFERENCE_WIDTH_PX * state.height / Math.max(0.001, state.width));
    const iframeDiv = document.createElement('div');
    iframeDiv.style.cssText = `width:${IFRAME_REFERENCE_WIDTH_PX}px;height:${refH}px;pointer-events:auto;overflow:hidden;border:none;`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `width:100%;height:100%;border:none;display:block;`;
    iframe.src = state.src;
    iframeDiv.appendChild(iframe);

    const css3DObject = new CSS3DObject(iframeDiv);
    css3DObject.scale.setScalar(state.css3DScale);

    return { group, bezelGroup, css3DObject, iframeDiv, iframe, lastState: state };
  }
}
