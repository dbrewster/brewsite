// Create/update/dispose Three.js tube+arrow geometry for diagram edges and canvas pipes.

import * as THREE from 'three';
import type { EdgeRenderEntry } from './types';
import type { IEdgeMaterialFactory } from './EdgeMaterialFactory';
import { parseHexColor } from '@brewsite/core';
import type {
  DiagramEdgePathCommand,
  DiagramEdgePathState,
  EdgeRoutingAlgorithm,
} from '../types';

export type EdgeLike = {
  id: string;
  path?: DiagramEdgePathState;
  controlPoints: ReadonlyArray<readonly [number, number, number]>;
  routing?: EdgeRoutingAlgorithm;
  thickness: number;
  color: string;
  opacity: number;
  style?: 'solid' | 'dashed' | 'dotted';
  arrowStart?: string;
  arrowEnd?: string;
  flow?: 'none' | 'forward' | 'backward' | 'bidirectional';
  flowColor?: string;
};

type ShaderLike = {
  uniforms: Record<string, unknown>;
  fragmentShader: string;
  vertexShader: string;
};

type EdgeEntry = Omit<EdgeRenderEntry, 'lastState'> & { lastState?: EdgeLike };

const toVectorPoints = (controlPoints: EdgeLike['controlPoints']): THREE.Vector3[] =>
  controlPoints.length >= 2
    ? controlPoints.map((pt) => new THREE.Vector3(pt[0], pt[1], pt[2]))
    : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];

const buildPolylinePath = (points: ReadonlyArray<THREE.Vector3>): THREE.CurvePath<THREE.Vector3> => {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (!start || !end) continue;
    path.add(new THREE.LineCurve3(start, end));
  }
  return path;
};

const toVector3 = (point: readonly [number, number, number]): THREE.Vector3 =>
  new THREE.Vector3(point[0], point[1], point[2]);

const buildCurvePathFromCommands = (
  commands: ReadonlyArray<DiagramEdgePathCommand>,
): THREE.CurvePath<THREE.Vector3> => {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (const command of commands) {
    if (command.kind === 'line') {
      path.add(new THREE.LineCurve3(toVector3(command.from), toVector3(command.to)));
      continue;
    }
    path.add(new THREE.CubicBezierCurve3(
      toVector3(command.p0),
      toVector3(command.p1),
      toVector3(command.p2),
      toVector3(command.p3),
    ));
  }
  return path;
};

/**
 * Resample a piecewise CurvePath into a smooth CatmullRomCurve3.
 *
 * Three.js TubeGeometry uses the Frenet-Serret frame to orient tube
 * cross-sections. At junctions between line segments and cubic curves,
 * the curvature jumps from zero (straight) to non-zero (curve onset),
 * causing the Frenet normal to rotate abruptly — producing a visible
 * twist/pinch in the tube even though the path tangent is continuous.
 *
 * Resampling into a CatmullRomCurve3 produces a single smooth curve
 * whose Frenet frame is stable throughout. The sample count is chosen
 * to preserve detail at curved sections while keeping the straight
 * sections straight (many samples = high fidelity).
 */
const resampleAsCatmullRom = (
  curvePath: THREE.CurvePath<THREE.Vector3>,
  sampleCount: number = 64,
): THREE.CatmullRomCurve3 => {
  const points = curvePath.getSpacedPoints(sampleCount);
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.25);
};

