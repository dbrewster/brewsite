// CSS3DRenderer singleton: one instance per canvas parent element.
// Reference-counted — disposes when the last ScreenWidget using it is disposed.

import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

/** Shared CSS3D rendering context for a given canvas parent element. */
export type CSS3DContext = {
  renderer: CSS3DRenderer;
  scene: THREE.Scene;
  lastWebGLFrame: number;
};

const contextMap = new Map<HTMLElement, CSS3DContext>();
const refCounts = new Map<HTMLElement, number>();

/**
 * Returns (creating if necessary) the CSS3DContext for the given canvas parent.
 * Inserts the CSS3DRenderer's div as the last child of canvasParent so it
 * renders on top of the WebGL canvas (z-stacking via DOM order).
 */
function getOrCreate(canvasParent: HTMLElement): CSS3DContext {
  const existing = contextMap.get(canvasParent);
  if (existing) return existing;

  const renderer = new CSS3DRenderer();
  renderer.domElement.style.cssText =
    'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  canvasParent.appendChild(renderer.domElement);

  const ctx: CSS3DContext = { renderer, scene: new THREE.Scene(), lastWebGLFrame: -1 };
  contextMap.set(canvasParent, ctx);
  return ctx;
}

/** Acquire a CSS3DContext for the given canvas parent. Increments ref count. */
export function acquireCSS3DContext(canvasParent: HTMLElement): CSS3DContext {
  const ctx = getOrCreate(canvasParent);
  refCounts.set(canvasParent, (refCounts.get(canvasParent) ?? 0) + 1);
  return ctx;
}

/** Release a CSS3DContext. When ref count reaches 0, disposes and removes the renderer. */
export function releaseCSS3DContext(canvasParent: HTMLElement): void {
  const count = (refCounts.get(canvasParent) ?? 1) - 1;
  if (count <= 0) {
    contextMap.get(canvasParent)?.renderer.domElement.remove();
    contextMap.delete(canvasParent);
    refCounts.delete(canvasParent);
  } else {
    refCounts.set(canvasParent, count);
  }
}

/**
 * Renders the CSS3D scene for the given canvas parent.
 * Guarded by WebGL frame counter — renders at most once per WebGL frame.
 * Pass renderer.info.render.frame as webglFrame.
 */
export function renderCSS3DContext(
  canvasParent: HTMLElement,
  camera: THREE.PerspectiveCamera,
  webglFrame: number,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const ctx = contextMap.get(canvasParent);
  if (!ctx) return;
  if (ctx.lastWebGLFrame === webglFrame) return;
  ctx.lastWebGLFrame = webglFrame;
  ctx.renderer.setSize(viewportWidth, viewportHeight);
  ctx.renderer.render(ctx.scene, camera);
}
