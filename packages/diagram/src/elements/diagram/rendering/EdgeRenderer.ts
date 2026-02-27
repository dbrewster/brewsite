// Create/update/dispose Three.js tube+arrow geometry for diagram edges and canvas pipes.

import * as THREE from 'three';
import type { EdgeRenderEntry } from './types';
import type { IEdgeMaterialFactory } from './EdgeMaterialFactory';

export type EdgeLike = {
  id: string;
  controlPoints: ReadonlyArray<readonly [number, number, number]>;
  thickness: number;
  color: string;
  opacity: number;
  style?: 'solid' | 'dashed' | 'dotted';
  arrowStart?: string;
  arrowEnd?: string;
  flow?: 'none' | 'forward' | 'backward' | 'bidirectional';
  flowColor?: string;
};

type EdgeEntry = Omit<EdgeRenderEntry, 'lastState'> & { lastState?: EdgeLike };

export class EdgeRenderer {
  private readonly entries = new Map<string, EdgeEntry>();
  private readonly pulseUniformKey = '__brewsite_edge_pulse';
  private readonly pulseShaderKey = '__brewsite_edge_pulse_shader';

  constructor(
    private readonly materialFactory: IEdgeMaterialFactory,
    private readonly use3DArrows: boolean = false,
    private readonly edgeSmoothness: number = 0.5,
    private readonly edgeMetalness: number = 0.3,
    private readonly edgeRoughness: number = 0.7,
  ) {}

  getOrCreate(edge: EdgeLike, parent: THREE.Object3D): EdgeRenderEntry {
    const existing = this.entries.get(edge.id);
    if (existing) {
      this.updateEntry(existing, edge);
      return existing;
    }
    const entry = this.createEntry(edge);
    this.updateEntry(entry, edge);
    parent.add(entry.group);
    this.entries.set(edge.id, entry);
    return entry;
  }

  dispose(edgeId: string, parent: THREE.Object3D): void {
    const entry = this.entries.get(edgeId);
    if (!entry) return;
    parent.remove(entry.group);
    this.disposeEntry(entry);
    this.entries.delete(edgeId);
  }

  disposeAll(parent: THREE.Object3D): void {
    for (const entry of this.entries.values()) {
      parent.remove(entry.group);
      this.disposeEntry(entry);
    }
    this.entries.clear();
  }

  get ids(): ReadonlySet<string> {
    return new Set(this.entries.keys());
  }

  private createEntry(edge: EdgeLike): EdgeEntry {
    const group = new THREE.Group();
    const points = edge.controlPoints.length >= 2
      ? edge.controlPoints.map((pt) => new THREE.Vector3(pt[0], pt[1], pt[2]))
      : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
    const curve = points.length === 4
      ? new THREE.CubicBezierCurve3(points[0]!, points[1]!, points[2]!, points[3]!)
      : new THREE.CatmullRomCurve3(points);
    const segments = Math.max(
      20,
      Math.round((points.length === 4 ? 40 : edge.controlPoints.length * 8) * this.edgeSmoothness),
    );
    const tubeGeometry = new THREE.TubeGeometry(
      curve,
      segments,
      edge.thickness,
      8,
      false,
    );
    const tubeMaterial = this.materialFactory.createMaterial(
      edge.color,
      edge.opacity,
      edge.style ?? 'solid',
      this.edgeMetalness,
      this.edgeRoughness,
    );
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    group.add(tube);
    return { group, tube, lastState: edge };
  }