const buildCurve = (edge: EdgeLike): THREE.Curve<THREE.Vector3> => {
  if (edge.path && edge.path.commands.length > 0) {
    const commands = edge.path.commands;
    if (
      commands.length === 1 &&
      commands[0]?.kind === 'line'
    ) {
      return new THREE.LineCurve3(
        toVector3(commands[0].from),
        toVector3(commands[0].to),
      );
    }
    if (
      commands.length === 1 &&
      commands[0]?.kind === 'cubic'
    ) {
      return new THREE.CubicBezierCurve3(
        toVector3(commands[0].p0),
        toVector3(commands[0].p1),
        toVector3(commands[0].p2),
        toVector3(commands[0].p3),
      );
    }
    // Resample as CatmullRom to eliminate Frenet-frame kinks at
    // line→cubic junctions. The piecewise CurvePath has tangent-continuous
    // junctions but curvature discontinuities that make the Frenet normal
    // flip. CatmullRom resampling produces a single smooth curve.
    const piecewise = buildCurvePathFromCommands(commands);
    return resampleAsCatmullRom(piecewise);
  }

  const points = toVectorPoints(edge.controlPoints);
  const routing = edge.routing;

  if (routing === 'straight' || points.length === 2) {
    return new THREE.LineCurve3(points[0]!, points[points.length - 1]!);
  }

  if ((routing === 'curved' || routing === 'organic') && points.length === 4) {
    return new THREE.CubicBezierCurve3(points[0]!, points[1]!, points[2]!, points[3]!);
  }

  if (routing === 'organic') {
    return new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.15);
  }

  if (points.length === 4) {
    return new THREE.CubicBezierCurve3(points[0]!, points[1]!, points[2]!, points[3]!);
  }

  return buildPolylinePath(points);
};

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
    private readonly flowSpeed: number = 0.7,
    private readonly flowWidth: number = 0.18,
    private readonly flowPulseIntensity: number = 0.9,
    private readonly tubeRadialSegments: number = 8,
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

  /**
   * Updates only the uTime uniform on all existing edges that have pulse
   * materials. Called from DiagramRenderer's early-out path so that flow
   * pulse animations continue even when the diagram state reference is
   * unchanged between frames.
   */
  tickPulseUniforms(): void {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    for (const entry of this.entries.values()) {
      const mat = entry.tube.material as THREE.MeshStandardMaterial & { userData: Record<string, unknown> };
      const pulseData = mat.userData[this.pulseUniformKey] as
        | { uniforms: { uTime: { value: number } } }
        | undefined;
      if (pulseData) {
        pulseData.uniforms.uTime.value = now;
      }
    }
  }

  private createEntry(edge: EdgeLike): EdgeEntry {
    const group = new THREE.Group();
    const curve = buildCurve(edge);
    const segments = this.resolveSegments(edge);
    const tubeGeometry = new THREE.TubeGeometry(
      curve,
      segments,
      edge.thickness,
      this.tubeRadialSegments,
      false,
    );
    const edgeParsed = parseHexColor(edge.color);
    const tubeMaterial = this.materialFactory.createMaterial(
      edgeParsed.rgb,
      edge.opacity * edgeParsed.alpha,
      edge.style ?? 'solid',
      this.edgeMetalness,
      this.edgeRoughness,
    );
    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tube.castShadow = true;
    tube.receiveShadow = true;
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
      edge.path !== prev.path ||
      edge.controlPoints !== prev.controlPoints ||
      edge.thickness !== prev.thickness ||
      edge.routing !== prev.routing;

    let curve: THREE.Curve<THREE.Vector3> | undefined;
    const getCurve = (): THREE.Curve<THREE.Vector3> => {
      if (!curve) {
        curve = buildCurve(edge);
      }
      return curve;
    };

    if (needsGeometry) {
      const c = getCurve();
      const segments = this.resolveSegments(edge);
      const geometry = new THREE.TubeGeometry(
        c,
        segments,
        edge.thickness,
        this.tubeRadialSegments,
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
      const rebuildParsed = parseHexColor(edge.color);
      (entry.tube.material as THREE.Material).dispose();
      entry.tube.material = this.materialFactory.createMaterial(
        rebuildParsed.rgb,
        edge.opacity * rebuildParsed.alpha,
        edge.style ?? 'solid',
        this.edgeMetalness,
        this.edgeRoughness,
      );
    } else if (prev && prev.opacity !== edge.opacity) {
      const mat = entry.tube.material as THREE.MeshStandardMaterial;
      const colorAlpha = parseHexColor(edge.color).alpha;
      const effectiveOp = edge.opacity * colorAlpha;
      mat.opacity = effectiveOp;
      mat.transparent = effectiveOp < 1 || edge.style !== 'solid';
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

        const arrowH = edge.thickness * 4;
        const arrowW = edge.thickness * 4;
        const arrowParsed = parseHexColor(edge.color);
        const arrowOp = edge.opacity * arrowParsed.alpha;
        if (this.use3DArrows) {
          if (arrow.geometry) arrow.geometry.dispose();
          arrow.geometry = new THREE.ConeGeometry(arrowW * 0.5, arrowH, 14, 1);
          if (arrow.material) (arrow.material as THREE.Material).dispose();
          arrow.material = new THREE.MeshStandardMaterial({
            color: arrowParsed.rgb,
            metalness: this.edgeMetalness,
            roughness: this.edgeRoughness,
            transparent: arrowOp < 1,
            opacity: arrowOp,
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
            color: arrowParsed.rgb,
            transparent: arrowOp < 1,
            opacity: arrowOp,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
        }
        arrow.castShadow = true;
        arrow.receiveShadow = true;

        const curveT = kind === 'start' ? 0.02 : 0.98;
        const c = getCurve();
        const endPoint = c.getPointAt(kind === 'start' ? 0 : 1);
        const tangent = c.getTangentAt(curveT).normalize();
        const dir = kind === 'start' ? tangent.clone().multiplyScalar(-1) : tangent;

        // Position the arrow so its BASE sits at the pipe endpoint and the
        // TIP extends forward toward/into the destination node. This makes
        // the arrowhead visually protrude from the pipe end rather than
        // hiding inside the pipe body.
        if (this.use3DArrows) {
          const baseCenter = endPoint.clone().addScaledVector(dir, edge.thickness * 0.5);
          const center = baseCenter.clone().addScaledVector(dir, arrowH * 0.5);
          arrow.position.copy(center);
          arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        } else {
          // Shift forward by arrowH so the base (y=-arrowH in local space)
          // aligns with the pipe end and the tip (y=0) extends past it.
          arrow.position.copy(endPoint.clone().addScaledVector(dir, arrowH));
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

  private resolveSegments(edge: EdgeLike): number {
    const commands = edge.path?.commands;
    const commandCount = commands?.length ?? 0;
    if (commandCount > 0) {
      if (commandCount === 1 && commands?.[0]?.kind === 'line') {
        return Math.max(8, Math.round(12 * this.edgeSmoothness));
      }
      const cubicCount = commands?.filter((command) => command.kind === 'cubic').length ?? 0;
      return Math.max(
        16,
        Math.round((commandCount * 10 + cubicCount * 8) * this.edgeSmoothness),
      );
    }

    if (edge.routing === 'straight' || edge.controlPoints.length === 2) {
      return Math.max(8, Math.round(12 * this.edgeSmoothness));
    }
    return Math.max(
      20,
      Math.round((edge.controlPoints.length === 4 ? 40 : edge.controlPoints.length * 8) * this.edgeSmoothness),
    );
  }

  private updatePulseMaterial(material: THREE.MeshStandardMaterial, edge: EdgeLike): void {
    const flow = edge.flow ?? 'none';
    const wantsPulse = flow !== 'none';

    const mat = material as THREE.MeshStandardMaterial & {
      userData: Record<string, unknown>;
      onBeforeCompile?: (shader: ShaderLike) => void;
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
        uPulseColor: { value: new THREE.Color(parseHexColor(edge.flowColor ?? edge.color).rgb) },
        uPulseSpeed: { value: this.flowSpeed },
        uPulseWidth: { value: this.flowWidth },
        uPulseIntensity: { value: 1.6 },
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
            `float width = clamp(uPulseWidth * 0.5, 0.01, 0.5);`,
            `float d = abs(fract(vUv.x - pulseT) - 0.5);`,
            `float pulse = smoothstep(width, 0.0, d);`,
            `if (uPulseBidirectional > 0.5) {`,
            `  float pulseT2 = mod(uTime * uPulseSpeed, 1.0);`,
            `  float d2 = abs(fract(vUv.x - (1.0 - pulseT2)) - 0.5);`,
            `  float pulse2 = smoothstep(width, 0.0, d2);`,
            `  pulse = max(pulse, pulse2);`,
            `}`,
            `float glow = pow(pulse, 0.35);`,
            `gl_FragColor.rgb += uPulseColor * glow * uPulseIntensity;`,
          ].join('\n'),
        );
      };
      mat.needsUpdate = true;
    }

    const pulseData = (mat.userData[this.pulseUniformKey] as { uniforms: { [key: string]: { value: unknown } } } | undefined);
    if (!pulseData) return;

    const uniforms = pulseData.uniforms;
    uniforms.uTime.value = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    uniforms.uPulseColor.value = new THREE.Color(parseHexColor(edge.flowColor ?? edge.color).rgb);
    uniforms.uPulseSpeed.value = this.flowSpeed;
    uniforms.uPulseWidth.value = this.flowWidth;
    uniforms.uPulseDir.value = flow === 'backward' ? -1 : 1;
    uniforms.uPulseBidirectional.value = flow === 'bidirectional' ? 1 : 0;
    uniforms.uPulseIntensity.value = wantsPulse ? this.flowPulseIntensity : 0;
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
