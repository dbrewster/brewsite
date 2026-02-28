// Pipe routing utilities for cross-diagram connections.
// Pure functions only — no Three.js, no React.

import type { DiagramState } from '../../types';
import type { DiagramPipeState, PipeRoutingAlgorithm, PipeLandingAlgorithm } from '../types';
import { routeCurvedWithEndpointNormals } from '../../compiler/curveKernel';

type Vec3 = readonly [number, number, number];

function rotateXYZ(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  return [
    (cy * cz) * v[0] + (sx * sy * cz - cx * sz) * v[1] + (cx * sy * cz + sx * sz) * v[2],
    (cy * sz) * v[0] + (sx * sy * sz + cx * cz) * v[1] + (cx * sy * sz - sx * cz) * v[2],
    (-sy)     * v[0] + (sx * cy)                * v[1] + (cx * cy)                * v[2],
  ];
}

function nodeToCanvasSpace(
  nodeLocalPos: Vec3,
  diagramPos: Vec3,
  diagramScale: number,
  diagramRotation: Vec3,
): Vec3 {
  const scaled: Vec3 = [
    nodeLocalPos[0] * diagramScale,
    nodeLocalPos[1] * diagramScale,
    nodeLocalPos[2] * diagramScale,
  ];
  const rotated = rotateXYZ(scaled, diagramRotation[0], diagramRotation[1], diagramRotation[2]);
  return [
    rotated[0] + diagramPos[0],
    rotated[1] + diagramPos[1],
    rotated[2] + diagramPos[2],
  ];
}

export function sideAttachmentPoint(
  nodeLocalPos: Vec3,
  nodeSize: readonly [number, number],
  nodeDepth: number,
  diagramPos: Vec3,
  diagramScale: number,
  diagramRotation: Vec3,
  targetPos: Vec3,
): { point: Vec3; normal: Vec3 } {
  const [cx, cy, cz] = nodeToCanvasSpace(nodeLocalPos, diagramPos, diagramScale, diagramRotation);

  const [rx, ry, rz] = diagramRotation;
  const localXinCanvas = rotateXYZ([1, 0, 0], rx, ry, rz);
  const localYinCanvas = rotateXYZ([0, 1, 0], rx, ry, rz);
  const localZinCanvas = rotateXYZ([0, 0, 1], rx, ry, rz);

  const delta: Vec3 = [targetPos[0] - cx, targetPos[1] - cy, targetPos[2] - cz];
  const localDx = delta[0] * localXinCanvas[0] + delta[1] * localXinCanvas[1] + delta[2] * localXinCanvas[2];
  const localDy = delta[0] * localYinCanvas[0] + delta[1] * localYinCanvas[1] + delta[2] * localYinCanvas[2];
  const localDz = delta[0] * localZinCanvas[0] + delta[1] * localZinCanvas[1] + delta[2] * localZinCanvas[2];
  const side = localDx >= 0 ? 1 : -1;

  const halfW = (nodeSize[0] / 2) * diagramScale;
  const halfH = (nodeSize[1] / 2) * diagramScale;
  const halfD = (nodeDepth / 2) * diagramScale;
  const absDx = Math.max(Math.abs(localDx), 1e-6);
  const rayScale = halfW / absDx;
  const localYOnFace = Math.max(-halfH, Math.min(halfH, localDy * rayScale));
  const localZOnFace = Math.max(-halfD, Math.min(halfD, localDz * rayScale));

  const px = cx
    + localXinCanvas[0] * side * halfW
    + localYinCanvas[0] * localYOnFace
    + localZinCanvas[0] * localZOnFace;
  const py = cy
    + localXinCanvas[1] * side * halfW
    + localYinCanvas[1] * localYOnFace
    + localZinCanvas[1] * localZOnFace;
  const pz = cz
    + localXinCanvas[2] * side * halfW
    + localYinCanvas[2] * localYOnFace
    + localZinCanvas[2] * localZOnFace;

  const normal: Vec3 = [
    localXinCanvas[0] * side,
    localXinCanvas[1] * side,
    localXinCanvas[2] * side,
  ];
  return { point: [px, py, pz], normal };
}

