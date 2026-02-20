import type {Scene} from 'three';
import {BufferAttribute, Color, Mesh, MeshPhysicalMaterial, NormalBlending, Object3D, PointLight, TubeGeometry,} from 'three';
import {buildRibbonStrands} from '../../../components/logoParticleOptimizedViewer/ribbonUtils';
import type {RibbonConfig, SceneRibbon} from './types';

export type RibbonThreeRefs = {
  scene: Scene;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const gaussian = (x: number, center: number, width: number) => {
  const d = (x - center) / width;
  return Math.exp(-0.5 * d * d);
};

const makeRibbonColor = (t: number, strandIndex: number, strandCount: number) => {
  const strandT = strandCount <= 1 ? 0.5 : strandIndex / (strandCount - 1);
  const hue = (36 - 14 * strandT) / 360;
  const spotShift = 0.03 * (strandT - 0.5);
  const spots =
    1.1 * gaussian(t, 0.16 + spotShift, 0.05) +
    1.35 * gaussian(t, 0.5 - spotShift * 0.6, 0.065) +
    1.2 * gaussian(t, 0.84 + spotShift, 0.055);
  const shimmer = 0.26 * Math.sin(Math.PI * 4 * t + strandT * Math.PI * 1.3);
  const lightness = clamp01(0.48 + 0.24 * shimmer + 0.36 * spots);
  return new Color().setHSL(hue, 0.95, lightness);
};

class RibbonRenderer {
  private scene: Scene;
  private group: Object3D | null = null;
  private meshes: Mesh[] = [];
  private materials: MeshPhysicalMaterial[] = [];
  private geometries: TubeGeometry[] = [];
  private glowLights: PointLight[] = [];
  private structureKey: string | null = null;
  private materialKey: string | null = null;
  private configKeyCache = new WeakMap<object, string>();
  private warnedMissing = false;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  update(state: SceneRibbon): void {
    if (!state.enabled || !state.config) {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);
    if (!this.group) {
      this.group = new Object3D();
    }
    if (this.group.parent !== this.scene) {
      this.scene.add(this.group);
    }
    this.group.position.set(state.config.position[0], state.config.position[1], state.config.position[2]);
    this.group.rotation.set(state.config.rotation[0], state.config.rotation[1], state.config.rotation[2]);
    this.group.scale.set(state.config.scale[0], state.config.scale[1], state.config.scale[2]);
    const nextStructureKey = this.getStructureKey(state.config);
    if (nextStructureKey !== this.structureKey) {
      this.rebuild(state.config);
      this.structureKey = nextStructureKey;
      this.materialKey = this.getMaterialKey(state.config);
      return;
    }
    const nextMaterialKey = this.getMaterialKey(state.config);
    if (nextMaterialKey !== this.materialKey) {
      this.updateMaterials(state.config);
      this.updateGlowLights(state.config);
      this.materialKey = nextMaterialKey;
    }
  }

  dispose(): void {
    this.cleanup();
    if (this.group) this.group.removeFromParent();
    this.group = null;
  }

  private setVisible(visible: boolean) {
    if (this.group) this.group.visible = visible;
  }

  private rebuild(config: RibbonConfig): void {
    this.cleanup();
    if (!this.group) {
      this.group = new Object3D();
    }
    const strands = buildRibbonStrands(config);
    const radialSegments = 6;
    this.geometries = strands.map((strand, strandIndex) => {
      const geom = new TubeGeometry(strand.curve, config.segments, config.radius, radialSegments, false);
      const positions = geom.attributes.position.array as Float32Array;
      const radial = radialSegments + 1;
      const colors = new Float32Array(positions.length);
      for (let i = 0; i < positions.length; i += 3) {
        const ringIndex = Math.floor(i / 3 / radial);
        const t = ringIndex / Math.max(1, config.segments);
        const taper = Math.max(0.05, 1 - (1 - t) * config.radiusTaper);
        positions[i] *= taper;
        positions[i + 1] *= taper;
        positions[i + 2] *= taper;
        const color = makeRibbonColor(t, strandIndex, strands.length);
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
      }
      geom.attributes.position.needsUpdate = true;
      geom.setAttribute('color', new BufferAttribute(colors, 3));
      geom.computeVertexNormals();
      return geom;
    });
    this.materials = strands.map(
      () =>
        new MeshPhysicalMaterial({
          vertexColors: true,
          transparent: true,
          opacity: typeof config.opacity === 'number' ? config.opacity : 0.96,
          roughness: 0.05,
          metalness: 0.0,
          transmission: 0.9,
          thickness: 0.24,
          ior: 1.45,
          clearcoat: 1.0,
          clearcoatRoughness: 0.08,
          envMapIntensity: 2.8,
          emissive: new Color(1.0, 0.45, 0.15),
          emissiveIntensity: 0.85,
          blending: NormalBlending,
          depthWrite: false,
        }),
    );
    this.meshes = this.geometries.map((geometry, index) => {
      const mesh = new Mesh(geometry, this.materials[index]);
      this.group?.add(mesh);
      return mesh;
    });
    if (config.glowLightsEnabled && config.glowLightCount > 0) {
      const strand = strands[0];
      if (strand) {
        const step = Math.max(1, Math.floor(strand.points.length / config.glowLightCount));
        const points = strand.points.filter((_, index) => index % step === 0).slice(0, config.glowLightCount);
        this.glowLights = points.map((point, index) => {
          const light = new PointLight(config.glowLightColor, config.glowLightIntensity, config.glowLightDistance, config.glowLightDecay);
          light.position.set(point.x, point.y, point.z);
          light.name = `RibbonGlow_${index}`;
          this.group?.add(light);
          return light;
        });
      }
    }
    this.updateMaterials(config);
  }

  private cleanup(): void {
    this.meshes.forEach((mesh) => mesh.removeFromParent());
    this.glowLights.forEach((light) => light.removeFromParent());
    this.meshes = [];
    this.glowLights = [];
    this.geometries.forEach((geom) => geom.dispose());
    this.materials.forEach((mat) => mat.dispose());
    this.geometries = [];
    this.materials = [];
  }

  private updateMaterials(config: RibbonConfig): void {
    const opacity = typeof config.opacity === 'number' ? config.opacity : 0.96;
    this.materials.forEach((material) => {
      material.opacity = opacity;
    });
  }

  private updateGlowLights(config: RibbonConfig): void {
    if (!config.glowLightsEnabled || config.glowLightCount <= 0) {
      this.glowLights.forEach((light) => light.removeFromParent());
      this.glowLights = [];
      return;
    }
    this.glowLights.forEach((light) => {
      light.color = new Color(config.glowLightColor);
      light.intensity = config.glowLightIntensity;
      light.distance = config.glowLightDistance;
      light.decay = config.glowLightDecay;
    });
  }

  private getStructureKey(config: RibbonConfig): string {
    const cached = this.configKeyCache.get(config as unknown as object);
    if (cached) return cached;
    const key = [
      config.strandCount,
      config.spacing,
      config.radius,
      config.radiusTaper,
      config.segments,
      config.twistFrequency,
      config.twistPhase,
      config.glowLightsEnabled ? 1 : 0,
      config.glowLightCount,
      config.curve.width,
      config.curve.yOffset,
      config.curve.z,
      config.curve.waveAmplitude,
      config.curve.waveFrequency,
      config.curve.depthAmplitude,
      config.curve.depthFrequency,
      config.curve.depthPhase,
    ].join('|');
    this.configKeyCache.set(config as unknown as object, key);
    return key;
  }

  private getMaterialKey(config: RibbonConfig): string {
    return [
      typeof config.opacity === 'number' ? config.opacity : 'auto',
      config.glowLightsEnabled ? 1 : 0,
      config.glowLightCount,
      config.glowLightIntensity,
      config.glowLightColor,
      config.glowLightDistance,
      config.glowLightDecay,
    ].join('|');
  }

  private warnMissing(component: string, node: string) {
    if (this.warnedMissing) return;
    this.warnedMissing = true;
    console.warn('[RobotRuntime]', 'runtime.renderer.componentMissing', { component, node });
  }
}

const renderers = new WeakMap<Scene, RibbonRenderer>();
const rendererSet = new Set<RibbonRenderer>();

export function applyRibbon(state: SceneRibbon, refs: RibbonThreeRefs): void {
  let renderer = renderers.get(refs.scene);
  if (!renderer) {
    renderer = new RibbonRenderer(refs.scene);
    renderers.set(refs.scene, renderer);
    rendererSet.add(renderer);
  }
  renderer.update(state);
}

export function disposeRibbon(): void {
  rendererSet.forEach((renderer) => renderer.dispose());
  rendererSet.clear();
}
