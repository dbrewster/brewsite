import * as THREE from 'three';
import type { NodeRenderEntry, TextWithLayout } from './types';
import type { DiagramNodeState, DiagramThemeRenderConfig } from '../types';
import type { IIconLoader } from './IconLoader';
import type { IInteractionRegistry } from './InteractionRegistry';
import { ensureText, disposeText } from '@brewsite/core';
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

const createBoxMaterials = (
  state: DiagramNodeState,
  materialCount: 2 | 6,
  effectiveEmissiveIntensity: number,
): THREE.MeshStandardMaterial[] => {
  if (materialCount === 2) {
    const caps = new THREE.MeshStandardMaterial({
      color: state.color,
      metalness: state.metalness,
      roughness: state.roughness,
      emissive: new THREE.Color(state.emissiveColor ?? state.color),
      emissiveIntensity: effectiveEmissiveIntensity,
      transparent: true,
      opacity: state.opacity,
    });
    const sides = new THREE.MeshStandardMaterial({
      color: state.sideColor,
      metalness: state.metalness,
      roughness: state.roughness,
      transparent: true,
      opacity: state.opacity,
    });
    return [caps, sides];
  }

  const side = new THREE.MeshStandardMaterial({
    color: state.sideColor,
    metalness: state.metalness,
    roughness: state.roughness,
    transparent: true,
    opacity: state.opacity,
  });
  const top = side.clone();
  // Top-face sub-emissive: 0.05 gives a faint upward-light highlight calibrated to the
  // default lighting rig (ambient + directional from above). Bottom: 0.02 is near-zero,
  // producing an ambient shadow effect. These are aesthetic calibrations for the default
  // node lighting setup — not theme-exposed (four-condition principle: they co-vary with
  // scene lighting, which is not a diagram-element concern, and are not independently
  // composable outside the node geometry context).
  top.emissive = new THREE.Color(state.sideColor).multiplyScalar(0.05);
  const bottom = side.clone();
  bottom.emissive = new THREE.Color(state.sideColor).multiplyScalar(0.02);
  const front = new THREE.MeshStandardMaterial({
    color: state.color,
    metalness: state.metalness,
    roughness: state.roughness,
    emissive: new THREE.Color(state.emissiveColor ?? state.color),
    emissiveIntensity: effectiveEmissiveIntensity,
    transparent: true,
    opacity: state.opacity,
  });
  const back = side.clone();
  return [side, side.clone(), top, bottom, front, back];
};

export class NodeRenderer {
  private readonly entries = new Map<string, NodeRenderEntry>();
  private readonly emissiveOverrides = new Map<string, boolean>();

  constructor(
    private readonly iconLoader: IIconLoader,
    private readonly registry: IInteractionRegistry,
  ) {}

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
    const materials = createBoxMaterials(state, materialCount, effectiveEmissiveIntensity);
    const boxMesh = new THREE.Mesh(geometry, materials);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;

