import * as THREE from 'three';
import type { NodeRenderEntry, TextWithLayout } from './types';
import type { DiagramNodeState, DiagramThemeRenderConfig } from '../types';
import type { IIconLoader } from './IconLoader';
import type { IInteractionRegistry } from './InteractionRegistry';
import { ensureText } from './TextRenderer';
import { createShapeGeometry, createRoundedBorderGeometry } from '../shapes/geometryFactory';
import { createGlow, computeGlowScale, disposeGlowSprite } from '../../_shared/glowSprite';
import { Text } from 'troika-three-text';

const createBoxMaterials = (
  state: DiagramNodeState,
  materialCount: 2 | 6,
): THREE.MeshStandardMaterial[] => {
  if (materialCount === 2) {
    const caps = new THREE.MeshStandardMaterial({
      color: state.color,
      metalness: state.metalness,
      roughness: state.roughness,
      emissive: new THREE.Color(state.color),
      emissiveIntensity: state.emissiveIntensity,
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
  top.emissive = new THREE.Color(state.sideColor).multiplyScalar(0.05);
  const bottom = side.clone();
  bottom.emissive = new THREE.Color(state.sideColor).multiplyScalar(0.02);
  const front = new THREE.MeshStandardMaterial({
    color: state.color,
    metalness: state.metalness,
    roughness: state.roughness,
    emissive: new THREE.Color(state.color),
    emissiveIntensity: state.emissiveIntensity,
    transparent: true,
    opacity: state.opacity,
  });
  const back = side.clone();
  return [side, side.clone(), top, bottom, front, back];
};

export class NodeRenderer {
  private readonly entries = new Map<string, NodeRenderEntry>();

  constructor(
    private readonly iconLoader: IIconLoader,
    private readonly registry: IInteractionRegistry,
  ) {}

  private key(diagramId: string, nodeId: string): string {
    return `${diagramId}::${nodeId}`;
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
      state.depth,
      state.cornerRadius,
    );
    const materials = createBoxMaterials(state, materialCount);
    const boxMesh = new THREE.Mesh(geometry, materials);

    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        state.cornerRadius > 0
          ? new THREE.BoxGeometry(0, 0, 0)
          : geometry,
      ),
      new THREE.LineBasicMaterial({
        color: state.borderColor,
        opacity: Math.min(1, state.opacity),
        transparent: true,
      }),
    );
    border.visible = state.cornerRadius <= 0;

    let roundedBorder: THREE.LineLoop | undefined;
    if (state.cornerRadius > 0) {
      roundedBorder = new THREE.LineLoop(
        createRoundedBorderGeometry(state.size[0], state.size[1], state.depth, state.cornerRadius),
        new THREE.LineBasicMaterial({
          color: state.borderColor,
          opacity: Math.min(1, state.opacity),
          transparent: true,
        }),
      );
      group.add(roundedBorder);
    }

    const label = new Text() as TextWithLayout;
    const sublabel = state.sublabel ? (new Text() as TextWithLayout) : undefined;

    group.add(boxMesh, border, label);
    if (sublabel) group.add(sublabel);

    let glow: THREE.Sprite | undefined;
    if (themeConfig.nodeGlowIntensity > 0) {
      glow = createGlow(
        state.color,
        state.size[0],
        state.size[1],
        2.2,
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

    const cornerRadiusWasRounded = (prev?.cornerRadius ?? 0) > 0;
    const cornerRadiusIsRounded = state.cornerRadius > 0;
    const cornerRadiusTypeChanged = cornerRadiusWasRounded !== cornerRadiusIsRounded;

    const geometryChanged =
      !prev ||
      prev.shape !== state.shape ||
      prev.size[0] !== state.size[0] ||
      prev.size[1] !== state.size[1] ||
      prev.depth !== state.depth ||
      prev.cornerRadius !== state.cornerRadius;

    if (geometryChanged) {
      const { geometry, materialCount: newMaterialCount } = createShapeGeometry(
        state.shape,
        state.size,
        state.depth,
        state.cornerRadius,
      );
      entry.boxMesh.geometry.dispose();
      entry.boxMesh.geometry = geometry;
      entry.materialCount = newMaterialCount;

      if (cornerRadiusTypeChanged || !cornerRadiusIsRounded) {
        entry.border.geometry.dispose();
        if (!cornerRadiusIsRounded) {
          entry.border.geometry = new THREE.EdgesGeometry(geometry);
          entry.border.visible = true;
        } else {
          entry.border.geometry = new THREE.BoxGeometry(0, 0, 0);
          entry.border.visible = false;
        }
      }

      if (cornerRadiusIsRounded) {
        const newBorderGeo = createRoundedBorderGeometry(
          state.size[0],
          state.size[1],
          state.depth,
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
      cornerRadiusTypeChanged;

    if (needsMaterialRebuild) {
      const oldMats = Array.isArray(entry.boxMesh.material)
        ? (entry.boxMesh.material as THREE.Material[])
        : [entry.boxMesh.material as THREE.Material];
      entry.boxMesh.material = createBoxMaterials(state, entry.materialCount);
      oldMats.forEach((m) => m.dispose());
    } else if (prev && prev.opacity !== state.opacity) {
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
      cornerRadiusIsRounded && entry.roundedBorder
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
          2.2,
          themeConfig.nodeGlowIntensity * state.opacity,
        );
        entry.group.add(entry.glow);
      } else {
        entry.glow.material.opacity = themeConfig.nodeGlowIntensity * state.opacity;
        if (!prev || prev.color !== state.color) {
          entry.glow.material.color.set(state.color);
        }
        if (!prev || prev.size[0] !== state.size[0] || prev.size[1] !== state.size[1]) {
          const [glowW, glowH] = computeGlowScale(state.size[0], state.size[1], 2.2);
          entry.glow.scale.set(glowW, glowH, 1);
        }
      }
    } else if (entry.glow) {
      entry.group.remove(entry.glow);
      disposeGlowSprite(entry.glow);
      entry.glow = undefined;
    }

    const labelFontSize = state.size[1] * 0.28;
    const sublabelFontSize = state.size[1] * 0.18;
    const labelLine = labelFontSize * 1.1;
    const sublabelLine = sublabelFontSize * 1.1;
    const lineGap = state.size[1] * 0.06;
    let labelY = 0;
    let sublabelY = -state.size[1] * 0.22;
    if (state.iconUrl) {
      const iconHeight = state.size[1] * state.iconScale;
      const iconCenterY = state.size[1] * 0.2;
      const iconBottomY = iconCenterY - iconHeight / 2;
      const textTopY = iconBottomY - state.size[1] * 0.08;
      labelY = textTopY - labelLine / 2;
      if (state.sublabel) {
        sublabelY = labelY - (labelLine / 2 + sublabelLine / 2 + lineGap);
      }
    } else if (state.sublabel) {
      labelY = state.size[1] * 0.1;
      sublabelY = labelY - (labelLine / 2 + sublabelLine / 2 + lineGap);
    }

    ensureText(
      entry.label,
      state.label,
      state.labelColor,
      labelFontSize,
      state.opacity,
      state.size[0] * 0.85,
      true,
    );
    entry.label.position.set(0, labelY, state.depth / 2 + 0.02);

    if (state.sublabel) {
      if (!entry.sublabel) {
        entry.sublabel = new Text() as TextWithLayout;
        entry.group.add(entry.sublabel);
      }
      ensureText(
        entry.sublabel,
        state.sublabel,
        state.sublabelColor,
        sublabelFontSize,
        state.opacity,
        state.size[0] * 0.85,
        true,
      );
      entry.sublabel.position.set(0, sublabelY, state.depth / 2 + 0.02);
    } else if (entry.sublabel) {
      entry.group.remove(entry.sublabel);
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
        const iconWidth = state.size[0] * state.iconScale;
        const iconHeight = state.size[1] * state.iconScale;
        this.iconLoader.load(
          state.iconUrl,
          iconWidth,
          iconHeight,
          state.iconStyle,
          state.iconDepth,
          state.metalness,
          state.roughness,
        ).then((obj) => {
          holder.clear();
          holder.add(obj);
        });
      }
      if (entry.iconHolder) {
        entry.iconHolder.position.set(0, state.size[1] * 0.2, state.depth / 2 + 0.01);
      }
    } else if (entry.iconHolder) {
      entry.group.remove(entry.iconHolder);
      entry.iconHolder = undefined;
    }

    entry.lastState = state;
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
    entry.label.geometry.dispose();
    entry.sublabel?.geometry.dispose();
    if (entry.glow) {
      disposeGlowSprite(entry.glow);
    }
    if (entry.iconHolder) {
      entry.iconHolder.clear();
    }
    this.registry.unregister(entry.boxMesh);
  }
}
