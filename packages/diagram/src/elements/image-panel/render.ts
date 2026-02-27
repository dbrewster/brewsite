// Three.js rendering for ImagePanelState.
// WebGL only — no React.

import * as THREE from 'three';
import type { ImagePanelState } from './types';
import { createBezel, disposeBezel } from '../_shared/bezelGeometry';
import { createGlow, disposeGlowSprite } from '../_shared/glowSprite';

type PanelEntry = {
  group: THREE.Group;
  imageMesh: THREE.Mesh;
  bezelGroup: THREE.Group;
  glowSprite?: THREE.Sprite;
  lastState?: ImagePanelState;
};

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

const loadTexture = (src: string, onLoad: (texture: THREE.Texture) => void): void => {
  if (textureCache.has(src)) {
    onLoad(textureCache.get(src)!);
    return;
  }
  textureLoader.load(src, (texture) => {
    textureCache.set(src, texture);
    onLoad(texture);
  });
};

export class ImagePanelRenderer {
  private panels = new Map<string, PanelEntry>();
  private lastState = new Map<string, ImagePanelState>();

  update(state: ImagePanelState, scene: THREE.Scene): void {
    const prev = this.lastState.get(state.id);
    let entry = this.panels.get(state.id);
    if (!entry) {
      entry = this.createPanel(state);
      this.panels.set(state.id, entry);
      scene.add(entry.group);
    }

    entry.group.position.set(state.position[0], state.position[1], state.position[2]);
    entry.group.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    entry.group.scale.setScalar(state.scale);
    entry.group.visible = state.enabled;

    const material = entry.imageMesh.material as THREE.MeshPhysicalMaterial;
    material.clearcoat = state.gloss;
    material.clearcoatRoughness = state.glossRoughness;
    material.emissiveIntensity = state.selfIllumination;
    material.opacity = state.opacity;
    material.transparent = state.opacity < 1;
    material.needsUpdate = true;

    const desiredWidth = state.width;
    const currentGeometry = entry.imageMesh.geometry as THREE.PlaneGeometry;
    const currentHeight = (currentGeometry.parameters as { height?: number } | undefined)?.height;
    const fallbackHeight = state.height ?? currentHeight ?? state.width / 1.6;
    const desiredHeight = state.height ?? currentHeight;

    if (desiredHeight) {
      this.updateGeometry(entry, desiredWidth, desiredHeight);
    }

    if (state.src !== prev?.src) {
      loadTexture(state.src, (texture) => {
        material.map = texture;
        material.needsUpdate = true;
        const image = texture.image as { width: number; height: number } | undefined;
        if (!state.height && image) {
          const aspect = image.width / Math.max(1, image.height);
          const height = state.width / Math.max(0.0001, aspect);
          this.updateGeometry(entry!, state.width, height);
          // Rebuild bezel to match the texture's natural aspect ratio.
          // The synchronous update() path used a guess (state.width/1.6) as
          // fallbackHeight; now that we know the real height, we correct it.
          disposeBezel(entry!.bezelGroup);
          entry!.group.remove(entry!.bezelGroup);
          entry!.bezelGroup = createBezel(state.bezel, state.width, height, state.bezelThickness);
          entry!.group.add(entry!.bezelGroup);
        }
      });
    }

    if (!prev || state.bezel !== prev.bezel || state.bezelThickness !== prev.bezelThickness ||
        desiredWidth !== (prev?.width ?? desiredWidth) ||
        fallbackHeight !== (prev?.height ?? fallbackHeight)) {
      disposeBezel(entry.bezelGroup);
      entry.group.remove(entry.bezelGroup);
      entry.bezelGroup = createBezel(state.bezel, desiredWidth, fallbackHeight, state.bezelThickness);
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
          desiredWidth,
          fallbackHeight,
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

    entry.lastState = state;
    if (prev !== state) this.lastState.set(state.id, state);
  }

  dispose(panelId: string, scene: THREE.Scene): void {
    const entry = this.panels.get(panelId);
    if (!entry) return;
    scene.remove(entry.group);
    entry.imageMesh.geometry.dispose();
    (entry.imageMesh.material as THREE.Material).dispose();
    disposeBezel(entry.bezelGroup);
    if (entry.glowSprite) disposeGlowSprite(entry.glowSprite);
    this.panels.delete(panelId);
    this.lastState.delete(panelId);
  }

  private createPanel(state: ImagePanelState): PanelEntry {
    const geometry = new THREE.PlaneGeometry(state.width, state.height ?? state.width / 1.6);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x1a1a1a,
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
    const imageMesh = new THREE.Mesh(geometry, material);
    const bezelGroup = createBezel(state.bezel, state.width, state.height ?? state.width / 1.6, state.bezelThickness);
    const group = new THREE.Group();
    group.add(imageMesh, bezelGroup);

    return { group, imageMesh, bezelGroup, lastState: state };
  }

  private updateGeometry(entry: PanelEntry, width: number, height: number): void {
    entry.imageMesh.geometry.dispose();
    entry.imageMesh.geometry = new THREE.PlaneGeometry(width, height);
  }
}