    // Use EdgesGeometry only for flat-cornered rectangle/square — it shows exactly
    // the 12 box edges and is visually clean. For all other shapes (polygon prisms,
    // special 2D shapes, or rounded rectangles) use a LineLoop with createShapeOutlineGeometry
    // so the border traces the correct silhouette.
    const useEdgesGeo = isRectangularShape(state.shape) && state.cornerRadius <= 0;
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(useEdgesGeo ? geometry : new THREE.BoxGeometry(0, 0, 0)),
      new THREE.LineBasicMaterial({
        color: state.borderColor,
        opacity: Math.min(1, state.opacity),
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
          color: state.borderColor,
          opacity: Math.min(1, state.opacity),
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
        state.color,
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
      entry.boxMesh.material = createBoxMaterials(state, entry.materialCount, effectiveEmissiveIntensity);
      oldMats.forEach((m) => m.dispose());
    } else {
      this.applyEmissiveToEntry(entry, state, emissiveOverride);
    }

    if (prev && prev.opacity !== state.opacity) {
      const mats = Array.isArray(entry.boxMesh.material)
        ? (entry.boxMesh.material as THREE.MeshStandardMaterial[])
        : [entry.boxMesh.material as THREE.MeshStandardMaterial];
      const op = state.opacity;
      mats.forEach((m) => { m.opacity = op; m.transparent = true; });
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
              m.transparent = true;
            });
          } else if (mat instanceof THREE.MeshStandardMaterial) {
            (mat as THREE.MeshStandardMaterial).opacity = op;
            (mat as THREE.MeshStandardMaterial).transparent = true;
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
      activeBorderMat.color.set(state.borderColor);
      (entry.border.material as THREE.LineBasicMaterial).color.set(state.borderColor);
      if (entry.roundedBorder) {
        (entry.roundedBorder.material as THREE.LineBasicMaterial).color.set(state.borderColor);
      }
    }
    if (!prev || prev.opacity !== state.opacity) {
      const op = Math.min(1, state.opacity);
      activeBorderMat.opacity = op;
      activeBorderMat.transparent = true;
      if (entry.roundedBorder) {
        (entry.roundedBorder.material as THREE.LineBasicMaterial).opacity = op;
      }
    }

    const glowEnabled = themeConfig.nodeGlowIntensity > 0;
    if (glowEnabled) {
      if (!entry.glow) {
        entry.glow = createGlow(
          state.color,
          state.size[0],
          state.size[1],
          themeConfig.nodeGlowSpread,
          themeConfig.nodeGlowIntensity * state.opacity,
        );
        entry.group.add(entry.glow);
      } else {
        entry.glow.material.opacity = themeConfig.nodeGlowIntensity * state.opacity;
        if (!prev || prev.color !== state.color) {
          entry.glow.material.color.set(state.color);
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
    );

    ensureText(
      entry.label,
      state.label ?? '',
      state.labelColor,
      labelLayout.labelFontSize,
      state.opacity,
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
      ensureText(
        entry.sublabel,
        state.sublabel,
        state.sublabelColor,
        labelLayout.sublabelFontSize ?? 0,
        state.opacity,
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
        entry.iconHolder.userData['iconDepthFactor'] !== state.iconDepthFactor;

      if (needsIconRebuild) {
        if (entry.iconHolder) {
          entry.group.remove(entry.iconHolder);
        }
        const holder = new THREE.Group();
        holder.userData['iconUrl'] = state.iconUrl;
        holder.userData['iconStyle'] = state.iconStyle;
        holder.userData['iconDepthFactor'] = state.iconDepthFactor;
        entry.iconHolder = holder;
        entry.group.add(holder);
        const iconWidth = contentW * state.iconScale;
        const iconHeight = contentH * state.iconScale;
        // iconDepthFactor is a fraction of thickness; convert to diagram units for the loader.
        const iconMaxDepth = state.iconDepthFactor * state.thickness;
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
              child.receiveShadow = true;
            }
          });
          holder.clear();
          holder.add(obj);
        });
      }
      if (entry.iconHolder) {
        entry.iconHolder.position.set(0, contentH * 0.2, state.thickness / 2 + 0.01);
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
    if (entry.materialCount === 2) {
      if (mats[0]) {
        mats[0].emissive.set(state.emissiveColor ?? state.color);
        mats[0].emissiveIntensity = effectiveEmissiveIntensity;
      }
      return;
    }
    if (mats[4]) {
      mats[4].emissive.set(state.emissiveColor ?? state.color);
      mats[4].emissiveIntensity = effectiveEmissiveIntensity;
    }
  }

  private disposeEntry(entry: NodeRenderEntry): void {
    entry.boxMesh.geometry.dispose();
    const mats = Array.isArray(entry.boxMesh.material)
      ? (entry.boxMesh.material as THREE.Material[])
      : [entry.boxMesh.material as THREE.Material];
    mats.forEach((m) => m.dispose());
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
