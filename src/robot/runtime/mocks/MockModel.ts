import type {BodyPartOverrideMap} from '../../model/robotSceneTypes';
import {copyVec3, type Vec3} from '../math';
import type {AnchoredObject, Component, Model, Node} from '../types';
import {MockNode, MockWorld} from './MockWorld';

const findComponent = (node: Node, type: Component['type']): Component | undefined =>
  node.components.find((component) => component.type === type);

const removeAnchoredNodes = (node: Node, predicate: (node: Node) => boolean) => {
  const toRemove = node.children.filter(predicate);
  toRemove.forEach((child) => node.remove(child));
  node.children.forEach((child) => removeAnchoredNodes(child, predicate));
};

export class MockModel implements Model {
  world: MockWorld;
  rootName: string;
  private anchoredNodes: Map<string, Node> = new Map();
  private containedModels: Map<string, Model> = new Map();

  constructor(rootName = 'RobotRoot', world?: MockWorld) {
    this.world = world ?? new MockWorld('WorldRoot');
    this.rootName = rootName;
    if (!this.world.getNode(rootName)) {
      this.world.addNode(new MockNode(rootName));
    }
  }

  getRoot(): Node {
    const root = this.world.getNode(this.rootName);
    if (!root) throw new Error(`Model root not found: ${this.rootName}`);
    return root;
  }

  getObject(name: string): Node | null {
    return this.world.getNode(name);
  }

  traverse(fn: (node: Node) => void): void {
    const visit = (node: Node) => {
      fn(node);
      node.children.forEach(visit);
    };
    visit(this.getRoot());
  }

  updateWorldMatrix(): void {
    this.world.updateWorldMatrix();
  }

  applyMaterialOverrides(overrides: BodyPartOverrideMap, _options?: { metalness?: number; roughness?: number; opacity?: number }): void {
    for (const [targetName, value] of Object.entries(overrides)) {
      if (!value) continue;
      const node = this.world.getNode(targetName);
      if (!node) continue;
      const existing = findComponent(node, 'materialOverride');
      const props = {
        ...(existing?.props ?? {}),
        ...value,
      } as Component['props'];
      if (existing) {
        existing.props = props;
      } else {
        node.components.push({ type: 'materialOverride', props });
      }
    }
  }

  setAnchoredObjects(objects: AnchoredObject[]): void {
    const root = this.getRoot();
    const nextIds = new Set(objects.map((obj) => obj.id));
    for (const [id, node] of this.anchoredNodes) {
      if (nextIds.has(id)) continue;
      node.parent?.remove(node);
      this.world.removeNode(node.name);
      this.anchoredNodes.delete(id);
    }

    objects.forEach((obj) => {
      const anchorNode = this.world.getNode(obj.anchorId);
      if (!anchorNode) return;
      if (obj.type === 'model') {
        const childRoot = obj.model.getRoot();
        if (!childRoot) return;
        if (childRoot.parent !== anchorNode) {
          anchorNode.add(childRoot);
        }
        childRoot.localPosition = copyVec3(obj.localPosition);
        const applyRotationScale = obj.applyRotationScale !== false;
        if (applyRotationScale) {
          childRoot.localRotation = copyVec3(obj.localRotation);
          if (Array.isArray(obj.localScale)) {
            childRoot.localScale = copyVec3(obj.localScale);
          } else {
            childRoot.localScale = [obj.localScale, obj.localScale, obj.localScale] as Vec3;
          }
        }
        this.anchoredNodes.set(obj.id, childRoot);
      } else if (obj.type === 'component') {
        const nodeName = `ANCHOR_${obj.id}`;
        let anchorChild = this.world.getNode(nodeName);
        if (!anchorChild) {
          anchorChild = new MockNode(nodeName);
          this.world.addNode(anchorChild, anchorNode.name);
        }
        anchorChild.localPosition = copyVec3(obj.localPosition);
        anchorChild.localRotation = copyVec3(obj.localRotation);
        anchorChild.localScale = Array.isArray(obj.localScale)
          ? copyVec3(obj.localScale)
          : [obj.localScale, obj.localScale, obj.localScale];
        const existing = findComponent(anchorChild, obj.componentType);
        const nextProps = { enabled: obj.enabled, ...obj.props };
        if (existing) {
          existing.props = nextProps;
        } else {
          anchorChild.components.push({ type: obj.componentType, props: nextProps });
        }
        this.anchoredNodes.set(obj.id, anchorChild);
      }
    });

    removeAnchoredNodes(root, (node) => {
      if (!node.name.startsWith('ANCHOR_')) return false;
      const id = node.name.replace('ANCHOR_', '');
      return !this.anchoredNodes.has(id);
    });
  }

  getContainedModel(id: string): Model | null {
    return this.containedModels.get(id) ?? null;
  }

  setContainedModel(id: string, model: Model | null): void {
    if (!id) return;
    if (!model) {
      this.containedModels.delete(id);
      return;
    }
    this.containedModels.set(id, model);
  }
}