export function routePipe(
  from: Vec3,
  to: Vec3,
  fromNormal?: Vec3,
  toNormal?: Vec3,
  routing: PipeRoutingAlgorithm = 'curved',
): ReadonlyArray<Vec3> {
  if (routing === 'straight') return [from, to];

  const dist = Math.sqrt(
    (to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2 + (to[2] - from[2]) ** 2,
  );

  if (fromNormal && toNormal) {
    return routeCurvedWithEndpointNormals(from, to, fromNormal, toNormal, {
      epsilon: 0,
      handleMin: 0.05,
      handleMax: 4,
      handleFactor: 0.20,
      antiParallelDotThreshold: -0.3,
      antiParallelHandleBoost: 1.35,
    });
  }

  const arcH = Math.max(0.5, dist * 0.15);
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2 + arcH;
  const midZ = (from[2] + to[2]) / 2;
  const ctrl1: Vec3 = [from[0] + (midX - from[0]) * 0.5, from[1] + (midY - from[1]) * 0.5, from[2] + (midZ - from[2]) * 0.5];
  const ctrl2: Vec3 = [midX + (to[0] - midX) * 0.5, midY + (to[1] - midY) * 0.5, midZ + (to[2] - midZ) * 0.5];
  return [from, ctrl1, ctrl2, to];
}

export function rerouteLivePipes(
  pipes: ReadonlyArray<DiagramPipeState>,
  diagrams: ReadonlyArray<DiagramState>,
  routing: PipeRoutingAlgorithm,
  landing: PipeLandingAlgorithm,
): Map<string, ReadonlyArray<Vec3>> {
  const result = new Map<string, ReadonlyArray<Vec3>>();

  for (const pipe of pipes) {
    const fromDiagram = diagrams.find((d) => d.id === pipe.fromDiagramId);
    const toDiagram = diagrams.find((d) => d.id === pipe.toDiagramId);
    const fromNode = fromDiagram?.nodes.find((n) => n.id === pipe.fromNodeId);
    const toNode = toDiagram?.nodes.find((n) => n.id === pipe.toNodeId);

    if (!fromDiagram || !fromNode) {
      console.warn(`DiagramCanvas rerouteLivePipes: cannot resolve from="${pipe.fromDiagramId}.${pipe.fromNodeId}".`);
      result.set(pipe.id, []);
      continue;
    }
    if (!toDiagram || !toNode) {
      console.warn(`DiagramCanvas rerouteLivePipes: cannot resolve to="${pipe.toDiagramId}.${pipe.toNodeId}".`);
      result.set(pipe.id, []);
      continue;
    }

    if (landing === 'sides') {
      const fromAttach = sideAttachmentPoint(
        fromNode.position,
        fromNode.size,
        fromNode.depth,
        fromDiagram.position,
        fromDiagram.scale,
        fromDiagram.rotation,
        nodeToCanvasSpace(toNode.position, toDiagram.position, toDiagram.scale, toDiagram.rotation),
      );
      const toAttach = sideAttachmentPoint(
        toNode.position,
        toNode.size,
        toNode.depth,
        toDiagram.position,
        toDiagram.scale,
        toDiagram.rotation,
        nodeToCanvasSpace(fromNode.position, fromDiagram.position, fromDiagram.scale, fromDiagram.rotation),
      );
      result.set(pipe.id, routePipe(fromAttach.point, toAttach.point, fromAttach.normal, toAttach.normal, routing));
    } else {
      const fromWorld = nodeToCanvasSpace(fromNode.position, fromDiagram.position, fromDiagram.scale, fromDiagram.rotation);
      const toWorld = nodeToCanvasSpace(toNode.position, toDiagram.position, toDiagram.scale, toDiagram.rotation);
      result.set(pipe.id, routePipe(fromWorld, toWorld, undefined, undefined, routing));
    }
  }

  return result;
}

export { rotateXYZ };
