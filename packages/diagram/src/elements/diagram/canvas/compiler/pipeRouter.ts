// Pipe routing utilities for cross-diagram connections.
// Pure functions only — no Three.js, no React.

import type { DiagramState } from '../../types';
import type { DiagramPipeState, PipeRoutingAlgorithm, PipeLandingAlgorithm } from '../types';

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
): Vec3 {
  return [
    nodeLocalPos[0] * diagramScale + diagramPos[0],
    nodeLocalPos[1] * diagramScale + diagramPos[1],
    nodeLocalPos[2] * diagramScale + diagramPos[2],
  ];
}

export function sideAttachmentPoint(
  nodeLocalPos: Vec3,
  nodeSize: readonly [number, number],
  nodeDepth: number,
  diagramPos: Vec3,
  diagramScale: number,
  diagramRotation: Vec3,
  targetDiagramPos: Vec3,
): { point: Vec3; normal: Vec3 } {
  const cx = nodeLocalPos[0] * diagramScale + diagramPos[0];
  const cy = nodeLocalPos[1] * diagramScale + diagramPos[1];
  const cz = nodeLocalPos[2] * diagramScale + diagramPos[2];

  const [rx, ry, rz] = diagramRotation;
  const localXinCanvas = rotateXYZ([1, 0, 0], rx, ry, rz);

  const tx = targetDiagramPos[0];
  const side = tx > cx ? 1 : -1;

  const halfW = (nodeSize[0] / 2) * diagramScale;

  const px = cx + localXinCanvas[0] * side * halfW;
  const py = cy + localXinCanvas[1] * side * halfW;
  const pz = cz + localXinCanvas[2] * side * halfW;

  const normal: Vec3 = [
    localXinCanvas[0] * side,
    localXinCanvas[1] * side,
    localXinCanvas[2] * side,
  ];

  void nodeDepth;
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
  const stub = Math.min(3.0, dist * 0.20);

  if (fromNormal && toNormal) {
    const dotNormals = fromNormal[0]*toNormal[0] + fromNormal[1]*toNormal[1] + fromNormal[2]*toNormal[2];
    if (dotNormals < -0.3) {
      const midX = (from[0] + to[0]) / 2;
      const midY = (from[1] + to[1]) / 2;
      const edgeDx = to[0] - from[0];
      const edgeDy = to[1] - from[1];
      const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
      const perpX = -edgeDy / edgeLen;
      const perpY = edgeDx / edgeLen;
      const bow = Math.min(1.5, dist * 0.20);
      return [from, [midX + perpX * bow, midY + perpY * bow, from[2]], to];
    }
    const g1: Vec3 = [from[0] + fromNormal[0] * stub, from[1] + fromNormal[1] * stub, from[2] + fromNormal[2] * stub];
    const g2: Vec3 = [to[0]   + toNormal[0]   * stub, to[1]   + toNormal[1]   * stub, to[2]   + toNormal[2]   * stub];
    return [from, g1, g2, to];
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
        toDiagram.position,
      );
      const toAttach = sideAttachmentPoint(
        toNode.position,
        toNode.size,
        toNode.depth,
        toDiagram.position,
        toDiagram.scale,
        toDiagram.rotation,
        fromDiagram.position,
      );
      result.set(pipe.id, routePipe(fromAttach.point, toAttach.point, fromAttach.normal, toAttach.normal, routing));
    } else {
      const fromWorld = nodeToCanvasSpace(fromNode.position, fromDiagram.position, fromDiagram.scale);
      const toWorld = nodeToCanvasSpace(toNode.position, toDiagram.position, toDiagram.scale);
      result.set(pipe.id, routePipe(fromWorld, toWorld, undefined, undefined, routing));
    }
  }

  return result;
}

export { rotateXYZ };
