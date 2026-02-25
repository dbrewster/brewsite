// Three.js rendering for DiagramState.
// WebGL only — no React.

import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { Text } from 'troika-three-text';
import type { DiagramEdgeState, DiagramGroupState, DiagramNodeState, DiagramState } from './types';
import { createShapeGeometry } from './shapes/geometryFactory';

export const diagramInteractionRegistry = new Set<THREE.Mesh>();
export const diagramInteractionLookup = new Map<THREE.Mesh, { diagramId: string; nodeId: string }>();

type NodeEntry = {
  group: THREE.Group;
  boxMesh: THREE.Mesh;
  border: THREE.LineSegments;
  label: Text;
  sublabel?: Text;
  iconHolder?: THREE.Group;
  diagramId: string;
  lastState?: DiagramNodeState;
};

type EdgeEntry = {
  group: THREE.Group;
  tube: THREE.Mesh;
  arrowStart?: THREE.Mesh;
  arrowEnd?: THREE.Mesh;
  lastState?: DiagramEdgeState;
};

type GroupEntry = {
  group: THREE.Group;
  fill: THREE.Mesh;
  border: THREE.LineSegments;
  label: Text;
  lastState?: DiagramGroupState;
};

const svgLoader = new SVGLoader();
const textureLoader = new THREE.TextureLoader();

let cachedDashTexture: THREE.CanvasTexture | null = null;
let cachedDotTexture: THREE.CanvasTexture | null = null;

const createCanvas = (size: number): HTMLCanvasElement | OffscreenCanvas => {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size, size);
  }
  return { width: size, height: size, getContext: () => null } as unknown as HTMLCanvasElement;
};

const getDashTexture = (): THREE.CanvasTexture => {
  if (cachedDashTexture) return cachedDashTexture;
  const size = 64;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext?.('2d') ?? null;
  if (ctx) {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'black';
    ctx.fillRect(size * 0.5, 0, size * 0.5, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 1);
  cachedDashTexture = texture;
  return texture;
};

const getDotTexture = (): THREE.CanvasTexture => {
  if (cachedDotTexture) return cachedDotTexture;
  const size = 32;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext?.('2d') ?? null;
  if (ctx) {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.5, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 1);
  cachedDotTexture = texture;
  return texture;
};

const iconCache = new Map<string, Promise<THREE.Object3D>>();

const loadIconObject = (url: string, width: number, height: number): Promise<THREE.Object3D> => {
  const cacheKey = `${url}|${width}|${height}`;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)!;

  const promise = new Promise<THREE.Object3D>((resolve) => {
    if (url.toLowerCase().endsWith('.svg')) {
      svgLoader.load(url, (data) => {
        const group = new THREE.Group();
        const paths = data.paths ?? [];
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
        paths.forEach((path) => {
          const shapes = SVGLoader.createShapes(path);
          shapes.forEach((shape) => {
            const geometry = new THREE.ShapeGeometry(shape);
            const mesh = new THREE.Mesh(geometry, material);
            group.add(mesh);
          });
        });
        const box = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = Math.min(
          width / Math.max(0.001, size.x),
          height / Math.max(0.001, size.y),
        );
        group.scale.setScalar(scale);
        box.setFromObject(group);
        const center = new THREE.Vector3();
        box.getCenter(center);
        group.position.set(-center.x, -center.y, 0);
        resolve(group);
      });
    } else {
      textureLoader.load(url, (texture) => {
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        resolve(mesh);
      });
    }
  });

  iconCache.set(cacheKey, promise);
  return promise;
};

const createBoxMaterials = (state: DiagramNodeState): THREE.MeshStandardMaterial[] => {
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
    transparent: true,
    opacity: state.opacity,
  });
  const back = side.clone();
  return [side, side.clone(), top, bottom, front, back];
};

const ensureText = (text: Text, value: string, color: string, fontSize: number, opacity: number): void => {
  text.text = value;
  text.color = color;
  text.fontSize = fontSize;
  text.fillOpacity = opacity;
  text.anchorX = 'center';
  text.anchorY = 'middle';
  text.sync();
};

export class DiagramRenderer {
  private diagramGroups = new Map<string, THREE.Group>();
  private nodeEntries = new Map<string, NodeEntry>();
  private edgeEntries = new Map<string, EdgeEntry>();
  private groupEntries = new Map<string, GroupEntry>();
  private lastState = new Map<string, DiagramState>();

  private nodeKey(diagramId: string, nodeId: string): string {
    return `${diagramId}::node::${nodeId}`;
  }
  private edgeKey(diagramId: string, edgeId: string): string {
    return `${diagramId}::edge::${edgeId}`;
  }
  private groupKey(diagramId: string, groupId: string): string {
    return `${diagramId}::group::${groupId}`;
  }

