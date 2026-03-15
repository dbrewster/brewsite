import * as THREE from 'three';
import opentype from 'opentype.js';
import type { NVSCoordService } from '@brewsite/core/widget/types';
import type { NeonSignState } from './types';

type Pt = { x: number; y: number };
type OtPath = { commands: opentype.PathCommand[] };

const MIN_PTS = 4;
const TUBE_RADIUS = 0.032;
const TUBE_SEGS = 10;
const CURVE_SAMPS = 5;
const FONT_SIZE = 3.2;

const sampleLine = (p0: Pt, p1: Pt, n: number): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
  });

const sampleQuad = (p0: Pt, p1: Pt, p2: Pt, n: number): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    };
  });

const sampleCubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const mt = 1 - t;
    return {
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
    };
  });

const extractContours = (path: OtPath, scale: number, penOffsetX: number): THREE.Vector3[][] => {
  const contours: THREE.Vector3[][] = [];
  let current: THREE.Vector3[] = [];
  let pen: Pt = { x: 0, y: 0 };

  const push = (pts: Pt[]) => {
    for (const p of pts) {
      const v = new THREE.Vector3((p.x + penOffsetX) * scale, p.y * scale, 0);
      const last = current[current.length - 1];
      if (last && last.distanceTo(v) < 0.001) continue;
      current.push(v);
    }
  };

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case 'M':
        if (current.length >= MIN_PTS) contours.push(current);
        current = [];
        pen = { x: cmd.x, y: cmd.y };
        push([pen]);
        break;
      case 'L': {
        const d = { x: cmd.x, y: cmd.y };
        push(sampleLine(pen, d, 2));
        pen = d;
        break;
      }
      case 'Q': {
        const d = { x: cmd.x, y: cmd.y };
        push(sampleQuad(pen, { x: cmd.x1, y: cmd.y1 }, d, CURVE_SAMPS));
        pen = d;
        break;
      }
      case 'C': {
        const d = { x: cmd.x, y: cmd.y };
        push(sampleCubic(pen, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }, d, CURVE_SAMPS));
        pen = d;
        break;
      }
      case 'Z':
        if (current.length >= MIN_PTS) {
          if (current[0].distanceTo(current[current.length - 1]) > 0.01) current.push(current[0].clone());
          contours.push(current);
        }
        current = [];
        break;
    }
  }
  if (current.length >= MIN_PTS) contours.push(current);
  return contours;
};

type TextMeshSet = {
  meshes: THREE.Mesh[];
  tubeMaterial: THREE.MeshPhysicalMaterial;
  haloMaterial: THREE.MeshBasicMaterial;
};

const createTextMeshes = (font: opentype.Font, text: string): TextMeshSet => {
  const scale = FONT_SIZE / font.unitsPerEm;
  const meshes: THREE.Mesh[] = [];

  let totalWidth = 0;
  const glyphs: opentype.Glyph[] = [];
  for (const char of text) {
    const glyph = font.charToGlyph(char);
    glyphs.push(glyph);
    totalWidth += glyph.advanceWidth ?? 0;
  }
  const halfWidth = (totalWidth * scale) / 2;

  const tubeMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x000c12),
    emissive: new THREE.Color(0x00d8ff),
    emissiveIntensity: 1.8,
    roughness: 0,
    metalness: 0,
    transparent: true,
    opacity: 1,
  });
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x00f5ff),
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.BackSide,
  });

  let penX = -halfWidth;
  for (const glyph of glyphs) {
    if (glyph.path) {
      const contours = extractContours(glyph.path as OtPath, scale, penX / scale);
      for (const pts of contours) {
        if (pts.length < 3) continue;
        const spline = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
        const sampled = spline.getPoints(Math.max(pts.length * 4, 48));
        const curve = new THREE.CatmullRomCurve3(sampled, false, 'catmullrom', 0.5);

        const tubeGeo = new THREE.TubeGeometry(curve, sampled.length, TUBE_RADIUS, TUBE_SEGS, false);
        const tube = new THREE.Mesh(tubeGeo, tubeMaterial);
        meshes.push(tube);

        const haloGeo = new THREE.TubeGeometry(curve, sampled.length, TUBE_RADIUS * 2.6, TUBE_SEGS, false);
        const halo = new THREE.Mesh(haloGeo, haloMaterial);
        meshes.push(halo);
      }
    }
    penX += (glyph.advanceWidth ?? 0) * scale;
  }

  return { meshes, tubeMaterial, haloMaterial };
};

