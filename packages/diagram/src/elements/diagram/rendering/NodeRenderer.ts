import * as THREE from 'three';
import type { NodeRenderEntry, TextWithLayout } from './types';
import type { DiagramNodeState, DiagramThemeRenderConfig } from '../types';
import type { IIconLoader } from './IconLoader';
import type { IInteractionRegistry } from './InteractionRegistry';
import {
  ensureText, disposeText, parseHexColor,
  createPresetMaterial, applyMaterialApplication, updatePresetTextures,
} from '@brewsite/core';
import type { MaterialLoader, MaterialApplication, MaterialManifest, LoadedMaterialPreset } from '@brewsite/core';
import { createShapeGeometry, createShapeOutlineGeometry, isRectangularShape, getContentRect } from '../shapes/geometryFactory';
import { createGlow, computeGlowScale, disposeGlowSprite } from '../../_shared/glowSprite';
import { Text } from 'troika-three-text';
import { computeNodeLabelLayout } from './nodeLabelLayout';

const resolveEffectiveEmissiveIntensity = (
  state: DiagramNodeState,
  emissiveOverride: boolean | undefined,
): number => {
  const emissiveEnabled = emissiveOverride ?? state.emissive ?? true;
  return emissiveEnabled ? state.emissiveIntensity : 0;
};

/**
 * Side-face env map intensity multiplier relative to the node's front-face envMapIntensity.
 * Side faces point perpendicular to the camera, so env map reflections on them produce
 * the natural 3D depth cue that makes the box shape apparent. Front faces use a low
 * envMapIntensity to avoid HDR artifacts; side faces need a higher value to catch light.
 */
const SIDE_ENV_MAP_INTENSITY_MULTIPLIER = 4.0;

/**
 * Side-face roughness reduction. Side faces benefit from slightly lower roughness
 * (shinier surface) to catch specular highlights from directional lights at glancing
 * angles. This creates a visible sheen on the edges that reinforces the 3D shape.
 */
const SIDE_ROUGHNESS_REDUCTION = 0.12;

const createBoxMaterials = (
  state: DiagramNodeState,
  materialCount: 2 | 6,
  effectiveEmissiveIntensity: number,
  nodeEnvMapIntensity: number,
): THREE.MeshStandardMaterial[] => {
  // Extract per-color alpha channels. These compose with the element-level opacity.
  const frontParsed = parseHexColor(state.color);
  const sideParsed = parseHexColor(state.sideColor);
  const emissiveParsed = parseHexColor(state.emissiveColor ?? state.color);

  const frontOpacity = state.opacity * frontParsed.alpha;
  const sideOpacity = state.opacity * sideParsed.alpha;

  // Side faces get higher env map intensity and lower roughness so the node reads as 3D.
  // Front faces keep low envMapIntensity to avoid HDR reflection artifacts.
  const sideEnvMapIntensity = Math.min(1, nodeEnvMapIntensity * SIDE_ENV_MAP_INTENSITY_MULTIPLIER);
  const sideRoughness = Math.max(0.05, state.roughness - SIDE_ROUGHNESS_REDUCTION);

  if (materialCount === 2) {
    const caps = new THREE.MeshStandardMaterial({
      color: frontParsed.rgb,
      metalness: state.metalness,
      roughness: state.roughness,
      emissive: new THREE.Color(emissiveParsed.rgb),
      emissiveIntensity: effectiveEmissiveIntensity,
      envMapIntensity: nodeEnvMapIntensity,
      transparent: frontOpacity < 1,
      opacity: frontOpacity,
    });
    const sides = new THREE.MeshStandardMaterial({
      color: sideParsed.rgb,
      metalness: state.metalness,
      roughness: sideRoughness,
      envMapIntensity: sideEnvMapIntensity,
      transparent: sideOpacity < 1,
      opacity: sideOpacity,
    });
    return [caps, sides];
  }

  const side = new THREE.MeshStandardMaterial({
    color: sideParsed.rgb,
    metalness: state.metalness,
    roughness: sideRoughness,
    envMapIntensity: sideEnvMapIntensity,
    transparent: sideOpacity < 1,
    opacity: sideOpacity,
  });
  const top = side.clone();
  // Top-face emissive: 0.08 gives a visible upward-light highlight calibrated to the
  // default lighting rig (ambient + directional from above). Bottom: 0.03 is subtle,
  // producing an ambient shadow effect. These are aesthetic calibrations for the default
  // node lighting setup — not theme-exposed (four-condition principle: they co-vary with
  // scene lighting, which is not a diagram-element concern, and are not independently
  // composable outside the node geometry context).
  top.emissive = new THREE.Color(sideParsed.rgb).multiplyScalar(0.08);
  const bottom = side.clone();
  bottom.emissive = new THREE.Color(sideParsed.rgb).multiplyScalar(0.03);
  const front = new THREE.MeshStandardMaterial({
    color: frontParsed.rgb,
    metalness: state.metalness,
    roughness: state.roughness,
    emissive: new THREE.Color(emissiveParsed.rgb),
    emissiveIntensity: effectiveEmissiveIntensity,
    envMapIntensity: nodeEnvMapIntensity,
    transparent: frontOpacity < 1,
    opacity: frontOpacity,
  });
  const back = side.clone();
  return [side, side.clone(), top, bottom, front, back];
};