  update(state: DiagramState, scene: THREE.Scene): void {
    const prev = this.lastState.get(state.id);
    if (!this.diagramGroups.has(state.id)) {
      const root = new THREE.Group();
      root.name = `diagram:${state.id}`;
      this.diagramGroups.set(state.id, root);
      scene.add(root);
    }
    const root = this.diagramGroups.get(state.id)!;

    const nodesById = new Map(state.nodes.map((node) => [node.id, node]));
    const edgesById = new Map(state.edges.map((edge) => [edge.id, edge]));
    const groupsById = new Map(state.groups.map((group) => [group.id, group]));

    // Remove missing nodes
    for (const [id, entry] of this.nodeEntries) {
      if (entry.diagramId !== state.id) continue;
      const nodeId = id.split('::').slice(-1)[0];
      if (!nodesById.has(nodeId)) {
        root.remove(entry.group);
        diagramInteractionRegistry.delete(entry.boxMesh);
        diagramInteractionLookup.delete(entry.boxMesh);
        this.nodeEntries.delete(id);
      }
    }

    // Remove missing edges
    for (const [id, entry] of this.edgeEntries) {
      if (!id.startsWith(`${state.id}::edge::`)) continue;
      const edgeId = id.split('::').slice(-1)[0];
      if (!edgesById.has(edgeId)) {
        root.remove(entry.group);
        this.edgeEntries.delete(id);
      }
    }

    // Remove missing groups
    for (const [id, entry] of this.groupEntries) {
      if (!id.startsWith(`${state.id}::group::`)) continue;
      const groupId = id.split('::').slice(-1)[0];
      if (!groupsById.has(groupId)) {
        root.remove(entry.group);
        this.groupEntries.delete(id);
      }
    }

    // Groups first (background)
    state.groups.forEach((groupState) => {
      const entry = this.groupEntries.get(this.groupKey(state.id, groupState.id));
      const updated = entry ?? this.createGroup(groupState);
      this.updateGroup(updated, groupState);
      if (!entry) {
        this.groupEntries.set(this.groupKey(state.id, groupState.id), updated);
        root.add(updated.group);
      }
    });

    // Edges
    state.edges.forEach((edgeState) => {
      const entry = this.edgeEntries.get(this.edgeKey(state.id, edgeState.id));
      const updated = entry ?? this.createEdge(edgeState);
      this.updateEdge(updated, edgeState);
      if (!entry) {
        this.edgeEntries.set(this.edgeKey(state.id, edgeState.id), updated);
        root.add(updated.group);
      }
    });

    // Nodes
    state.nodes.forEach((nodeState) => {
      const entry = this.nodeEntries.get(this.nodeKey(state.id, nodeState.id));
      const updated = entry ?? this.createNode(nodeState, state.id);
      this.updateNode(updated, nodeState, state.id);
      if (!entry) {
        this.nodeEntries.set(this.nodeKey(state.id, nodeState.id), updated);
        root.add(updated.group);
      }
    });

    if (prev !== state) {
      this.lastState.set(state.id, state);
    }
  }

  dispose(diagramId: string, scene: THREE.Scene): void {
    const group = this.diagramGroups.get(diagramId);
    if (group) {
      scene.remove(group);
      this.diagramGroups.delete(diagramId);
    }
    for (const [id, entry] of this.nodeEntries) {
      if (entry.diagramId === diagramId) {
        diagramInteractionRegistry.delete(entry.boxMesh);
        diagramInteractionLookup.delete(entry.boxMesh);
        this.nodeEntries.delete(id);
      }
    }
    for (const [id, entry] of this.edgeEntries) {
      if (id.startsWith(`${diagramId}::edge::`)) this.edgeEntries.delete(id);
    }
    for (const [id, entry] of this.groupEntries) {
      if (id.startsWith(`${diagramId}::group::`)) this.groupEntries.delete(id);
    }
    this.lastState.delete(diagramId);
  }

