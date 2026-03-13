import * as THREE from 'three';
import type { GroupRenderEntry, TextWithLayout } from './types';
import type { DiagramGroupState, DiagramThemeRenderConfig } from '../types';
import { ensureText, disposeText, parseHexColor } from '@brewsite/core';
import { Text } from 'troika-three-text';
import type { IGroupInteractionRegistry } from './GroupInteractionRegistry';
import { GROUP_BORDER_PX_TO_UNITS, GROUP_RENDER_Z } from '../compiler/diagramRenderConstants';

export class GroupRenderer {
  private readonly entries = new Map<string, GroupRenderEntry>();

  constructor(private readonly registry: IGroupInteractionRegistry) {}

  private key(diagramId: string, groupId: string): string {
    return `${diagramId}::${groupId}`;
  }

  getOrCreate(
    state: DiagramGroupState,
    diagramId: string,
    parent: THREE.Object3D,
    themeConfig: DiagramThemeRenderConfig,
  ): GroupRenderEntry {
    const key = this.key(diagramId, state.id);
    const existing = this.entries.get(key);
    if (existing) {
      this.updateGroup(existing, state, themeConfig);
      return existing;
    }
    const entry = this.createGroup(state, diagramId, themeConfig);
    parent.add(entry.group);
    this.entries.set(key, entry);
    // Set position, border, label, and edge lights on first creation too —
    // not just on subsequent getOrCreate calls. This ensures the group is
    // fully initialized in a single update() pass.
    this.updateGroup(entry, state, themeConfig);
    return entry;
  }

  dispose(groupId: string, diagramId: string, parent: THREE.Object3D): void {
    const key = this.key(diagramId, groupId);
    const entry = this.entries.get(key);
    if (!entry) return;
    parent.remove(entry.group);
    this.disposeGroup(entry);
    this.entries.delete(key);
  }

  disposeAllForDiagram(diagramId: string, parent: THREE.Object3D): void {
    for (const [key, entry] of this.entries.entries()) {
      if (!key.startsWith(`${diagramId}::`)) continue;
      parent.remove(entry.group);
      this.disposeGroup(entry);
      this.entries.delete(key);
    }
  }

  private createGroup(state: DiagramGroupState, diagramId: string, themeConfig: DiagramThemeRenderConfig): GroupRenderEntry {
    const group = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(state.bounds.w, state.bounds.h);
    const fillParsed = parseHexColor(state.color);
    const fill = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: fillParsed.rgb,
        opacity: state.fillOpacity * fillParsed.alpha,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    fill.castShadow = true;
    fill.receiveShadow = false;
    const label = new Text() as TextWithLayout;
    label.renderOrder = 1;
    const border = this.createBorder(state, themeConfig);
    const edgeLights = this.createEdgeLights(state);
    if (border) {
      group.add(fill, border, label);
    } else {
      group.add(fill, label);
    }
    if (edgeLights) {
      group.add(edgeLights);
    }
    this.registry.register(fill, diagramId, state.id);
    return { group, fill, border, edgeLights, label, lastState: state };
  }

  private disposeBorder(border: THREE.Group): void {
    border.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }

  private removeBorder(entry: GroupRenderEntry): void {
    if (!entry.border) return;
    entry.group.remove(entry.border);
    this.disposeBorder(entry.border);
    entry.border = undefined;
  }

  private removeEdgeLights(entry: GroupRenderEntry): void {
    if (!entry.edgeLights) return;
    entry.group.remove(entry.edgeLights);
    entry.edgeLights.clear();
    entry.edgeLights = undefined;
  }