export class NodeRenderer {
  private readonly entries = new Map<string, NodeRenderEntry>();
  private readonly emissiveOverrides = new Map<string, boolean>();
  private materialLoader: MaterialLoader | null = null;
  private materialManifest: MaterialManifest | null = null;
  /** Tracks preset names that have already warned about missing manifest entries. */
  private warnedPresets = new Set<string>();

  constructor(
    private readonly iconLoader: IIconLoader,
    private readonly registry: IInteractionRegistry,
  ) {}

  /** Injects the shared material context for CSM preset material support. */
  setMaterialContext(loader: MaterialLoader | null, manifest: MaterialManifest | null): void {
    this.materialLoader = loader;
    this.materialManifest = manifest;
  }

  private key(diagramId: string, nodeId: string): string {
    return `${diagramId}::${nodeId}`;
  }

  setNodeEmissiveOverride(diagramId: string, nodeId: string, enabled: boolean | undefined): void {
    const key = this.key(diagramId, nodeId);
    if (enabled === undefined) {
      this.emissiveOverrides.delete(key);
    } else {
      this.emissiveOverrides.set(key, enabled);
    }
    const entry = this.entries.get(key);
    if (!entry?.lastState) return;
    this.applyEmissiveToEntry(entry, entry.lastState, enabled);
  }

  clearEmissiveOverridesForDiagram(diagramId: string): void {
    const prefix = `${diagramId}::`;
    for (const key of this.emissiveOverrides.keys()) {
      if (!key.startsWith(prefix)) continue;
      this.emissiveOverrides.delete(key);
      const entry = this.entries.get(key);
      if (!entry?.lastState) continue;
      this.applyEmissiveToEntry(entry, entry.lastState, undefined);
    }
  }

  getOrCreate(
    nodeState: DiagramNodeState,
    diagramId: string,
    themeConfig: DiagramThemeRenderConfig,
    parent: THREE.Object3D,
  ): NodeRenderEntry {
    const key = this.key(diagramId, nodeState.id);
    const existing = this.entries.get(key);
    if (existing) {
      this.updateEntry(existing, nodeState, diagramId, themeConfig);
      return existing;
    }
    const entry = this.createEntry(nodeState, diagramId, themeConfig);
    this.updateEntry(entry, nodeState, diagramId, themeConfig);
    parent.add(entry.group);
    this.entries.set(key, entry);
    return entry;
  }

  dispose(nodeId: string, diagramId: string, parent: THREE.Object3D): void {
    const key = this.key(diagramId, nodeId);
    const entry = this.entries.get(key);
    if (!entry) return;
    parent.remove(entry.group);
    this.disposeEntry(entry);
    this.entries.delete(key);
  }

  disposeAllForDiagram(diagramId: string, parent: THREE.Object3D): void {
    for (const [key, entry] of this.entries.entries()) {
      if (!key.startsWith(`${diagramId}::`)) continue;
      parent.remove(entry.group);
      this.disposeEntry(entry);
      this.entries.delete(key);
    }
  }