  private updateEntry(entry: EdgeEntry, edge: EdgeLike): void {
    if (edge.controlPoints.length < 2) {
      entry.group.visible = false;
      entry.lastState = edge;
      return;
    }
    entry.group.visible = true;

    const prev = entry.lastState;
    const needsGeometry =
      !prev ||
      edge.controlPoints !== prev.controlPoints ||
      edge.thickness !== prev.thickness;

    let curve: THREE.Curve<THREE.Vector3> | undefined;
    const getCurve = (): THREE.Curve<THREE.Vector3> => {
      if (!curve) {
        const points = edge.controlPoints.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
        curve = points.length === 4
          ? new THREE.CubicBezierCurve3(points[0]!, points[1]!, points[2]!, points[3]!)
          : new THREE.CatmullRomCurve3(points);
      }
      return curve;
    };

    if (needsGeometry) {
      const c = getCurve();
      const segments = Math.max(
        20,
        Math.round((edge.controlPoints.length === 4 ? 40 : edge.controlPoints.length * 8) * this.edgeSmoothness),
      );
      const geometry = new THREE.TubeGeometry(
        c,
        segments,
        edge.thickness,
        8,
        false,
      );
      entry.tube.geometry.dispose();
      entry.tube.geometry = geometry;
    }

    const edgeMaterialRebuild =
      !prev ||
      prev.color !== edge.color ||
      prev.style !== edge.style ||
      prev.thickness !== edge.thickness;
    if (edgeMaterialRebuild) {
      (entry.tube.material as THREE.Material).dispose();
      entry.tube.material = this.materialFactory.createMaterial(
        edge.color,
        edge.opacity,
        edge.style ?? 'solid',
        this.edgeMetalness,
        this.edgeRoughness,
      );
    } else if (prev && prev.opacity !== edge.opacity) {
      const mat = entry.tube.material as THREE.MeshStandardMaterial;
      mat.opacity = edge.opacity;
      mat.transparent = edge.opacity < 1 || edge.style !== 'solid';
    }

    const mat = entry.tube.material as THREE.MeshStandardMaterial;
    this.updatePulseMaterial(mat, edge);

    const arrowsNeedUpdate =
      needsGeometry ||
      !prev ||
      prev.arrowStart !== edge.arrowStart ||
      prev.arrowEnd !== edge.arrowEnd;

    if (arrowsNeedUpdate) {
      const updateArrow = (kind: 'start' | 'end', variant: EdgeLike['arrowEnd']) => {
        if (variant === 'none') {
          const existing = kind === 'start' ? entry.arrowStart : entry.arrowEnd;
          if (existing) {
            entry.group.remove(existing);
            existing.geometry.dispose();
            (existing.material as THREE.Material).dispose();
          }
          if (kind === 'start') entry.arrowStart = undefined;
          if (kind === 'end') entry.arrowEnd = undefined;
          return;
        }
        const arrow = kind === 'start'
          ? entry.arrowStart ?? new THREE.Mesh()
          : entry.arrowEnd ?? new THREE.Mesh();

        const arrowH = edge.thickness * 9;
        const arrowW = edge.thickness * 7;
        if (this.use3DArrows) {
          if (arrow.geometry) arrow.geometry.dispose();
          arrow.geometry = new THREE.ConeGeometry(arrowW * 0.5, arrowH, 14, 1);
          if (arrow.material) (arrow.material as THREE.Material).dispose();
          arrow.material = new THREE.MeshStandardMaterial({
            color: edge.color,
            metalness: this.edgeMetalness,
            roughness: this.edgeRoughness,
            transparent: edge.opacity < 1,
            opacity: edge.opacity,
          });
        } else {
          const arrowShape = new THREE.Shape();
          arrowShape.moveTo(0, 0);
          arrowShape.lineTo(-arrowW / 2, -arrowH);
          arrowShape.lineTo(arrowW / 2, -arrowH);
          arrowShape.closePath();
          if (arrow.geometry) arrow.geometry.dispose();
          arrow.geometry = new THREE.ShapeGeometry(arrowShape);
          if (arrow.material) (arrow.material as THREE.Material).dispose();
          arrow.material = new THREE.MeshBasicMaterial({
            color: edge.color,
            transparent: edge.opacity < 1,
            opacity: edge.opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
        }

        const curveT = kind === 'start' ? 0.02 : 0.98;
        const c = getCurve();
        const endPoint = c.getPointAt(kind === 'start' ? 0 : 1);
        const tangent = c.getTangentAt(curveT).normalize();
        const dir = kind === 'start' ? tangent.clone().multiplyScalar(-1) : tangent;

        if (this.use3DArrows) {
          // Place cone so its base center sits on the pipe centerline,
          // slightly ahead of the tube end to avoid embedding.
          const baseCenter = endPoint.clone().addScaledVector(dir, edge.thickness * 0.5);
          const center = baseCenter.clone().addScaledVector(dir, arrowH * 0.5);
          arrow.position.copy(center);
          arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        } else {
          arrow.position.copy(endPoint);
          arrow.rotation.set(0, 0, Math.atan2(-dir.x, dir.y));
        }

        if (!arrow.parent) {
          entry.group.add(arrow);
        }
        if (kind === 'start') entry.arrowStart = arrow;
        if (kind === 'end') entry.arrowEnd = arrow;
      };

      updateArrow('start', edge.arrowStart ?? 'none');
      updateArrow('end', edge.arrowEnd ?? 'none');
    }

    entry.lastState = edge;
  }

  private updatePulseMaterial(material: THREE.MeshStandardMaterial, edge: EdgeLike): void {
    const flow = edge.flow ?? 'none';
    const wantsPulse = flow !== 'none';

    const mat = material as THREE.MeshStandardMaterial & {
      userData: Record<string, unknown>;
      onBeforeCompile?: (shader: THREE.Shader) => void;
      defines?: Record<string, unknown>;
    };

    const existing = mat.userData[this.pulseUniformKey] as {
      uniforms: {
        uTime: { value: number };
        uPulseColor: { value: THREE.Color };
        uPulseSpeed: { value: number };
        uPulseWidth: { value: number };
        uPulseIntensity: { value: number };
        uPulseDir: { value: number };
        uPulseBidirectional: { value: number };
      };
    } | undefined;

    if (wantsPulse && !existing) {
      const uniforms = {
        uTime: { value: 0 },
        uPulseColor: { value: new THREE.Color(edge.flowColor ?? edge.color) },
        uPulseSpeed: { value: 0.7 },
        uPulseWidth: { value: 0.18 },
        uPulseIntensity: { value: 0.9 },
        uPulseDir: { value: 1 },
        uPulseBidirectional: { value: 0 },
      };
      mat.userData[this.pulseUniformKey] = { uniforms };
      if (!mat.defines) mat.defines = {};
      mat.defines['USE_UV'] = '';

      const prevOnBefore = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader) => {
        prevOnBefore?.(shader);
        Object.assign(shader.uniforms, uniforms);
        if (!shader.fragmentShader.includes('uPulseColor')) {
          shader.fragmentShader = shader.fragmentShader.replace(
            'void main() {',
            [
              'uniform float uTime;',
              'uniform vec3 uPulseColor;',
              'uniform float uPulseSpeed;',
              'uniform float uPulseWidth;',
              'uniform float uPulseIntensity;',
              'uniform float uPulseDir;',
              'uniform float uPulseBidirectional;',
              'void main() {',
            ].join('\n'),
          );
        }
        if (shader.fragmentShader.includes(this.pulseShaderKey)) return;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          [
            `#include <dithering_fragment>`,
            `// ${this.pulseShaderKey}`,
            `float pulseT = mod(uTime * uPulseSpeed * uPulseDir, 1.0);`,
            `if (pulseT < 0.0) pulseT += 1.0;`,
            `float pulse = exp(-pow((vUv.x - pulseT) / uPulseWidth, 2.0) * 4.0);`,
            `if (uPulseBidirectional > 0.5) {`,
            `  float pulseT2 = mod(uTime * uPulseSpeed, 1.0);`,
            `  float pulse2 = exp(-pow((vUv.x - (1.0 - pulseT2)) / uPulseWidth, 2.0) * 4.0);`,
            `  pulse = max(pulse, pulse2);`,
            `}`,
            `diffuseColor.rgb = mix(diffuseColor.rgb, uPulseColor, pulse * uPulseIntensity);`,
          ].join('\n'),
        );
      };
      mat.needsUpdate = true;
    }

    const pulseData = (mat.userData[this.pulseUniformKey] as { uniforms: { [key: string]: { value: unknown } } } | undefined);
    if (!pulseData) return;

    const uniforms = pulseData.uniforms;
    uniforms.uTime.value = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    uniforms.uPulseColor.value = new THREE.Color(edge.flowColor ?? edge.color);
    uniforms.uPulseDir.value = flow === 'backward' ? -1 : 1;
    uniforms.uPulseBidirectional.value = flow === 'bidirectional' ? 1 : 0;
    uniforms.uPulseIntensity.value = wantsPulse ? 0.9 : 0;
  }

  private disposeEntry(entry: EdgeEntry): void {
    entry.tube.geometry.dispose();
    (entry.tube.material as THREE.Material).dispose();
    if (entry.arrowStart) {
      entry.arrowStart.geometry.dispose();
      (entry.arrowStart.material as THREE.Material).dispose();
    }
    if (entry.arrowEnd) {
      entry.arrowEnd.geometry.dispose();
      (entry.arrowEnd.material as THREE.Material).dispose();
    }
  }
}