  private edgeLightsEqual(
    a: DiagramGroupState['edgeLights'] | undefined,
    b: DiagramGroupState['edgeLights'] | undefined,
  ): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.intensity !== b.intensity || a.distance !== b.distance || a.decay !== b.decay) return false;
    if (a.lights.length !== b.lights.length) return false;
    for (let i = 0; i < a.lights.length; i += 1) {
      const al = a.lights[i]!;
      const bl = b.lights[i]!;
      if (al.index !== bl.index || al.side !== bl.side || al.indexOnSide !== bl.indexOnSide || al.color !== bl.color) {
        return false;
      }
      if (
        al.position[0] !== bl.position[0] ||
        al.position[1] !== bl.position[1] ||
        al.position[2] !== bl.position[2]
      ) {
        return false;
      }
    }
    return true;
  }

  private updateGroup(
    entry: GroupRenderEntry,
    state: DiagramGroupState,
    themeConfig: DiagramThemeRenderConfig,
  ): void {
    if (!Number.isFinite(state.bounds.w) || !Number.isFinite(state.bounds.h)) {
      entry.group.visible = false;
      return;
    }
    entry.group.visible = true;
    const centerX = state.bounds.x + state.bounds.w / 2;
    const centerY = state.bounds.y + state.bounds.h / 2;
    entry.group.position.set(centerX, centerY, GROUP_RENDER_Z);

    const prev = entry.lastState;
    const boundsChanged =
      !prev ||
      prev.bounds.w !== state.bounds.w ||
      prev.bounds.h !== state.bounds.h;
    if (boundsChanged) {
      const geometry = new THREE.PlaneGeometry(state.bounds.w, state.bounds.h);
      entry.fill.geometry.dispose();
      entry.fill.geometry = geometry;
    }

    const fillMat = entry.fill.material as THREE.MeshBasicMaterial;
    const fillParsed = parseHexColor(state.color);
    fillMat.color.set(fillParsed.rgb);
    const rawFillOp = state.variant === 'container' ? 0 : state.fillOpacity;
    fillMat.opacity = rawFillOp * fillParsed.alpha;
    fillMat.transparent = true;
    entry.fill.visible = true;

    if (state.variant === 'container' || state.borderStyle === 'none') {
      this.removeBorder(entry);
    } else {
      const borderNeedsRebuild =
        !entry.border ||
        !prev ||
        prev.bounds.w !== state.bounds.w ||
        prev.bounds.h !== state.bounds.h ||
        prev.borderWidth !== state.borderWidth ||
        prev.borderHeight !== state.borderHeight ||
        prev.borderStyle !== state.borderStyle;

      if (borderNeedsRebuild) {
        this.removeBorder(entry);
        const border = this.createBorder(state, themeConfig);
        if (border) {
          entry.border = border;
          entry.group.add(border);
        }
      }

      if (entry.border) {
        const borderParsed = parseHexColor(state.borderColor);
        const borderEmissiveParsed = parseHexColor(state.borderEmissiveColor);
        const effectiveBorderOp = state.borderOpacity * borderParsed.alpha;
        entry.border.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            const mats = Array.isArray(obj.material)
              ? obj.material as THREE.MeshStandardMaterial[]
              : [obj.material as THREE.MeshStandardMaterial];
            if (mats[0]) {
              mats[0].color.set(borderParsed.rgb);
              mats[0].opacity = effectiveBorderOp;
              mats[0].transparent = true;
              mats[0].emissive.set(borderEmissiveParsed.rgb);
              mats[0].emissiveIntensity = state.borderEmissiveIntensity;
            }
            if (mats[1]) {
              mats[1].color.set(new THREE.Color(borderParsed.rgb).multiplyScalar(themeConfig.groupBorderSideDarken));
              mats[1].opacity = effectiveBorderOp;
              mats[1].transparent = true;
              mats[1].emissive.set(borderEmissiveParsed.rgb);
              mats[1].emissiveIntensity = state.borderEmissiveIntensity;
            }
            return;
          }
          if (obj instanceof THREE.LineSegments) {
            const edgeMat = obj.material as THREE.LineBasicMaterial;
            edgeMat.color.set(new THREE.Color(borderParsed.rgb).multiplyScalar(themeConfig.groupBorderEdgeDarken));
            edgeMat.opacity = Math.min(1, effectiveBorderOp + 0.1);
            edgeMat.transparent = true;
          }
        });
      }
    }

    const prevLights = prev?.edgeLights;
    const nextLights = state.edgeLights;
    if (!this.edgeLightsEqual(prevLights, nextLights)) {
      this.removeEdgeLights(entry);
      const rebuilt = this.createEdgeLights(state);
      if (rebuilt) {
        entry.edgeLights = rebuilt;
        entry.group.add(rebuilt);
      }
    }

    const topPadding = Math.max(0, state.bounds.padding[0]);
    const titleInset = Math.min(Math.max(state.bounds.titleGap, 0), topPadding);
    const availableHalfBand = Math.max(0.2, Math.min(titleInset, topPadding - titleInset));
    // Group title label layout constants.
    // 0.08 = label font-size as fraction of group height h (unclamped size: h × 0.08).
    // 0.35 = minimum font-size floor (prevents unreadably small labels at large scales).
    // 1.6  = ceiling scale on availableHalfBand (max font-size proportional to title band).
    //        Clamped: clamp(h × 0.08, min, availableHalfBand × 1.6)
    // labelInsetX = 8% of group width — proportional horizontal inset from border to text edge.
    //
    // These are geometry calibration constants for the group title band. Theme scaling is
    // applied via effectiveLabelSizeFactor. The raw ratios are not theme-exposed — they
    // are calibrated together to keep labels proportional as groups scale in size and are
    // not independently composable (four-condition principle).
    const minFontSize = Math.max(0.05, state.bounds.h * 0.02);
    const labelFontSize = Math.max(
      minFontSize,
      Math.min(state.bounds.h * 0.08, availableHalfBand * 1.6),
    ) * (themeConfig.effectiveLabelSizeFactor ?? 1.0);
    const labelInsetX = Math.max(0.02, state.bounds.w * 0.08);
    const labelMaxWidth = Math.max(labelFontSize, state.bounds.w - labelInsetX * 2);
    if (state.label) {
      const labelParsed = parseHexColor(state.labelColor);
      ensureText(
        entry.label,
        state.label,
        labelParsed.rgb,
        labelFontSize,
        labelParsed.alpha,
        labelMaxWidth,
        true,
        { anchorX: 'left', anchorY: 'middle', textAlign: 'left', fontUrl: themeConfig.fontUrl, sdfGlyphSize: themeConfig.nodeSdfGlyphSize },
      );
      // Position title text inside the top padding band so it never overlaps node content.
      const titleY = state.bounds.h / 2 - topPadding + titleInset;
      entry.label.position.set(
        -state.bounds.w / 2 + labelInsetX,
        titleY,
        0.05,
      );
      // Visibility is controlled by ensureText's hide-until-fit mechanism —
      // do NOT override it here. ensureText hides the text during async troika
      // measurement and reveals it once the correct fitScale is computed.
    } else {
      entry.label.visible = false;
    }

    entry.lastState = state;
  }

  private disposeGroup(entry: GroupRenderEntry): void {
    this.registry.unregister(entry.fill);
    entry.fill.geometry.dispose();
    (entry.fill.material as THREE.Material).dispose();
    if (entry.border) {
      this.disposeBorder(entry.border);
    }
    if (entry.edgeLights) {
      entry.edgeLights.clear();
      entry.edgeLights = undefined;
    }
    disposeText(entry.label);
  }

  private createBorder(state: DiagramGroupState, themeConfig: DiagramThemeRenderConfig): THREE.Group | undefined {
    if (state.borderStyle === 'none') return undefined;
    const border = new THREE.Group();
    const bw = Math.max(0.01, state.borderWidth * GROUP_BORDER_PX_TO_UNITS);
    const bh = Math.max(0.01, state.borderHeight);
    const w = Math.max(0.01, state.bounds.w);
    const h = Math.max(0.01, state.bounds.h);
    const halfW = w / 2;
    const halfH = h / 2;
    const borderParsed = parseHexColor(state.borderColor);
    const borderEmissiveParsed = parseHexColor(state.borderEmissiveColor);
    const effectiveBorderOp = state.borderOpacity * borderParsed.alpha;
    const faceMat = new THREE.MeshStandardMaterial({
      color: borderParsed.rgb,
      opacity: effectiveBorderOp,
      transparent: true,
      metalness: themeConfig.groupBorderMetalness,
      roughness: themeConfig.groupBorderRoughness,
      emissive: new THREE.Color(borderEmissiveParsed.rgb),
      emissiveIntensity: state.borderEmissiveIntensity,
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(borderParsed.rgb).multiplyScalar(themeConfig.groupBorderSideDarken),
      opacity: effectiveBorderOp,
      transparent: true,
      metalness: themeConfig.groupBorderMetalness,
      roughness: themeConfig.groupBorderRoughness,
      emissive: new THREE.Color(borderEmissiveParsed.rgb),
      emissiveIntensity: state.borderEmissiveIntensity,
    });

    // Single ring mesh gives mitered corners with no gaps and no corner overdraw.
    const outer = new THREE.Shape();
    outer.moveTo(-halfW - bw, -halfH - bw);
    outer.lineTo(halfW + bw, -halfH - bw);
    outer.lineTo(halfW + bw, halfH + bw);
    outer.lineTo(-halfW - bw, halfH + bw);
    outer.closePath();

    const inner = new THREE.Path();
    inner.moveTo(-halfW, -halfH);
    inner.lineTo(-halfW, halfH);
    inner.lineTo(halfW, halfH);
    inner.lineTo(halfW, -halfH);
    inner.closePath();
    outer.holes.push(inner);

    const geom = new THREE.ExtrudeGeometry(outer, {
      depth: bh,
      bevelEnabled: false,
    });
    geom.translate(0, 0, -bh / 2);
    const frameMesh = new THREE.Mesh(geom, [faceMat, sideMat]);
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = false;
    const edgeLines = new THREE.LineSegments(
      new THREE.EdgesGeometry(geom),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(borderParsed.rgb).multiplyScalar(themeConfig.groupBorderEdgeDarken),
        opacity: Math.min(1, effectiveBorderOp + 0.1),
        transparent: true,
      }),
    );
    border.add(frameMesh, edgeLines);
    return border;
  }

  private createEdgeLights(state: DiagramGroupState): THREE.Group | undefined {
    const spec = state.edgeLights;
    if (!spec || spec.lights.length === 0) return undefined;
    const group = new THREE.Group();
    for (const lightState of spec.lights) {
      const lightParsed = parseHexColor(lightState.color);
      const light = new THREE.PointLight(
        lightParsed.rgb,
        spec.intensity * lightParsed.alpha,
        spec.distance,
        spec.decay,
      );
      light.position.set(lightState.position[0], lightState.position[1], lightState.position[2]);
      group.add(light);
    }
    return group;
  }
}