  private createEntry(
    state: DiagramNodeState,
    diagramId: string,
    themeConfig: DiagramThemeRenderConfig,
  ): NodeRenderEntry {
    const group = new THREE.Group();
    const { geometry, materialCount } = createShapeGeometry(
      state.shape,
      state.size,
      state.thickness,
      state.cornerRadius,
    );
    const emissiveOverride = this.emissiveOverrides.get(this.key(diagramId, state.id));
    const effectiveEmissiveIntensity = resolveEffectiveEmissiveIntensity(state, emissiveOverride);
    const materials = createBoxMaterials(state, materialCount, effectiveEmissiveIntensity, themeConfig.nodeEnvMapIntensity);
    const boxMesh = new THREE.Mesh(geometry, materials);
    boxMesh.castShadow = true;
    // receiveShadow is intentionally false: the node's own top lip casts a shadow
    // onto its front face via the directional light shadow map, creating a visible
    // dark band artifact (self-shadowing). Nodes cast shadows onto the floor/background
    // but should not self-shadow.
    boxMesh.receiveShadow = false;

    // Use EdgesGeometry only for flat-cornered rectangle/square — it shows exactly
    // the 12 box edges and is visually clean. For all other shapes (polygon prisms,
    // special 2D shapes, or rounded rectangles) use a LineLoop with createShapeOutlineGeometry
    // so the border traces the correct silhouette.
    const useEdgesGeo = isRectangularShape(state.shape) && state.cornerRadius <= 0;
    const borderParsed = parseHexColor(state.borderColor);
    const borderOpacity = Math.min(1, state.opacity * borderParsed.alpha);
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(useEdgesGeo ? geometry : new THREE.BoxGeometry(0, 0, 0)),
      new THREE.LineBasicMaterial({
        color: borderParsed.rgb,
        opacity: borderOpacity,
        transparent: true,
      }),
    );
    border.visible = useEdgesGeo;

    let roundedBorder: THREE.LineLoop | undefined;
    if (!useEdgesGeo) {
      roundedBorder = new THREE.LineLoop(
        createShapeOutlineGeometry(
          state.shape, state.size[0], state.size[1], state.thickness, state.cornerRadius,
        ),
        new THREE.LineBasicMaterial({
          color: borderParsed.rgb,
          opacity: borderOpacity,
          transparent: true,
        }),
      );
      group.add(roundedBorder);
    }

    const label = new Text() as TextWithLayout;
    label.renderOrder = 1;
    const sublabel = state.sublabel ? (new Text() as TextWithLayout) : undefined;
    if (sublabel) sublabel.renderOrder = 1;

    group.add(boxMesh, border, label);
    if (sublabel) group.add(sublabel);

    let glow: THREE.Sprite | undefined;
    if (themeConfig.nodeGlowIntensity > 0) {
      glow = createGlow(
        parseHexColor(state.color).rgb,
        state.size[0],
        state.size[1],
        themeConfig.nodeGlowSpread,
        themeConfig.nodeGlowIntensity * state.opacity,
      );
      group.add(glow);
    }

