// Pipe routing utilities for cross-diagram connections.
// Pure functions only — no Three.js, no React.

import type { DiagramState } from '../../types';
import type { NVSRect } from '@brewsite/core';
import type { DiagramPipeState, PipeRoutingAlgorithm, PipeLandingAlgorithm } from '../types';
import { routeCurvedWithEndpointNormals } from '../../compiler/curveKernel';

type Vec3 = readonly [number, number, number];

export function rotateXYZ(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  return [
    (cy * cz) * v[0] + (sx * sy * cz - cx * sz) * v[1] + (cx * sy * cz + sx * sz) * v[2],
    (cy * sz) * v[0] + (sx * sy * sz + cx * cz) * v[1] + (cx * sy * sz - sx * cz) * v[2],
    (-sy)     * v[0] + (sx * cy)                * v[1] + (cx * cy)                * v[2],
  ];
}

/**
 * Converts a node's [0..1] NVS position within a diagram to canvas-local space.
 * Applies the viewport-to-canvas mapping and tilt rotation.
 *
 * Canvas-local convention: center-origin, Y-up, X scaled by canvasAspect.
 *
 * @param nodeNvsPos   Node position in [0..1] diagram NVS
 * @param viewportBounds  Diagram's viewport bounds within the canvas [0..1]
 * @param tiltRotation Euler XYZ rotation for the diagram tilt effect
 * @param canvasAspect Canvas aspect ratio (width / height in canvas units)
 */
export function nodeNvsToCanvasLocal(
  nodeNvsPos: Vec3,
  viewportBounds: NVSRect,
  tiltRotation: Vec3,
  canvasAspect: number,
): Vec3 {
  const vpX = viewportBounds.x + viewportBounds.w * nodeNvsPos[0];
  const vpY = viewportBounds.y + viewportBounds.h * nodeNvsPos[1];
  const localX = (vpX - 0.5) * canvasAspect;
  const localY = -(vpY - 0.5);  // Y-flip: NVS y=0 top → canvas +Y
  const localZ = nodeNvsPos[2];
  return rotateXYZ([localX, localY, localZ], tiltRotation[0], tiltRotation[1], tiltRotation[2]);
}

/**
 * Computes the side attachment point and outward normal for a node face,
 * given the target position. Used to route pipe endpoints to the left/right
 * face of each node rather than through the front-face icons and labels.
 *
 * All coordinates are in canvas-local space (center-origin, Y-up).
 */
export function sideAttachmentPoint(
  nodeNvsPos: Vec3,
  nodeSize: readonly [number, number],
  nodeDepth: number,
  viewportBounds: NVSRect,
  tiltRotation: Vec3,
  canvasAspect: number,
  targetPos: Vec3,
): { point: Vec3; normal: Vec3 } {
  const [cx, cy, cz] = nodeNvsToCanvasLocal(nodeNvsPos, viewportBounds, tiltRotation, canvasAspect);

  const [rx, ry, rz] = tiltRotation;
  const localXinCanvas = rotateXYZ([1, 0, 0], rx, ry, rz);
  const localYinCanvas = rotateXYZ([0, 1, 0], rx, ry, rz);
  const localZinCanvas = rotateXYZ([0, 0, 1], rx, ry, rz);

  const delta: Vec3 = [targetPos[0] - cx, targetPos[1] - cy, targetPos[2] - cz];
  const localDx = delta[0] * localXinCanvas[0] + delta[1] * localXinCanvas[1] + delta[2] * localXinCanvas[2];
  const localDy = delta[0] * localYinCanvas[0] + delta[1] * localYinCanvas[1] + delta[2] * localYinCanvas[2];
  const localDz = delta[0] * localZinCanvas[0] + delta[1] * localZinCanvas[1] + delta[2] * localZinCanvas[2];
  const side = localDx >= 0 ? 1 : -1;

  // Canvas-local half-extents derived from NVS size fractions + viewport bounds
  const halfW = nodeSize[0] * viewportBounds.w * canvasAspect / 2;
  const halfH = nodeSize[1] * viewportBounds.h / 2;
  const halfD = nodeDepth / 2;

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
  canvasAspect: number = 16 / 9,
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
        fromNode.thickness,
        fromDiagram.viewportBounds,
        fromDiagram.tiltRotation,
        canvasAspect,
        nodeNvsToCanvasLocal(toNode.position, toDiagram.viewportBounds, toDiagram.tiltRotation, canvasAspect),
      );
      const toAttach = sideAttachmentPoint(
        toNode.position,
        toNode.size,
        toNode.thickness,
        toDiagram.viewportBounds,
        toDiagram.tiltRotation,
        canvasAspect,
        nodeNvsToCanvasLocal(fromNode.position, fromDiagram.viewportBounds, fromDiagram.tiltRotation, canvasAspect),
      );
      result.set(pipe.id, routePipe(fromAttach.point, toAttach.point, fromAttach.normal, toAttach.normal, routing));
    } else {
      const fromWorld = nodeNvsToCanvasLocal(fromNode.position, fromDiagram.viewportBounds, fromDiagram.tiltRotation, canvasAspect);
      const toWorld = nodeNvsToCanvasLocal(toNode.position, toDiagram.viewportBounds, toDiagram.tiltRotation, canvasAspect);
      result.set(pipe.id, routePipe(fromWorld, toWorld, undefined, undefined, routing));
    }
  }

  return result;
}