  private createNode(state: DiagramNodeState, diagramId: string): NodeEntry {
    const group = new THREE.Group();
    const { geometry } = createShapeGeometry(state.shape, state.size, state.depth);
    const materials = createBoxMaterials(state);
    const boxMesh = new THREE.Mesh(geometry, materials);
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: state.borderColor,
        opacity: 0.8,
        transparent: true,
      }),
    );
    const label = new Text();
    const sublabel = state.sublabel ? new Text() : undefined;

    group.add(boxMesh, border, label);
    if (sublabel) group.add(sublabel);

    return { group, boxMesh, border, label, sublabel, diagramId, lastState: state };
  }

  private updateNode(entry: NodeEntry, state: DiagramNodeState, diagramId: string): void {
    const prev = entry.lastState;
    const geometryChanged =
      !prev ||
      prev.shape !== state.shape ||
      prev.size[0] !== state.size[0] ||
      prev.size[1] !== state.size[1] ||
      prev.depth !== state.depth;

    if (geometryChanged) {
      const { geometry } = createShapeGeometry(state.shape, state.size, state.depth);
      entry.boxMesh.geometry.dispose();
      entry.border.geometry.dispose();
      entry.boxMesh.geometry = geometry;
      entry.border.geometry = new THREE.EdgesGeometry(geometry);
    }

    entry.group.position.set(state.position[0], state.position[1], state.position[2]);
    entry.group.visible = state.enabled;

    const materials = createBoxMaterials(state);
    entry.boxMesh.material = materials;

    const borderMaterial = entry.border.material as THREE.LineBasicMaterial;
    borderMaterial.color.set(state.borderColor);
    borderMaterial.opacity = Math.min(1, state.opacity);
    borderMaterial.transparent = true;

    const labelY = state.iconUrl ? -state.size[1] * 0.1 : 0;
    ensureText(entry.label, state.label, state.labelColor, state.size[1] * 0.28, state.opacity);
    entry.label.position.set(0, labelY, state.depth / 2 + 0.02);
    entry.label.maxWidth = state.size[0] * 0.85;

    if (state.sublabel) {
      if (!entry.sublabel) {
        entry.sublabel = new Text();
        entry.group.add(entry.sublabel);
      }
      ensureText(entry.sublabel, state.sublabel, state.sublabelColor, state.size[1] * 0.18, state.opacity);
      entry.sublabel.position.set(0, labelY - state.size[1] * 0.22, state.depth / 2 + 0.02);
      entry.sublabel.maxWidth = state.size[0] * 0.85;
    } else if (entry.sublabel) {
      entry.group.remove(entry.sublabel);
      entry.sublabel = undefined;
    }

    if (state.clickable && state.enabled) {
      if (!diagramInteractionRegistry.has(entry.boxMesh)) {
        diagramInteractionRegistry.add(entry.boxMesh);
        diagramInteractionLookup.set(entry.boxMesh, { diagramId, nodeId: state.id });
      }
    } else if (diagramInteractionRegistry.has(entry.boxMesh)) {
      diagramInteractionRegistry.delete(entry.boxMesh);
      diagramInteractionLookup.delete(entry.boxMesh);
    }

    if (state.iconUrl) {
      if (!entry.iconHolder || entry.iconHolder.userData['iconUrl'] !== state.iconUrl) {
        if (entry.iconHolder) {
          entry.group.remove(entry.iconHolder);
        }
        const holder = new THREE.Group();
        holder.userData['iconUrl'] = state.iconUrl;
        entry.iconHolder = holder;
        entry.group.add(holder);
        const iconWidth = state.size[0] * state.iconScale;
        const iconHeight = state.size[1] * state.iconScale;
        loadIconObject(state.iconUrl, iconWidth, iconHeight).then((obj) => {
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

  private createEdge(state: DiagramEdgeState): EdgeEntry {
    const group = new THREE.Group();
    const points = state.controlPoints.length >= 2
      ? state.controlPoints.map((pt) => new THREE.Vector3(pt[0], pt[1], pt[2]))
      : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(
      curve,
      Math.max(20, state.controlPoints.length * 8),
      state.thickness,
      8,
      false,
    );
    const tubeMaterial = this.createTubeMaterial(state);
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    group.add(tube);

    return { group, tube, lastState: state };
  }

  private createTubeMaterial(state: DiagramEdgeState): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color: state.color,
      metalness: 0.3,
      roughness: 0.7,
      transparent: state.opacity < 1 || state.style !== 'solid',
      opacity: state.opacity,
    });
    if (state.style === 'dashed') {
      material.alphaMap = getDashTexture();
      material.transparent = true;
    } else if (state.style === 'dotted') {
      material.alphaMap = getDotTexture();
      material.transparent = true;
    }
    return material;
  }

  private updateEdge(entry: EdgeEntry, state: DiagramEdgeState): void {
    const points = state.controlPoints.map((pt) => new THREE.Vector3(pt[0], pt[1], pt[2]));
    if (points.length < 2) {
      entry.group.visible = false;
      return;
    }
    entry.group.visible = true;
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(
      curve,
      Math.max(20, points.length * 8),
      state.thickness,
      8,
      false,
    );
    entry.tube.geometry.dispose();
    entry.tube.geometry = geometry;
    const material = this.createTubeMaterial(state);
    entry.tube.material = material;

    const updateArrow = (kind: 'start' | 'end', variant: DiagramEdgeState['arrowEnd']) => {
      if (variant === 'none') {
        const existing = kind === 'start' ? entry.arrowStart : entry.arrowEnd;
        if (existing) {
          entry.group.remove(existing);
        }
        if (kind === 'start') entry.arrowStart = undefined;
        if (kind === 'end') entry.arrowEnd = undefined;
        return;
      }
      const arrow = kind === 'start'
        ? entry.arrowStart ?? new THREE.Mesh()
        : entry.arrowEnd ?? new THREE.Mesh();
      const cone = new THREE.ConeGeometry(state.thickness * 3, state.thickness * 8, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: state.color,
        metalness: 0.3,
        roughness: 0.7,
        transparent: state.opacity < 1,
        opacity: state.opacity,
      });
      arrow.geometry = cone;
      arrow.material = mat;
      const t = kind === 'start' ? 0 : 1;
      const position = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      const dir = kind === 'start' ? tangent.clone().multiplyScalar(-1) : tangent;
      arrow.position.copy(position);
      arrow.lookAt(position.clone().add(dir));
      arrow.rotateX(Math.PI / 2);
      if (!arrow.parent) {
        entry.group.add(arrow);
      }
      if (kind === 'start') entry.arrowStart = arrow;
      if (kind === 'end') entry.arrowEnd = arrow;
    };

    updateArrow('start', state.arrowStart);
    updateArrow('end', state.arrowEnd);

    entry.lastState = state;
  }

  private createGroup(state: DiagramGroupState): GroupEntry {
    const group = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(state.bounds.w, state.bounds.h);
    const fill = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: state.color,
        opacity: state.fillOpacity,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    const borderMaterial =
      state.borderStyle === 'dashed'
        ? new THREE.LineDashedMaterial({
          color: state.borderColor,
          opacity: state.borderOpacity,
          transparent: true,
          dashSize: 0.3,
          gapSize: 0.2,
        })
        : new THREE.LineBasicMaterial({
          color: state.borderColor,
          opacity: state.borderOpacity,
          transparent: true,
        });
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), borderMaterial);
    if (borderMaterial instanceof THREE.LineDashedMaterial) {
      border.computeLineDistances();
    }
    const label = new Text();
    group.add(fill, border, label);
    return { group, fill, border, label, lastState: state };
  }

  private updateGroup(entry: GroupEntry, state: DiagramGroupState): void {
    const centerX = state.bounds.x + state.bounds.w / 2;
    const centerY = state.bounds.y + state.bounds.h / 2;
    entry.group.position.set(centerX, centerY, -0.6);

    const geometry = new THREE.PlaneGeometry(state.bounds.w, state.bounds.h);
    entry.fill.geometry.dispose();
    entry.fill.geometry = geometry;
    entry.border.geometry.dispose();
    entry.border.geometry = new THREE.EdgesGeometry(geometry);

    const fillMat = entry.fill.material as THREE.MeshBasicMaterial;
    fillMat.color.set(state.color);
    fillMat.opacity = state.fillOpacity;
    fillMat.transparent = true;

    const borderMat = entry.border.material as THREE.LineBasicMaterial | THREE.LineDashedMaterial;
    if (state.borderStyle === 'dashed' && !(borderMat instanceof THREE.LineDashedMaterial)) {
      entry.border.material = new THREE.LineDashedMaterial({
        color: state.borderColor,
        opacity: state.borderOpacity,
        transparent: true,
        dashSize: 0.3,
        gapSize: 0.2,
      });
    }
    if (state.borderStyle === 'solid' && !(borderMat instanceof THREE.LineBasicMaterial)) {
      entry.border.material = new THREE.LineBasicMaterial({
        color: state.borderColor,
        opacity: state.borderOpacity,
        transparent: true,
      });
    }
    const activeMat = entry.border.material as THREE.LineBasicMaterial | THREE.LineDashedMaterial;
    activeMat.color.set(state.borderColor);
    activeMat.opacity = state.borderOpacity;
    activeMat.transparent = true;
    if (activeMat instanceof THREE.LineDashedMaterial) {
      entry.border.computeLineDistances();
    }

    ensureText(entry.label, state.label, '#ffffff', Math.max(0.4, state.bounds.h * 0.08), 1);
    entry.label.position.set(
      -state.bounds.w / 2 + 0.4,
      state.bounds.h / 2 + 0.4,
      0.01,
    );

    entry.lastState = state;
  }
}