    return { group, boxMesh, border, roundedBorder, glow, label, sublabel, diagramId, materialCount, lastState: state };
  }

  private updateEntry(
    entry: NodeRenderEntry,
    state: DiagramNodeState,
    diagramId: string,
    themeConfig: DiagramThemeRenderConfig,
  ): void {
    const prev = entry.lastState;

    // "using edges geo" means flat-cornered rectangle/square — the only case where
    // the sharp LineSegments border (EdgesGeometry) is shown instead of the LineLoop outline.
    const wasUsingEdgesGeo = isRectangularShape(prev?.shape ?? 'rectangle') && (prev?.cornerRadius ?? 0) <= 0;
    const isUsingEdgesGeo = isRectangularShape(state.shape) && state.cornerRadius <= 0;
    const borderTypeChanged = wasUsingEdgesGeo !== isUsingEdgesGeo;

    const geometryChanged =
      !prev ||
      prev.shape !== state.shape ||
      prev.size[0] !== state.size[0] ||
      prev.size[1] !== state.size[1] ||
      prev.thickness !== state.thickness ||
      prev.cornerRadius !== state.cornerRadius;

    if (geometryChanged) {
      const { geometry, materialCount: newMaterialCount } = createShapeGeometry(
        state.shape,
        state.size,
        state.thickness,
        state.cornerRadius,
      );
      entry.boxMesh.geometry.dispose();
      entry.boxMesh.geometry = geometry;
      entry.materialCount = newMaterialCount;

      // Rebuild the EdgesGeometry border whenever we're staying in (or entering) the
      // flat-rectangle case. When leaving the flat-rectangle case, swap it for an empty geo.
      if (borderTypeChanged || isUsingEdgesGeo) {
        entry.border.geometry.dispose();
        if (isUsingEdgesGeo) {
          entry.border.geometry = new THREE.EdgesGeometry(geometry);
          entry.border.visible = true;
        } else {
          entry.border.geometry = new THREE.BoxGeometry(0, 0, 0);
          entry.border.visible = false;
        }
      }

      // Rebuild the LineLoop outline border for all non-flat-rectangle cases.
      if (!isUsingEdgesGeo) {
        const newBorderGeo = createShapeOutlineGeometry(
          state.shape,
          state.size[0],
          state.size[1],
          state.thickness,
          state.cornerRadius,
        );
        if (entry.roundedBorder) {
          entry.roundedBorder.geometry.dispose();
          entry.roundedBorder.geometry = newBorderGeo;
        } else {
          const borderMat = (entry.border.material as THREE.LineBasicMaterial).clone();
          entry.roundedBorder = new THREE.LineLoop(newBorderGeo, borderMat);
          entry.group.add(entry.roundedBorder);
        }
      } else if (entry.roundedBorder) {
        entry.group.remove(entry.roundedBorder);
        entry.roundedBorder.geometry.dispose();
        (entry.roundedBorder.material as THREE.Material).dispose();
        entry.roundedBorder = undefined;
      }
    }

    entry.group.position.set(state.position[0], state.position[1], state.position[2]);
    entry.group.visible = state.enabled;

    const needsMaterialRebuild =
      !prev ||
      prev.color !== state.color ||
      prev.sideColor !== state.sideColor ||
      prev.metalness !== state.metalness ||
      prev.roughness !== state.roughness ||
      prev.emissiveIntensity !== state.emissiveIntensity ||
      prev.emissive !== state.emissive ||
      prev.emissiveColor !== state.emissiveColor ||
      borderTypeChanged;

    const emissiveOverride = this.emissiveOverrides.get(this.key(diagramId, state.id));
    const effectiveEmissiveIntensity = resolveEffectiveEmissiveIntensity(state, emissiveOverride);
    if (needsMaterialRebuild) {
      const oldMats = Array.isArray(entry.boxMesh.material)
        ? (entry.boxMesh.material as THREE.Material[])
        : [entry.boxMesh.material as THREE.Material];
      entry.boxMesh.material = createBoxMaterials(state, entry.materialCount, effectiveEmissiveIntensity, themeConfig.nodeEnvMapIntensity);
      oldMats.forEach((m) => {
        // Don't dispose the CSM preset material here — it's tracked separately.
        if (m !== entry.presetFrontMaterial) m.dispose();
      });
      // Re-apply preset material after box material rebuild.
      entry.appliedPresetName = undefined;
    } else {
      this.applyEmissiveToEntry(entry, state, emissiveOverride);
    }

    // Apply CSM preset material to front face when surfaceMaterial is set.
    this.applyPresetToFrontFace(entry, state);

    if (prev && (prev.opacity !== state.opacity || prev.color !== state.color || prev.sideColor !== state.sideColor)) {
      const mats = Array.isArray(entry.boxMesh.material)
        ? (entry.boxMesh.material as THREE.MeshStandardMaterial[])
        : [entry.boxMesh.material as THREE.MeshStandardMaterial];
      // Re-parse color alphas so opacity changes compose correctly with per-color alpha.
      const fAlpha = parseHexColor(state.color).alpha;
      const sAlpha = parseHexColor(state.sideColor).alpha;
      for (let i = 0; i < mats.length; i++) {
        // In the 6-material layout, index 4 is the front face; all others are side-derived.
        const isFront = entry.materialCount === 6 ? i === 4 : i === 0;
        const alpha = isFront ? fAlpha : sAlpha;
        const op = state.opacity * alpha;
        mats[i]!.opacity = op;
        mats[i]!.transparent = op < 1;
      }
    }

    if (
      entry.iconHolder &&
      state.iconStyle !== 'flat' &&
      prev &&
      prev.opacity !== state.opacity
    ) {
      const op = state.opacity;
      entry.iconHolder.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material;
          if (Array.isArray(mat)) {
            (mat as THREE.MeshStandardMaterial[]).forEach((m) => {
              m.opacity = op;
              m.transparent = op < 1;
            });
          } else if (mat instanceof THREE.MeshStandardMaterial) {
            (mat as THREE.MeshStandardMaterial).opacity = op;
            (mat as THREE.MeshStandardMaterial).transparent = op < 1;
          }
        }
      });
    }

    const activeBorderMat = (
      !isUsingEdgesGeo && entry.roundedBorder
        ? entry.roundedBorder.material
        : entry.border.material
    ) as THREE.LineBasicMaterial;

    if (!prev || prev.borderColor !== state.borderColor) {
      const borderParsed = parseHexColor(state.borderColor);
      activeBorderMat.color.set(borderParsed.rgb);
      (entry.border.material as THREE.LineBasicMaterial).color.set(borderParsed.rgb);
      if (entry.roundedBorder) {
        (entry.roundedBorder.material as THREE.LineBasicMaterial).color.set(borderParsed.rgb);
      }
    }
    if (!prev || prev.opacity !== state.opacity || prev.borderColor !== state.borderColor) {
      const borderAlpha = parseHexColor(state.borderColor).alpha;
      const op = Math.min(1, state.opacity * borderAlpha);
      activeBorderMat.opacity = op;
      activeBorderMat.transparent = op < 1;
      if (entry.roundedBorder) {
        (entry.roundedBorder.material as THREE.LineBasicMaterial).opacity = op;
      }
    }

    const glowEnabled = themeConfig.nodeGlowIntensity > 0;
    if (glowEnabled) {
      if (!entry.glow) {
        entry.glow = createGlow(
          parseHexColor(state.color).rgb,
          state.size[0],
          state.size[1],
          themeConfig.nodeGlowSpread,
          themeConfig.nodeGlowIntensity * state.opacity,
        );
        entry.group.add(entry.glow);
      } else {
        entry.glow.material.opacity = themeConfig.nodeGlowIntensity * state.opacity;
        if (!prev || prev.color !== state.color) {
          entry.glow.material.color.set(parseHexColor(state.color).rgb);
        }
        if (!prev || prev.size[0] !== state.size[0] || prev.size[1] !== state.size[1]) {
          const [glowW, glowH] = computeGlowScale(state.size[0], state.size[1], themeConfig.nodeGlowSpread);
          entry.glow.scale.set(glowW, glowH, 1);
        }
      }
    } else if (entry.glow) {
      entry.group.remove(entry.glow);
      disposeGlowSprite(entry.glow);
      entry.glow = undefined;
    }

    // For polygon shapes the usable face area is smaller than the bounding box.
    // getContentRect returns the largest axis-aligned rectangle that fits inside
    // the rendered shape, constraining icon and text to the visible interior.
    const [contentW, contentH] = getContentRect(state.shape, state.size);

    const labelLayout = computeNodeLabelLayout(
      contentW,
      contentH,
      state.thickness,
      !!state.iconUrl,
      !!state.sublabel,
      state.iconScale,
      themeConfig.nodeLabelFontSizeBase,
      themeConfig.nodeSublabelFontSizeBase,
      themeConfig.effectiveLabelSizeFactor ?? 1.0,
      themeConfig.effectiveSublabelSizeFactor ?? 1.0,
      state.labelPadding,
    );

    const labelParsed = parseHexColor(state.labelColor);
    ensureText(
      entry.label,
      state.label ?? '',
      labelParsed.rgb,
      labelLayout.labelFontSize,
      state.opacity * labelParsed.alpha,
      contentW * 0.85,
      true,
      { fontUrl: themeConfig.fontUrl, sdfGlyphSize: themeConfig.nodeSdfGlyphSize },
    );
    entry.label.position.set(0, labelLayout.labelY, labelLayout.labelZ);

    if (state.sublabel) {
      if (!entry.sublabel) {
        entry.sublabel = new Text() as TextWithLayout;
        entry.sublabel.renderOrder = 1;
        entry.group.add(entry.sublabel);
      }
      const sublabelParsed = parseHexColor(state.sublabelColor);
      ensureText(
        entry.sublabel,
        state.sublabel,
        sublabelParsed.rgb,
        labelLayout.sublabelFontSize ?? 0,
        state.opacity * sublabelParsed.alpha,
        contentW * 0.85,
        true,
        { fontUrl: themeConfig.fontUrl, sdfGlyphSize: themeConfig.nodeSdfGlyphSize },
      );
      entry.sublabel.position.set(0, labelLayout.sublabelY ?? 0, labelLayout.sublabelZ);
    } else if (entry.sublabel) {
      entry.group.remove(entry.sublabel);
      disposeText(entry.sublabel);
      entry.sublabel = undefined;
    }

    if (state.clickable && state.enabled) {
      this.registry.register(entry.boxMesh, diagramId, state.id);
    } else {
      this.registry.unregister(entry.boxMesh);
    }

    if (state.iconUrl) {
      const needsIconRebuild =
        !entry.iconHolder ||
        entry.iconHolder.userData['iconUrl'] !== state.iconUrl ||
        entry.iconHolder.userData['iconStyle'] !== state.iconStyle ||
        entry.iconHolder.userData['iconDepth'] !== state.iconDepth;

      if (needsIconRebuild) {
        if (entry.iconHolder) {
          entry.group.remove(entry.iconHolder);
        }
        const holder = new THREE.Group();
        holder.userData['iconUrl'] = state.iconUrl;
        holder.userData['iconStyle'] = state.iconStyle;
        holder.userData['iconDepth'] = state.iconDepth;
        entry.iconHolder = holder;
        entry.group.add(holder);
        // Use effectiveIconScale from layout (may be reduced to fit content area).
        const iconWidth = contentW * labelLayout.effectiveIconScale;
        const iconHeight = contentH * labelLayout.effectiveIconScale;
        // iconDepth is already in world units after the two-step NVS → world conversion in render.ts.
        const iconMaxDepth = state.iconDepth;
        this.iconLoader.load(
          state.iconUrl,
          iconWidth,
          iconHeight,
          state.iconStyle,
          iconMaxDepth,
          state.metalness,
          state.roughness,
        ).then((obj) => {
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = false;
            }
          });
          holder.clear();
          holder.add(obj);
        });
      }
      if (entry.iconHolder) {
        // Icon position computed by fit-to-content layout.
        entry.iconHolder.position.set(0, labelLayout.iconY ?? 0, 0.01);
      }
    } else if (entry.iconHolder) {
      entry.group.remove(entry.iconHolder);
      entry.iconHolder = undefined;
    }

    entry.lastState = state;
  }

  private applyEmissiveToEntry(
    entry: NodeRenderEntry,
    state: DiagramNodeState,
    emissiveOverride: boolean | undefined,
  ): void {
    const mats = Array.isArray(entry.boxMesh.material)
      ? (entry.boxMesh.material as THREE.MeshStandardMaterial[])
      : [entry.boxMesh.material as THREE.MeshStandardMaterial];
    const effectiveEmissiveIntensity = resolveEffectiveEmissiveIntensity(state, emissiveOverride);
    const emissiveRgb = parseHexColor(state.emissiveColor ?? state.color).rgb;
    if (entry.materialCount === 2) {
      if (mats[0]) {
        mats[0].emissive.set(emissiveRgb);
        mats[0].emissiveIntensity = effectiveEmissiveIntensity;
      }
      return;
    }
    if (mats[4]) {
      mats[4].emissive.set(emissiveRgb);
      mats[4].emissiveIntensity = effectiveEmissiveIntensity;
    }
  }

  /**
   * Applies a CSM preset material to the front face of a node's box mesh.
   * Three-case error handling:
   *   (a) surfaceMaterial undefined → existing path (no-op)
   *   (b) not in manifest → console.warn once + existing material
   *   (c) loading → existing material until ready, then applied on next update
   */
  private applyPresetToFrontFace(entry: NodeRenderEntry, state: DiagramNodeState): void {
    const presetName = state.surfaceMaterial;

    // (a) No preset → remove any existing CSM material and restore original.
    if (!presetName) {
      if (entry.presetFrontMaterial) {
        this.removePresetFromEntry(entry);
      }
      return;
    }

    // Already applied and preset hasn't changed — just update application uniforms.
    if (entry.appliedPresetName === presetName && entry.presetFrontMaterial) {
      if (state.materialApplication) {
        applyMaterialApplication(
          entry.presetFrontMaterial as Parameters<typeof applyMaterialApplication>[0],
          state.materialApplication,
          state.color,
        );
      }
      return;
    }

    const manifest = this.materialManifest;
    const loader = this.materialLoader;

    // No manifest or loader → skip (textures package not installed).
    if (!manifest || !loader) return;

    const preset = manifest.presets[presetName];

    // (b) Not in manifest → warn once and use existing material.
    if (!preset) {
      if (!this.warnedPresets.has(presetName)) {
        console.warn(
          `[NodeRenderer] Material preset "${presetName}" not found in manifest. ` +
          `Using existing material. Ensure @brewsite/textures is configured with this preset.`,
        );
        this.warnedPresets.add(presetName);
      }
      return;
    }

    // (c) Check sync cache for loaded preset.
    const loaded = loader.getLoadedPresetByKey(preset, manifest.basePath);
    if (!loaded) {
      // Fire-and-forget async load — will be applied on next frame when available.
      void loader.loadPreset(preset, manifest.basePath);
      return;
    }

    // Apply the loaded preset to the front face.
    this.applyLoadedPresetToEntry(entry, state, loaded);
    entry.appliedPresetName = presetName;
  }

  /** Creates a CSM material and replaces the front-face material on the box mesh. */
  private applyLoadedPresetToEntry(
    entry: NodeRenderEntry,
    state: DiagramNodeState,
    loaded: LoadedMaterialPreset,
  ): void {
    // Dispose previous CSM material if present.
    if (entry.presetFrontMaterial) {
      entry.presetFrontMaterial.dispose();
    }

    const frontParsed = parseHexColor(state.color);
    const frontOpacity = state.opacity * frontParsed.alpha;

    const csm = createPresetMaterial({
      textures: loaded.textures,
      defaults: loaded.defaults,
      projection: 'uv',
      application: state.materialApplication,
      baseColor: state.color,
      baseOpacity: frontOpacity,
    });
    // CSM wraps a base MeshStandardMaterial — access PBR properties via cast.
    const baseMat = csm as unknown as THREE.MeshStandardMaterial;
    baseMat.metalness = state.metalness;
    baseMat.roughness = state.roughness;
    csm.transparent = frontOpacity < 1;
    csm.opacity = frontOpacity;

    entry.presetFrontMaterial = csm;

    // Replace the front-face material in the mesh material array.
    const mats = Array.isArray(entry.boxMesh.material)
      ? (entry.boxMesh.material as THREE.Material[])
      : [entry.boxMesh.material as THREE.Material];

    // In 6-material layout: index 4 is front face. In 2-material layout: index 0 is caps/front.
    const frontIndex = entry.materialCount === 6 ? 4 : 0;
    if (mats[frontIndex]) {
      mats[frontIndex].dispose();
      mats[frontIndex] = csm;
    }

    entry.boxMesh.material = mats;
  }

  /** Removes the CSM preset material from a node entry, restoring the original. */
  private removePresetFromEntry(entry: NodeRenderEntry): void {
    if (!entry.presetFrontMaterial || !entry.lastState) return;
    entry.presetFrontMaterial.dispose();
    entry.presetFrontMaterial = undefined;
    entry.appliedPresetName = undefined;
    // The next material rebuild cycle will restore the original MeshStandardMaterial.
  }

  private disposeEntry(entry: NodeRenderEntry): void {
    entry.boxMesh.geometry.dispose();
    const mats = Array.isArray(entry.boxMesh.material)
      ? (entry.boxMesh.material as THREE.Material[])
      : [entry.boxMesh.material as THREE.Material];
    mats.forEach((m) => m.dispose());
    if (entry.presetFrontMaterial) {
      // Preset material may already be disposed if it was in the mats array.
      // THREE.Material.dispose() is safe to call multiple times.
      entry.presetFrontMaterial.dispose();
      entry.presetFrontMaterial = undefined;
    }
    entry.border.geometry.dispose();
    (entry.border.material as THREE.Material).dispose();
    entry.roundedBorder?.geometry.dispose();
    if (entry.roundedBorder) {
      (entry.roundedBorder.material as THREE.Material).dispose();
    }
    disposeText(entry.label);
    if (entry.sublabel) disposeText(entry.sublabel);
    if (entry.glow) {
      disposeGlowSprite(entry.glow);
    }
    if (entry.iconHolder) {
      entry.iconHolder.clear();
    }
    this.registry.unregister(entry.boxMesh);
  }
}
