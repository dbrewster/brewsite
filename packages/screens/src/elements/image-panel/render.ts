// Three.js rendering for ImagePanelState.
// WebGL only — no React.
// Accepts ImagePanelRenderInput (world-space position + dimensions) computed by the widget layer.

import * as THREE from 'three';
import type { ImagePanelState } from './types';
import { createBezel, disposeBezel } from '../_shared/bezelGeometry';
import { createGlow, disposeGlowSprite } from '../_shared/glowSprite';
import type { MaterialLoader, MaterialManifest, LoadedMaterialPreset } from '@brewsite/core';
import { createPresetMaterial, applyMaterialApplication } from '@brewsite/core';
import type CustomShaderMaterial from 'three-custom-shader-material/vanilla';

/**
 * World-space render input for ImagePanelRenderer.
 * Produced by ImagePanelWidget.apply() by converting NVS fields to world-space.
 * Never exported — internal to the image-panel element.
 */
export type ImagePanelRenderInput = Omit<ImagePanelState, 'nvsX' | 'nvsY' | 'z' | 'nvsWidth' | 'nvsHeight'> & {
  /** World-space position of the panel center [x, y, z]. */
  readonly position: readonly [number, number, number];
  /** Panel display width in world units. */
  readonly width: number;
  /** Panel height in world units. Undefined = compute from image aspect ratio. */
  readonly height: number | undefined;
  /** Material loader for preset textures. */
  readonly materialLoader?: MaterialLoader;
  /** Material manifest for preset lookup. */
  readonly materialManifest?: MaterialManifest | null;
};

type PanelEntry = {
  group: THREE.Group;
  imageMesh: THREE.Mesh;
  bezelGroup: THREE.Group;
  glowSprite?: THREE.Sprite;
  lastState?: ImagePanelRenderInput;
  /** CSM preset material for bezel (null = using standard material). */
  bezelPresetMaterial?: CustomShaderMaterial | null;
  /** Loaded preset for bezel. */
  bezelLoadedPreset?: LoadedMaterialPreset | null;
  /** Last bezel material name for change detection. */
  lastBezelMaterial?: string | null;
  /** Set of bezel preset names already warned about. */
  bezelWarnedPresets?: Set<string>;
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
  private lastState = new Map<string, ImagePanelRenderInput>();

  update(state: ImagePanelRenderInput, scene: THREE.Scene): void {
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

    // Apply bezel material preset (async, non-blocking).
    this.applyBezelPreset(entry, state);

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
    if (entry.bezelPresetMaterial) entry.bezelPresetMaterial.dispose();
    this.panels.delete(panelId);
    this.lastState.delete(panelId);
  }

  private createPanel(state: ImagePanelRenderInput): PanelEntry {
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

  /**
   * Resolves and applies bezel material preset for an image panel.
   * Async-loads textures on first encounter; applies CSM material once ready.
   */
  private applyBezelPreset(entry: PanelEntry, state: ImagePanelRenderInput): void {
    const presetName = state.bezelMaterial;
    const materialLoader = state.materialLoader;
    const materialManifest = state.materialManifest;

    if (!presetName || !materialLoader || !materialManifest) return;

    // Init warn set.
    if (!entry.bezelWarnedPresets) entry.bezelWarnedPresets = new Set();

    // Detect preset name change — reset.
    if (entry.lastBezelMaterial !== presetName) {
      if (entry.bezelPresetMaterial) entry.bezelPresetMaterial.dispose();
      entry.bezelLoadedPreset = null;
      entry.bezelPresetMaterial = null;
      entry.lastBezelMaterial = presetName;
    }

    // Manifest lookup.
    const preset = materialManifest.presets[presetName];
    if (!preset) {
      if (!entry.bezelWarnedPresets.has(presetName)) {
        console.warn(
          `[ImagePanelRenderer] Material preset '${presetName}' not found in manifest. Falling back to standard bezel.`,
        );
        entry.bezelWarnedPresets.add(presetName);
      }
      return;
    }

    // Sync cache hit.
    const alreadyLoaded = materialLoader.getLoadedPresetByKey(preset, materialManifest.basePath);
    if (alreadyLoaded && !entry.bezelLoadedPreset) {
      entry.bezelLoadedPreset = alreadyLoaded;
    }

    // Async load.
    if (!entry.bezelLoadedPreset) {
      materialLoader.loadPreset(preset, materialManifest.basePath).then((loaded) => {
        entry.bezelLoadedPreset = loaded;
        if (entry.bezelPresetMaterial) {
          entry.bezelPresetMaterial.dispose();
          entry.bezelPresetMaterial = null;
        }
      });
      return;
    }

    // Create CSM material if not yet created.
    if (!entry.bezelPresetMaterial) {
      entry.bezelPresetMaterial = createPresetMaterial({
        textures: entry.bezelLoadedPreset.textures,
        defaults: entry.bezelLoadedPreset.defaults,
        projection: 'triplanar',
        application: state.bezelMaterialApplication,
      });
    }

    // Per-frame uniform update.
    if (state.bezelMaterialApplication) {
      applyMaterialApplication(entry.bezelPresetMaterial, state.bezelMaterialApplication);
    }

    // Apply CSM material to bezel meshes.
    entry.bezelGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (mesh.material !== entry.bezelPresetMaterial) {
          mesh.material = entry.bezelPresetMaterial as unknown as THREE.Material;
        }
      }
    });
  }
}
