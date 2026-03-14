// Three.js rendering for MediaScreenState — pure WebGL, no DOM overlay.
// PlaneGeometry + MeshPhysicalMaterial + VideoTexture.

import * as THREE from 'three';
import type { MediaScreenState } from './types';
import { createBezel, disposeBezel } from '../_shared/bezelGeometry';
import { createGlow, disposeGlowSprite } from '../_shared/glowSprite';

/** World-space render input. NVS fields are resolved to world-space by MediaScreenWidget. */
export type MediaScreenRenderInput =
  Omit<MediaScreenState, 'nvsX' | 'nvsY' | 'z' | 'nvsWidth' | 'nvsHeight'> & {
  readonly position: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  readonly resolvedStream: MediaStream | null;
};

type ScreenEntry = {
  group: THREE.Group;
  screenMesh: THREE.Mesh;
  bezelGroup: THREE.Group;
  glowSprite?: THREE.Sprite;
  video: HTMLVideoElement;
  texture: THREE.VideoTexture;
  lastState?: MediaScreenRenderInput;
};

/** Manages WebGL video-texture screen meshes for MediaScreen elements. */
export class MediaScreenRenderer {
  private screens = new Map<string, ScreenEntry>();

  update(state: MediaScreenRenderInput, container: THREE.Object3D): void {
    const prev = this.screens.get(state.id)?.lastState;
    let entry = this.screens.get(state.id);
    if (!entry) {
      entry = this.createScreen(state);
      this.screens.set(state.id, entry);
      container.add(entry.group);
    }

    entry.group.position.set(state.position[0], state.position[1], state.position[2]);
    entry.group.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    entry.group.scale.setScalar(state.scale);
    entry.group.visible = state.enabled;

    if (state.sourceKind === 'video') {
      if (state.src !== prev?.src) {
        entry.video.src = state.src ?? '';
        entry.video.load();
        if (state.autoPlay) entry.video.play().catch(() => {});
      }
      entry.video.loop = state.loop;
      entry.video.muted = state.muted;
    }

    if (state.sourceKind === 'stream') {
      const current = entry.video.srcObject as MediaStream | null;
      if (state.resolvedStream && state.resolvedStream !== current) {
        entry.video.srcObject = state.resolvedStream;
        entry.video.play().catch(() => {});
      } else if (!state.resolvedStream && current) {
        entry.video.srcObject = null;
        entry.video.src = '';
      }
    }

    const mat = entry.screenMesh.material as THREE.MeshPhysicalMaterial;
    mat.clearcoat = state.gloss;
    mat.clearcoatRoughness = state.glossRoughness;
    mat.emissiveIntensity = state.selfIllumination;
    mat.opacity = state.opacity;
    mat.transparent = state.opacity < 1;
    mat.needsUpdate = true;
    // Only request texture upload when the video element has frame data.
    // Forcing needsUpdate before readyState >= HAVE_CURRENT_DATA (2) produces
    // a WebGL INVALID_VALUE: texImage2D error every frame until the video loads.
    if (entry.video.readyState >= 2) {
      entry.texture.needsUpdate = true;
    }

    if (state.width !== prev?.width || state.height !== prev?.height) {
      entry.screenMesh.geometry.dispose();
      entry.screenMesh.geometry = new THREE.PlaneGeometry(state.width, state.height);
    }

    if (!prev || state.bezel !== prev.bezel || state.bezelThickness !== prev.bezelThickness ||
        state.width !== prev.width || state.height !== prev.height) {
      disposeBezel(entry.bezelGroup);
      entry.group.remove(entry.bezelGroup);
      entry.bezelGroup = createBezel(state.bezel, state.width, state.height, state.bezelThickness);
      entry.group.add(entry.bezelGroup);
    }
    entry.bezelGroup.traverse((obj) => {
      const m = (obj as THREE.Mesh).material;
      if (m && 'opacity' in m) {
        (m as THREE.Material & { opacity: number; transparent: boolean }).opacity = state.opacity;
        (m as THREE.Material & { opacity: number; transparent: boolean }).transparent = true;
      }
    });

    if (state.glow) {
      if (!entry.glowSprite || state.glowColor !== prev?.glowColor || state.glowScale !== prev?.glowScale) {
        if (entry.glowSprite) { disposeGlowSprite(entry.glowSprite); entry.group.remove(entry.glowSprite); }
        entry.glowSprite = createGlow(state.glowColor, state.width, state.height,
          state.glowScale, state.glowOpacity * state.opacity);
        entry.group.add(entry.glowSprite);
      } else {
        entry.glowSprite.material.opacity = state.glowOpacity * state.opacity;
      }
    } else if (entry.glowSprite) {
      disposeGlowSprite(entry.glowSprite);
      entry.group.remove(entry.glowSprite);
      entry.glowSprite = undefined;
    }

    entry.lastState = state;
  }

  dispose(id: string, container: THREE.Object3D): void {
    const entry = this.screens.get(id);
    if (!entry) return;
    container.remove(entry.group);
    entry.screenMesh.geometry.dispose();
    entry.texture.dispose();
    (entry.screenMesh.material as THREE.Material).dispose();
    disposeBezel(entry.bezelGroup);
    if (entry.glowSprite) disposeGlowSprite(entry.glowSprite);
    entry.video.pause();
    entry.video.srcObject = null;
    entry.video.src = '';
    entry.video.load();
    this.screens.delete(id);
  }

  private createScreen(state: MediaScreenRenderInput): ScreenEntry {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.muted = state.muted;
    video.loop = state.loop;

    if (state.sourceKind === 'video' && state.src) {
      video.src = state.src;
      video.load();
      if (state.autoPlay) video.play().catch(() => {});
    } else if (state.sourceKind === 'stream' && state.resolvedStream) {
      video.srcObject = state.resolvedStream;
      video.play().catch(() => {});
    }

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: 0.05,
      metalness: 0,
      clearcoat: state.gloss,
      clearcoatRoughness: state.glossRoughness,
      emissive: new THREE.Color(0x111111),
      emissiveIntensity: state.selfIllumination,
      transparent: true,
      opacity: state.opacity,
      side: THREE.FrontSide,
    });

    const geometry = new THREE.PlaneGeometry(state.width, state.height);
    const screenMesh = new THREE.Mesh(geometry, material);
    const bezelGroup = createBezel(state.bezel, state.width, state.height, state.bezelThickness);
    const group = new THREE.Group();
    group.add(screenMesh, bezelGroup);

    return { group, screenMesh, bezelGroup, video, texture, lastState: state };
  }
}
