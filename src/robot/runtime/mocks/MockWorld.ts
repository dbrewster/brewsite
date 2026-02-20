import {composeMatrix, copyVec3, decomposeMatrix, multiplyMatrices, type Vec3} from '../math';
import type {Component, Node, World, WorldSnapshot} from '../types';

const createVec3 = (value?: Vec3): Vec3 => (value ? [value[0], value[1], value[2]] : [0, 0, 0]);

export class MockNode implements Node {
  name: string;
  parent?: Node;
  children: Node[] = [];
  localPosition: Vec3;
  localRotation: Vec3;
  localScale: Vec3;
  worldPosition: Vec3;
  worldRotation: Vec3;
  worldScale: Vec3;
  components: Component[] = [];
  matrixWorld?: number[];

  constructor(name: string, options?: { position?: Vec3; rotation?: Vec3; scale?: Vec3 }) {
    this.name = name;
    this.localPosition = createVec3(options?.position);
    this.localRotation = createVec3(options?.rotation);
    this.localScale = options?.scale ? [options.scale[0], options.scale[1], options.scale[2]] : [1, 1, 1];
    this.worldPosition = createVec3(this.localPosition);
    this.worldRotation = createVec3(this.localRotation);
    this.worldScale = createVec3(this.localScale);
  }

  add(child: Node): void {
    if (child.parent) {
      child.parent.remove(child);
    }
    child.parent = this;
    this.children.push(child);
  }

  remove(child: Node): void {
    this.children = this.children.filter((node) => node !== child);
    if (child.parent === this) {
      child.parent = undefined;
    }
  }
}

export class MockWorld implements World {
  nodesByName: Map<string, Node> = new Map();
  root: Node;

  constructor(rootName = 'ROOT') {
    this.root = new MockNode(rootName);
    this.nodesByName.set(rootName, this.root);
  }

  createNode(name: string): Node {
    return new MockNode(name);
  }

  addNode(node: Node, parentName?: string): void {
    const parent = parentName ? this.getNode(parentName) : this.root;
    if (!parent) {
      throw new Error(`Parent node not found: ${parentName ?? 'ROOT'}`);
    }
    parent.add(node);
    this.nodesByName.set(node.name, node);
  }

  removeNode(name: string): void {
    const node = this.nodesByName.get(name);
    if (!node) return;
    if (node.parent) {
      node.parent.remove(node);
    }
    const removeRecursive = (target: Node) => {
      this.nodesByName.delete(target.name);
      target.children.forEach((child) => removeRecursive(child));
    };
    removeRecursive(node);
  }

  getNode(name: string): Node | null {
    return this.nodesByName.get(name) ?? null;
  }

  updateWorldMatrix(): void {
    const updateNode = (node: Node, parentMatrix?: number[]) => {
      const localMatrix = composeMatrix(node.localPosition, node.localRotation, node.localScale);
      const worldMatrix = parentMatrix ? multiplyMatrices(parentMatrix as any, localMatrix) : localMatrix;
      const decomposed = decomposeMatrix(worldMatrix as any);
      node.worldPosition = copyVec3(decomposed.position);
      node.worldRotation = copyVec3(decomposed.rotation);
      node.worldScale = copyVec3(decomposed.scale);
      node.matrixWorld = worldMatrix;
      node.children.forEach((child) => updateNode(child, worldMatrix));
    };

    updateNode(this.root);
  }

  snapshot(): WorldSnapshot {
    const nodes: WorldSnapshot['nodes'] = [];
    for (const node of this.nodesByName.values()) {
      nodes.push({
        name: node.name,
        worldPosition: copyVec3(node.worldPosition),
        worldRotation: copyVec3(node.worldRotation),
        worldScale: copyVec3(node.worldScale),
        components: node.components.map((component) => ({
          type: component.type,
          props: { ...component.props },
        })),
      });
    }
    return { nodes };
  }
}