export class NeonSignRenderer {
  private scene: THREE.Scene;
  private root: THREE.Group | null = null;
  private signGroup: THREE.Group | null = null;
  private textMeshes: THREE.Mesh[] = [];
  private textMaterial: THREE.MeshPhysicalMaterial | null = null;
  private haloMaterial: THREE.MeshBasicMaterial | null = null;
  private font: opentype.Font | null = null;
  private loadedFontUrl = '';
  private lastText = '';
  private signLight: THREE.PointLight | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async loadFont(fontUrl: string): Promise<void> {
    if (!fontUrl || fontUrl === this.loadedFontUrl) return;
    const response = await fetch(fontUrl);
    const buffer = await response.arrayBuffer();
    this.font = opentype.parse(buffer);
    this.loadedFontUrl = fontUrl;
    this.lastText = '';
  }

  update(state: NeonSignState, wallTimeSeconds: number, coords: NVSCoordService): void {
    if (!this.root) this.createRoot();
    if (!this.root || !this.signGroup) return;

    const opacity = Math.max(0, Math.min(1, state.opacity));
    this.root.visible = state.enabled && opacity > 0.001;
    if (!this.root.visible) return;

    // Convert NVS center to world position
    const centerX = state.x + state.w / 2;
    const centerY = state.y + state.h / 2;
    const [worldX, worldY] = coords.toWorld(centerX, centerY, state.z);
    this.root.position.set(worldX, worldY, state.z);
    this.root.rotation.set(state.tilt, state.yRotation, 0);

    // Scale to fit the desired NVS width in world units
    const [targetWorldWidth] = coords.toWorldSize(state.w, state.h);
    // FONT_SIZE is the geometry width at scale=1; divide target by it to get the uniform scale
    this.root.scale.setScalar(targetWorldWidth / FONT_SIZE);

    if (this.font && this.lastText !== state.text) {
      this.rebuildText(state.text);
    }

    const pulse = 0.88 + Math.sin(wallTimeSeconds * 1.7) * 0.06;
    const intensity = state.intensity * pulse * opacity;

    if (this.textMaterial) {
      this.textMaterial.emissive = new THREE.Color(state.emissiveColor);
      this.textMaterial.emissiveIntensity = intensity * 2.2;
      this.textMaterial.opacity = opacity;
    }
    if (this.haloMaterial) {
      this.haloMaterial.color = new THREE.Color(state.color);
      this.haloMaterial.opacity = intensity * 0.1;
    }
    if (this.signLight) {
      this.signLight.color = new THREE.Color(state.color);
      this.signLight.intensity = intensity * 1.4;
    }
  }

  dispose(): void {
    this.disposeText();
    if (this.root) {
      this.root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!('geometry' in mesh)) return;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((mat) => mat.dispose());
        else material?.dispose();
      });
      this.root.removeFromParent();
      this.root = null;
    }
    this.signGroup = null;
    this.signLight = null;
    this.textMaterial = null;
    this.haloMaterial = null;
  }

  private createRoot(): void {
    this.root = new THREE.Group();
    this.scene.add(this.root);

    // Sign group: offset so text (baseline at y=0, ascending to ~FONT_SIZE) is
    // vertically centred around the NVS anchor position.  The text geometry is
    // already horizontally centred (x=0) by the halfWidth calculation.
    this.signGroup = new THREE.Group();
    this.signGroup.position.set(0, -FONT_SIZE * 0.4, 0);
    this.root.add(this.signGroup);

    // A single point light positioned in front of the sign to cast the neon glow
    // onto nearby geometry.  Intensity is driven by the emissive pulse in update().
    this.signLight = new THREE.PointLight(0x00c8ff, 0, 22, 2);
    this.signLight.position.set(0, 0, 3);
    this.root.add(this.signLight);
  }

  private rebuildText(text: string): void {
    if (!this.signGroup || !this.font) return;
    this.disposeText();

    const built = createTextMeshes(this.font, text);
    this.textMeshes = built.meshes;
    this.textMaterial = built.tubeMaterial;
    this.haloMaterial = built.haloMaterial;

    for (const mesh of this.textMeshes) {
      mesh.position.z = 0;
      this.signGroup.add(mesh);
    }

    this.lastText = text;
  }

  private disposeText(): void {
    for (const mesh of this.textMeshes) {
      mesh.geometry.dispose();
      mesh.removeFromParent();
    }
    this.textMeshes = [];
    this.textMaterial?.dispose();
    this.haloMaterial?.dispose();
    this.textMaterial = null;
    this.haloMaterial = null;
  }
}
