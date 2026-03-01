import * as THREE from 'three';
import opentype from 'opentype.js';
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
  private warmLight: THREE.PointLight | null = null;
  private coolLight: THREE.PointLight | null = null;
  private fadeMaterials: THREE.MeshPhysicalMaterial[] = [];

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

  update(state: NeonSignState, wallTimeSeconds: number): void {
    if (!this.root) this.createRoot();
    if (!this.root || !this.signGroup) return;

    const opacity = Math.max(0, Math.min(1, state.opacity));
    this.root.visible = state.enabled && opacity > 0.001;
    if (!this.root.visible) return;

    this.root.position.set(state.position[0], state.position[1], state.position[2]);
    this.root.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    this.root.scale.setScalar(state.scale);

    if (this.font && this.lastText !== state.text) {
      this.rebuildText(state.text);
    }

    const pulse = 0.88 + Math.sin(wallTimeSeconds * 1.7) * 0.06;
    const intensity = state.intensity * pulse * opacity;

    for (const material of this.fadeMaterials) {
      material.opacity = opacity;
    }

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
    if (this.warmLight) {
      this.warmLight.intensity = (3.2 + Math.sin(wallTimeSeconds * 7.2) * 0.2) * opacity;
    }
    if (this.coolLight) {
      this.coolLight.intensity = (2.2 + Math.sin(wallTimeSeconds * 5.5) * 0.1) * opacity;
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
    this.warmLight = null;
    this.coolLight = null;
    this.textMaterial = null;
    this.haloMaterial = null;
    this.fadeMaterials = [];
  }

  private createRoot(): void {
    this.root = new THREE.Group();
    this.scene.add(this.root);

    const room = new THREE.Group();
    this.root.add(room);

    const wallMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a0e18,
      metalness: 0.88,
      roughness: 0.32,
      transparent: true,
      opacity: 1,
    });
    const floorMat = new THREE.MeshPhysicalMaterial({
      color: 0x060910,
      metalness: 0.97,
      roughness: 0.04,
      transparent: true,
      opacity: 1,
    });
    this.fadeMaterials.push(wallMat, floorMat);

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), wallMat);
    backWall.position.set(0, 4, -16);
    room.add(backWall);

    const sideGeo = new THREE.PlaneGeometry(36, 40);
    const leftWall = new THREE.Mesh(sideGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-24, 4, 0);
    room.add(leftWall);

    const rightWall = new THREE.Mesh(sideGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(24, 4, 0);
    room.add(rightWall);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 55), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -7;
    room.add(floor);

    this.signGroup = new THREE.Group();
    this.signGroup.position.set(0, 1.4, 0);
    this.root.add(this.signGroup);

    const ambient = new THREE.AmbientLight(0x080d16, 2.2);
    this.root.add(ambient);

    this.warmLight = new THREE.PointLight(0xff7700, 3.2, 70, 1.4);
    this.warmLight.position.set(-18, 16, 6);
    this.root.add(this.warmLight);

    this.coolLight = new THREE.PointLight(0x0044cc, 2.2, 60, 1.4);
    this.coolLight.position.set(18, 12, 5);
    this.root.add(this.coolLight);

    this.signLight = new THREE.PointLight(0x00c8ff, 0, 22, 2);
    this.signLight.position.set(0, 1.4, 0);
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
